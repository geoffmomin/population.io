(function () {
  'use strict';

  angular.module('populationioApp')
    .directive('peopleGrid', function (PeopleGridService, PopulationIOService, Celebrities, ProfileService, $timeout) {
      return {
        restrict: 'E',
        scope: {
          rankLocal: "=",
          rankLocalTotal: "=",
          rankGlobal: "=",
          rankGlobalTotal: "="
        },
        link: function ($scope, element) {
          var personWidth = 30,
            personHeight = 50,
            parentWidth = 1200,
            parentHeight = 650,
            navigatorArea,
            person,
            celebTooltip,
            celebTooltipTitle,
            celebTooltipDetails,
            celebTooltipRank,
            grid,
            rollScale,
            celebsBar,
            prevCelebsButton,
            nextCelebsButton,
            peopleInOneRow,
            personNavPointer,
            celebsRoll,
            rankScale,
            rankScale2,
            birthdayScale,
            celebTooltipPointerShadow,
            celebTooltipPointer,
            activeCelebs,
            lens,
            blockData = [],
            gridRows = 200,
            gridCols = 100,
            celebTooltipImage,
            celebsInCelebsBar = 5,
            blockHeight = 2,
            blockWidth = 2,
            navWidth = 180,
            navHeight = 400,
            _populationTopLimit = 8000000000,
            scaleX = personWidth,
            scaleY = personHeight / 3,
            lensWidth = 30,
            lensHeight = 8 * 3,
            gridWidth = personWidth * 30,
            gridHeight = personHeight * 8,
            celebTooltipWidth = 270,
            celebWidth,
            firstRun = true,
            currentCeleb = 0,
            frameX = 0,
            frameY = 0,


            formatBillions = d3.format(".1s"),
            formatLeadingZeros = d3.format("03d");


          var utils = {
            translate: function (x, y) {return 'translate(' + [x, y] + ')';},
            getXYFromTranslate: function (translateString) {
              var split = translateString.split(",");
              var x = split[0] ? ~~split[0].split("(")[1] : 0;
              var y = split[1] ? ~~split[1].split(")")[0] : 0;
              return [x, y];
            }
          };

          var dragFrame = d3.behavior.drag()
            .on('dragstart', function () {
              var frameTranslate = utils.getXYFromTranslate(d3.select(this).attr('transform'));
              frameX = frameTranslate[0];
              frameY = frameTranslate[1];
            })
            .on('drag', function () {
              var target = d3.select('.grid');
              d3.event.sourceEvent.stopImmediatePropagation();
              frameX += d3.event.dx;
              frameY += d3.event.dy;
              if (frameX < 0) {frameX = 0}
              if (frameY < 0) {frameY = 0}
              if (frameX >= navWidth - lensWidth) {frameX = navWidth - lensWidth}
              if (frameY >= navHeight - lensHeight) {frameY = navHeight - lensHeight}
              d3.select(this).attr("transform", utils.translate(frameX, frameY));
              var translate = [(-frameX * scaleX), (-frameY * scaleY)];
              target.attr("transform", "translate(" + translate + ")");
            });


          var chart = d3.select(element[0])
            .append('svg')
            .attr({width: parentWidth, height: parentHeight})
            .append('g')
            .attr({transform: 'translate(0,0)'});

          _initDefs();
          function _updateLocalBar(rank, rankTotal) {
            var bar = chart.select('.bar.local'),
              width = parseInt((rank / rankTotal) * parentWidth, 0),
              ticks = 5;

            bar.select('rect.highlight')
              .transition()
              .duration(1000)
              .attr({
                width: width
              });
            bar.select('text')
              .text(parseInt(100 * rank / rankTotal, 0) + '%')
              .transition()
              .duration(1000)
              .attr({
                x: width
              });

            var xScale = d3.scale.linear()
              .domain([0, rankTotal])
              .range([0, parentWidth]);

            var xAxis = d3.svg.axis()
              .scale(xScale)
              .orient('bottom')
              .ticks(ticks);

            bar.select('.x-axis')
              .call(xAxis)
              .selectAll('.tick')
              .attr({
                'class': function (d, i) {
                  var className = 'tick';
                  if (i === 0) {
                    className += ' first';
                  }
                  if (i === ticks - 1) {
                    className += ' last';
                  }
                  return className;
                }
              });
          };
          var _updateGlobalBar = function (rank, rankTotal) {
            var bar = chart.select('.bar.world'),
              width = (rank / rankTotal) * parentWidth,
              ticks = 5;

            bar.select('rect.highlight')
              .transition()
              .duration(1000)
              .attr({
                width: width
              });
            bar.select('.percent')
              .text(parseInt(100 * rank / rankTotal, 0) + '%')
              .transition()
              .duration(1000)
              .attr({
                x: width
              });

            var xScale = d3.scale.linear()
              .domain([0, rankTotal])
              .range([0, parentWidth]);

            var xAxis = d3.svg.axis()
              .scale(xScale)
              .orient('top')
              .ticks(ticks);

            bar.select('.x-axis')
              .call(xAxis)
              .selectAll('.tick')
              .attr({
                'class': function (d, i) {
                  var className = 'tick';
                  if (i === 0) {
                    className += ' first';
                  }
                  if (i === ticks - 1) {
                    className += ' last';
                  }
                  return className;
                }
              });
          };

          var _buildBarChart = function () {
            var barHeight = 17;

            var barChart = chart.append('g')
              .attr('class', 'bar-chart');

            var worldBar = barChart.append('g')
              .attr('class', 'bar world');

            worldBar.append('rect')
              .attr({
                height: barHeight,
                width: parentWidth
              });
            worldBar.append('rect')
              .attr({
                'class': 'highlight',
                height: barHeight,
                width: 0
              });
            worldBar.append('text')
              .text('0%')
              .attr({
                'class': 'percent',
                x: 0
              });
            worldBar.append('g')
              .attr('class', 'x-axis');

            var localBar = barChart.append('g')
              .attr('class', 'bar local');

            localBar.append('rect')
              .attr({
                height: barHeight,
                width: parentWidth
              });
            localBar.append('rect')
              .attr({
                class: 'highlight',
                height: barHeight,
                width: 0
              });
            localBar.append('text')
              .text('0%')
              .attr({
                'class': 'percent',
                x: 0
              });
            localBar.append('g')
              .attr('class', 'x-axis');
          };

          var _buildNavigator = function () {

            var celebs = Celebrities.all();
            celebs.push({
              birthday: ProfileService.birthday,
              name: 'You',
              country: ProfileService.country,
              gender: ProfileService.gender,
              thumbnail: 'images/human.png',
              id: celebs.length
            });
            celebs = _.sortBy(celebs, function (item) {return item.birthday})

            blockData = [];
            var _worldPopulation = PopulationIOService.getWorldPopulation();


            rankScale = d3.time.scale()
              .domain([new Date('1920-01-01'), new Date()])
              .range([0, _worldPopulation]);
            rankScale2 = d3.scale.linear()
              .domain([0, _worldPopulation])
              .range([new Date('1920-01-01'), new Date()])
            ;

            var yScale2 = d3.scale.linear()
              .domain([0, navHeight])
              .range([0, _populationTopLimit]);
            d3.select('.navigator').remove();
            navigatorArea = chart
              .append('g')
              .attr({
                class: 'navigator',
                transform: 'translate(' + [950 + personWidth / 2, 100] + ')'
              });

            for (var i = 0; i < navHeight / 3; i++) {
              blockData.push({
                i: i * 2,
                population: yScale2(i * 3)
              })
            }
            peopleInOneRow = _worldPopulation / blockData.length;

            var rows = [];
            _.times(blockData.length, function (i) {rows.push(i * 3)});

            var yScale = d3.scale.quantize()
              .domain([0, _populationTopLimit])
              .range(rows);
            var yAxisScale = d3.scale.linear()
              .domain([0, _populationTopLimit])
              .range([0, navHeight]);

            birthdayScale = d3.time.scale()
              .domain([new Date('1920-01-01'), new Date()])
              .range([0, navHeight]);
            var yAxis = d3.svg.axis()
              .scale(yAxisScale)
              .orient('right')
              .ticks(8)
              .tickFormat(function (d) { return formatBillions(d).replace('G', 'b');});

            var xCols = [];
            for (var i = 0; i < navWidth - 3; i++) {
              xCols.push(i)
            }
            var xScale = d3.scale.quantize()
              .domain([peopleInOneRow, 0 ])
              .range(xCols);

            navigatorArea.append('rect')
              .attr({
                opacity: 0,
                class: 'frame',
                height: navHeight,
                width: navWidth
              })
              .transition()
              .delay(2000)
              .attr({
                opacity: 1
              })
            ;

            var blocksArea = navigatorArea
              .append('g')
              .attr({
                class: 'blocks',
                transform: 'translate(1,1)'
              });
            var celebsArea = navigatorArea
              .append('g')
              .attr({
                class: 'celebs',
                transform: 'translate(1,1)'
              });
            var yAxisElement = navigatorArea.append('g')
              .attr({
                opacity: 0,
                class: 'y-axis',
                transform: 'translate(190,0)'
              })
              .transition()
              .delay(2000)
              .attr({
                opacity: 1
              })

              .call(yAxis)
              .selectAll('text').attr('dy', '-4px');
            var lastPopulationBlock = true;
            blocksArea.selectAll('.block')
              .data(blockData)
              .enter()
              .append('rect')
              .attr({
                'data-population': function (d, i) {
                  return Math.floor(d.population)
                },
                'data-i': function (d, i) {
                  return i
                },
                class: function (d, i) {
                  var limit = '';
                  if (d.population > _worldPopulation) {
                    limit = ' overlimit';
                    if (lastPopulationBlock) {
                      limit += ' first';
                      lastPopulationBlock = false;
                    }
                  }
                  return 'block' + limit
                },
                height: 2,
                width: 0,
                transform: function (d, i) {
                  return 'translate(' + [0, i * 3] + ')'
                }
              })
              .transition()
              .duration(2000)
              .delay(function (d, i) {
                return 2000 + i * 10
              })
              .attr({
                width: navWidth - 2
              });
            blocksArea.select('.block.overlimit.first')
              .transition()
              .delay(5000)
              .duration(2000)
              .attr(
              {
                width: function (d, i) {
                  return xScale(d.population - _worldPopulation);
                }
              });


            celebsArea.selectAll('rect')
              .data(celebs)
              .enter()
              .append('rect')
              .attr({
                'data-id': function (d, i) {return d.id},
                opacity: 0,
                height: 2,
                width: 2,
                x: function (d, i) {
                  return d.x = xScale(peopleInOneRow - rankScale(new Date(d.birthday)) % peopleInOneRow)
                },
                y: function (d, i) {
                  return d.y = yScale(rankScale(new Date(d.birthday)))
                }
              });
            celebsArea.selectAll('rect')
              .transition()
              .delay(function (d, i) {
                return 4000 + _.random(100, 1000)
              })
              .duration(function (d, i) {
                return  _.random(300, 2000)
              })
              .attr({
                opacity: 1
              });
            personNavPointer =
              celebsArea
                .append('circle')
                .attr({
                  'class': function () {
                    return 'person me ' + ProfileService.gender;
                  },
                  r: 0,
                  cx: function (d, i) {
                    return xScale(peopleInOneRow - rankScale(new Date(ProfileService.birthday)) % peopleInOneRow)
                  },
                  cy: yScale(rankScale(new Date(ProfileService.birthday)))
                });
            personNavPointer
              .transition()
              .delay(4000)
              .attr({
                r: 3
              });

//            var startRank, endRank;
//            var drag = d3.behavior.drag()
//              .on('drag', function () {
//                var x = Math.max(0, Math.min(navWidth - lensWidth, d3.event.x - lensWidth / 2));
//                var y = Math.max(0, Math.min(navHeight, d3.event.y - lensHeight / 2));
//
//                this.x = x;
//                this.y = y;
////                startRank = parseInt(xScale2(x + lensWidth) + yScale2(y + lensHeight))
////                startRank = parseInt(xScale2(x + lensWidth) + yScale2(y + lensHeight)) - parseInt(xScale2(x) + yScale2(y));
////                console.log(x, y)
////                console.log(x + lensWidth, y + lensHeight)
//                startRank = parseInt(xScale2(x) + yScale2(y));
//                endRank = parseInt(startRank + peopleInOneRow * 2);
//
//                d3.select(this).select('rect').attr({x: x, y: y});
//              })
//              .on('dragstart', function () {
//                _fadeControls();
//
//              })
//              .on('dragend', function () {
//                _initGrid();
//                _populateCelebsBar();
//                _unfadeControls();
//                _loadProfilePerson();
//                _initCelebTooltip();
//              });


            lens = navigatorArea.append('g')
              .attr({
                class: 'lens',
                opacity: 0,
                transform: utils.translate(0, 0)
              })
              .call(dragFrame);
            lens.append('rect').attr({width: lensWidth, height: 8 * 3});
            lens
              .transition()
              .delay(2000)
              .attr({opacity: 1});

          };

          var _initGrid = function () {

            var celebs = d3.select('.navigator .celebs')
                .selectAll('rect')
              ;
            chart.select('.grid').remove();

            var gridWrapper = chart.append('g').attr({class: 'grid-wrapper'}).attr({ 'clip-path': 'url(#grid-clip)', transform: 'translate(' + personWidth + ', 100)'});


            grid = gridWrapper.append('g')
              .attr({
                class: 'grid',
                opacity: 1,
                transform: utils.translate(0, 0)// + ' scale(0.13)'
              });


            var rows = [];
            _.times(blockData.length, function (i) {rows.push(i * personHeight)});

            var xCols = [];
            for (var i = 0; i < navWidth - 3; i++) {
              xCols.push(i * personWidth)
            }

            var xScale = d3.scale.quantize()
              .domain([peopleInOneRow, 0 ])
              .range(xCols);

            var yScale = d3.scale.quantize()
              .domain([0, _populationTopLimit])
              .range(rows);

            grid.append('rect')
              .attr({
                transform: utils.translate(-personWidth * 30, -personHeight * 30)
              })
              .style({fill: "url(#ghosts-pattern)"}).attr({width: personWidth * xCols.length + personWidth * 60, height: blockData.length * personHeight + personHeight * 60})


            console.log({x: xCols.length, y: rows.length})
            person = grid
              .append('g')
              .attr('class', 'persons-area')
              .selectAll('.person')
              .data(celebs.data())
              .enter()
              .append('g')
              .attr({
                opacity: 0,
                'data-birthday': function (d, i) {return d.birthday},
                'data-id': function (d, i) {
                  return d.id
                },
                class: 'person',
                transform: function (d, i) {
                  var x = xScale(peopleInOneRow - rankScale(new Date(d.birthday)) % peopleInOneRow);
                  var y = yScale(rankScale(new Date(d.birthday)));
                  return utils.translate(x, y)
                }
              })
              .classed('me', function (d, i) {
                return d.name == 'You'
              });
            person
              .transition()
              .delay(function (d, i) {

                return  _.random(3000, 5000)
              })
              .attr({
                opacity: 1
              });
            person.append('rect')
              .attr({
                width: personWidth,
                height: personHeight,
                class: 'background-area'

              })
              .style('fill', 'white');

            var icon = person.append('g')
              .attr({
                class: 'icon',
                transform: 'translate(7.5,10)'
              });
            icon.each(function (d, x) {
              var iconElement = d3.select(this);
              if (!d.gender || d.gender == 'male') {
                iconElement.append('path').attr('d', 'M7.5,5.809c-0.869,0-1.576-0.742-1.576-1.654c0-0.912,0.707-1.653,1.576-1.653 c0.87,0,1.577,0.742,1.577,1.653C9.077,5.067,8.369,5.809,7.5,5.809z');
                iconElement.append('path').attr('d', 'M11.997,16.187c0,0.522-0.405,0.946-0.903,0.946h-0.453V9.59H9.75v16.96c0,0.522-0.405,0.946-0.903,0.946 c-0.493,0-0.895-0.416-0.903-0.931c0-0.005,0-0.01,0-0.015c0-0.004,0-0.009,0-0.012V16.187H7.054v10.364c0,0.006,0,0.01,0,0.015 c-0.007,0.515-0.41,0.931-0.903,0.931c-0.498,0-0.902-0.424-0.902-0.946V9.59H4.358v7.542H3.905c-0.498,0-0.902-0.424-0.902-0.946 V9.119c0-1.301,1.009-2.36,2.25-2.36h4.493c1.241,0,2.251,1.058,2.251,2.36L11.997,16.187L11.997,16.187z');
              }
              else {
                iconElement.append('path').attr('d', 'M7.025,20.425v6.123c0,0.005,0,0.01,0,0.015c-0.008,0.515-0.437,0.931-0.964,0.931 c-0.531,0-0.963-0.424-0.963-0.946v-6.123c0-0.001,0-0.002,0-0.004h1.927C7.025,20.422,7.025,20.423,7.025,20.425z');
                iconElement.append('path').attr('d', 'M9.903,20.425v6.123c0,0.522-0.432,0.946-0.964,0.946c-0.526,0-0.955-0.416-0.963-0.931 c0-0.005,0-0.009,0-0.015c0-0.004,0-0.008,0-0.012v-6.111c0-0.001,0-0.002,0-0.004h1.927C9.903,20.422,9.903,20.423,9.903,20.425z');
                iconElement.append('path').attr('d', 'M11.777,16.874l-1.792-7.39L9.059,9.7l2.374,9.787H3.542L5.916,9.7L4.99,9.484l-1.79,7.384l-0.472-0.111 c-0.517-0.121-0.837-0.631-0.714-1.139l1.711-7.048c0,0,0,0,0.001-0.001c0.259-1.065,1.22-1.808,2.336-1.808h2.878 c1.117,0,2.078,0.744,2.337,1.809l0,0l1.711,7.046c0,0,0,0,0,0.001c0.123,0.508-0.197,1.019-0.714,1.139L11.777,16.874z');
                iconElement.append('path').attr('d', 'M7.501,5.812c-0.928,0-1.683-0.741-1.683-1.653c0-0.911,0.755-1.653,1.683-1.653 c0.928,0,1.683,0.741,1.683,1.653C9.184,5.071,8.429,5.812,7.501,5.812z')

              }
            });
            person.on('mouseenter', _showTooltip);
            person.on('mouseleave', _hideTooltip);
//            firstRun = false;

          };

          function _showTooltip(d, x, y) {
            var personItem = d3.select('.persons-area .person[data-id="' + d.id + '"]');

            var xy = utils.getXYFromTranslate(personItem.attr('transform'))
            navigatorArea.select('rect[data-id="' + d.id + '"]')
              .classed('active', true)
            celebTooltip
              .transition()
              .delay(700)
              .attr({ opacity: 1 });
            if (this) {
              _activateCelebInCelebsBar(d.id);
              var gridXY = utils.getXYFromTranslate(grid.attr('transform'))
              celebTooltip.attr({

                transform: utils.translate(xy[0] + gridXY[0] - celebTooltipWidth / 2 + 30, xy[1] + gridXY[1] + 170)
              });

            }
            else {
              grid
                .transition()
                .duration(600)
                .attr({transform: utils.translate(-xy[0] + gridWidth / 2, -xy[1] + gridHeight / 2)})
              lens
                .transition()
                .duration(600)
                .attr({transform: utils.translate(xy[0] / scaleX - lensWidth / 2, xy[1] / scaleY - lensHeight / 2)})
              celebTooltip.attr({
                transform: utils.translate(gridWidth / 2 - celebTooltipWidth / 2 + 30, gridHeight / 2 + 170)
              });

            }

//            celebTooltipPointerShadow.attr({
//              transform: 'translate(10,20) rotate(45)'
//            });
//            celebTooltipPointer.attr({
//              transform: 'translate(10, 18) rotate(45)'
//            })

//            if (xScale(d.localCellX) < 150 || yScale(d.localCellY) > 220) {
//            }
//            else {
//              celebTooltip.attr({
//                transform: 'translate(' + [xScale(d.localCellX) - (150 - personWidth / 2) + personWidth, yScale(d.localCellY) + personHeight + 120] + ')'
//              });
//              celebTooltipPointerShadow.attr({
//                transform: 'translate(152,-18) rotate(45)'
//              });
//              celebTooltipPointer.attr({
//                transform: 'translate(150,-18) rotate(45)'
//              })
//            }
            celebTooltipImage.attr({
              'xlink:href': function () {
                return d.thumbnail
              }

            });

            celebTooltipTitle.text(function () {
              return d.name
            });

            celebTooltipDetails.text(function () {
              return d.country + ', ' + d.birthday
            });
            celebTooltipRank.text(function () {
              return d.rank
            })
          }

          function _hideTooltip() {
            celebTooltip
              .attr({
                opacity: 0,
                transform: 'translate(-200,-200)'
              })
            navigatorArea.selectAll('rect').classed('active', false)
            _activateCelebInCelebsBar();
          }

          function _activateCelebInCelebsBar(id) {
            var celebs = celebsRoll.selectAll('.celeb').data();


            if (id) {
              currentCeleb = _.findIndex(celebs, function (celeb, index) {
                return celeb.id == id
              });
              celebsRoll
                .transition()
                .attr({
                  transform: 'translate(' + [rollScale(currentCeleb - 2), 0] + ')'
                })
              var currentCelebElement = celebsRoll.select('.celeb[data-local-id="' + currentCeleb + '"]');
              var currentCelebElementInGrid = celebsRoll.select('.person[data-id="' + id + '"]');
              currentCelebElement
                .select('circle')
                .transition()
                .delay(500)
                .attr({
                  r: 70
                })
              currentCelebElement
                .select('image')
                .attr({
                  'xlink:href': function (d, i) {
                    return d.thumbnail
                  }
                })

              var startRange = currentCeleb - 4;
              var celebsInBar = celebsRoll.selectAll('.celeb');
              celebsInBar.each(function (d, i) {
                if (i == startRange) {
                  console.log(d.id)
                }
                if (i > startRange && i <= startRange + 10) {
                  d3.select(this)
                    .select('image')
                    .attr({
                      'xlink:href': function (d, i) {
                        return d.thumbnail
                      }
                    })
                }
              })


              nextCelebsButton.style({
                display: function () {
                  return currentCeleb >= celebs.length - 1 ? 'none' : 'block';
                }
              })
              prevCelebsButton.style({
                display: function () {
                  return currentCeleb <= 2 ? 'none' : 'block';
                }
              })


            }
            else {
              if (currentCeleb + 2 >= celebs.length - 1) {
                celebsRoll
                  .transition()
                  .attr({
                    transform: 'translate(' + [rollScale(celebs.length - celebsInCelebsBar), 0] + ')'
                  })
              }
              else if (currentCeleb <= 2) {
                celebsRoll
                  .transition()
                  .attr({
                    transform: 'translate(' + [0, 0] + ')'
                  })
              }
              celebsRoll.selectAll('circle')
                .transition()
                .attr({r: 20})

            }
          }

          var _fadeControls = function () {
            grid
              .transition()
              .attr('opacity', 0.2);
            celebsBar
              .transition()
              .attr('opacity', 0.2);
          };
          var _unfadeControls = function () {
            grid
              .transition()
              .attr('opacity', 1);
            celebsBar
              .transition()
              .attr('opacity', 1);
          };

          function _initCelebTooltip() {
            chart.select('.celeb-tooltip').remove();
            celebTooltip = chart.append('g')
              .attr({
                class: 'celeb-tooltip',
                transform: 'translate(-200,-200)'
              });
            celebTooltip.append('rect')
              .style('fill', 'rgba(0,0,0,0.2)')
              .attr({
                class: 'box-shadow',
                width: celebTooltipWidth,
                height: 100,
                rx: 10,
                ry: 10,
                x: 2,
                y: 2
              });
            celebTooltipPointerShadow = celebTooltip.append('rect')
              .style('fill', 'rgba(0,0,0,0.2)')
              .attr({
                class: 'pointer-shadow',
                width: 40,
                height: 40,
                rx: 5,
                ry: 5,
                transform: 'translate(154,-18) rotate(45)'
              });

            celebTooltip.append('rect')
              .style('fill', '#ff6')
              .attr({
                width: 270,
                height: 100,
                rx: 10,
                ry: 10
              });
            celebTooltipPointer = celebTooltip.append('rect')
              .style('fill', '#ff6')
              .attr({
                class: 'pointer',
                width: 40,
                height: 40,
                rx: 5,
                ry: 5,
                transform: 'translate(150,-20) rotate(45)'
              });
            celebTooltip.append('line')
              .style({
                stroke: 'rgba(0,0,0,0.2)',
                'stroke-width': 1
              })
              .attr({
                x1: 80,
                y1: 60,
                x2: 240,
                y2: 60
              });
            celebTooltipTitle = celebTooltip.append('text')
              .attr({
                class: 'celeb-tooltip-title',
                transform: 'translate(80,30)'
              })
              .text('');
            celebTooltipImage = celebTooltip
              .append('image').attr(
              {
                width: 40,
                height: 40,
                x: -20,
                y: -20,
                'clip-path': 'url(#rounded-corners-clip)',
                transform: 'translate(40,40)'


              }
            );
            celebTooltipDetails = celebTooltip.append('text')
              .attr({
                class: 'celeb-tooltip-details',
                transform: 'translate(80,50)'
              })
              .text('');
            celebTooltipRank = celebTooltip.append('text')
              .attr({
                class: 'celeb-tooltip-rank',
                transform: 'translate(80,80)'
              })
              .text('')

          }

          function _initDefs() {
            var defs = chart.append("defs");
            var roundedCornersClip = defs.append("clipPath")
              .attr("id", "rounded-corners-clip")
              .append("circle")
              .attr("id", "clip-circle")
              .attr("cx", 0)
              .attr("cy", 0)
              .attr("r", 20);
            var celebsRollClip = defs.append("clipPath")
              .attr("id", "celebs-roll-clip")
              .append("rect")
              .attr("id", "clip-rect")
              .attr("x", 0)
              .attr("y", 0)
              .attr("width", (parentWidth - 200 - 300))
              .attr("height", 200);
            var gridClip = defs.append("clipPath")
              .attr("id", "grid-clip")
              .append("rect")
              .attr({
                id: "clip-rect",
                x: 0,
                y: 0,
                width: gridWidth,
                height: gridHeight
              })

            var ghostsPattern = defs.append('pattern')
              .attr({id: 'ghosts-pattern',
                x: 0,
                y: 0,
                width: personWidth,
                height: personHeight,
                patternUnits: "userSpaceOnUse"
              });

//            ghostsPattern.append('rect').attr({x: 0, y: 0, width: personWidth - 1, height: personHeight - 1, fill: '#eee'});
            var ghostsPatternIcon = ghostsPattern.append('g').attr({class: 'icon', transform: utils.translate(7.5, 10)});
            ghostsPatternIcon.append('path').attr({d: 'M7.5,5.809c-0.869,0-1.576-0.742-1.576-1.654c0-0.912,0.707-1.653,1.576-1.653 c0.87,0,1.577,0.742,1.577,1.653C9.077,5.067,8.369,5.809,7.5,5.809z', fill: '#ccc'});
            ghostsPatternIcon.append('path').attr({d: 'M11.997,16.187c0,0.522-0.405,0.946-0.903,0.946h-0.453V9.59H9.75v16.96c0,0.522-0.405,0.946-0.903,0.946 c-0.493,0-0.895-0.416-0.903-0.931c0-0.005,0-0.01,0-0.015c0-0.004,0-0.009,0-0.012V16.187H7.054v10.364c0,0.006,0,0.01,0,0.015 c-0.007,0.515-0.41,0.931-0.903,0.931c-0.498,0-0.902-0.424-0.902-0.946V9.59H4.358v7.542H3.905c-0.498,0-0.902-0.424-0.902-0.946 V9.119c0-1.301,1.009-2.36,2.25-2.36h4.493c1.241,0,2.251,1.058,2.251,2.36L11.997,16.187L11.997,16.187z', fill: '#ccc'});

          }

          function _initCelebsBar() {
            chart.select('.celebrities-bar').remove()
            celebWidth = (parentWidth - 200 - 300) / celebsInCelebsBar;
            celebsBar = chart.append('g')
              .attr({
                class: 'celebrities-bar',
                transform: 'translate(100,550)',
                opacity: 1
              });
            celebsBar.append('rect')
              .attr(
              {
                fill: 'rgba(0,0,0,0.01)',
                width: parentWidth - 200,
                height: 100,
                transform: 'translate(0,0)'

              }
            );
            celebsBar.append('rect')
              .attr(
              {
                fill: '#ccc',
                width: parentWidth - 200,
                height: 1,
                transform: 'translate(0,0)'

              }
            );
            celebsBar.append('rect')
              .attr(
              {
                fill: '#ccc',
                width: parentWidth - 200,
                height: 1,
                transform: 'translate(0,99)'

              }
            );
            celebsBar.append('rect')
              .attr(
              {
                fill: '#eee',
                width: parentWidth - 200,
                height: 1,
                transform: 'translate(0,50)'

              }
            );

            rollScale = d3.scale.linear();

            var celebsRollWrapper = celebsBar.append('g').attr('class', 'celebs-roll-wrapper').attr('transform', 'translate(150,0)');
            celebsRollWrapper.attr(
              {
                'clip-path': 'url(#celebs-roll-clip)'
              }
            );

            celebsRoll = celebsRollWrapper.append('g').attr('class', 'celebs-roll');
            prevCelebsButton = celebsBar.append('g').attr('class', 'prev-celebs-button').attr('transform', 'translate(' + [70, 50] + ')').style('display', 'none');
            nextCelebsButton = celebsBar.append('g').attr('class', 'next-celebs-button').attr('transform', 'translate(' + [parentWidth - 200 - 70, 50] + ')');
            nextCelebsButton
              .on('mouseenter', function () {
                d3.select(this).select('circle').transition().attr('r', 24)
              })
              .on('mouseleave', function () {
                d3.select(this).select('circle').transition().attr('r', 20)
              });
            prevCelebsButton
              .on('mouseenter', function () {
                d3.select(this).select('circle').transition().attr('r', 24)
              })
              .on('mouseleave', function () {
                d3.select(this).select('circle').transition().attr('r', 20)
              });
            celebsRoll.append('rect')
              .attr(
              {
                fill: 'transparent',
                width: parentWidth - 200 - 300,
                height: 100

              });

            prevCelebsButton.append('circle')
              .attr(
              {
                fill: '#fff',
                'stroke-width': 1,
                stroke: '#ccc',
                r: 20,
                cx: 0,
                cy: 0
              }
            );
            prevCelebsButton.append('polygon')
              .attr(
              {
                fill: '#444',
                points: '10.002,4.503 1.906,4.503 5.224,1.198 4.519,0.496 -0.002,5 4.519,9.504 5.224,8.802 1.906,5.497 10.002,5.497',
                transform: 'translate(-5,-5)'

              }
            );
            nextCelebsButton.append('circle')
              .attr(
              {
                fill: '#fff',
                'stroke-width': 1,
                stroke: '#ccc',
                r: 20,
                cx: 0,
                cy: 0
              }
            );
            nextCelebsButton.append('polygon')
              .attr(
              {
                fill: '#444',
                points: '-0.002,4.503 8.094,4.503 4.776,1.198 5.481,0.496 10.002,5 5.481,9.504 4.776,8.802 8.094,5.497 -0.002,5.497',
                transform: 'translate(-5,-5)'

              }
            )

          }

          function _populateCelebsBar() {
            currentCeleb = 0;
            var celebs = person.data()


            rollScale
              .domain([0, celebs.length])
              .range([0, -celebWidth * celebs.length]);
            celebsRoll.selectAll('.celeb').remove();
            celebsRoll.attr({transform: 'translate(0,0)'});
            prevCelebsButton.style('display', 'none');


            nextCelebsButton
              .on('click', function () {

                if (currentCeleb >= celebs.length - celebsInCelebsBar * 2) {
                  currentCeleb = celebs.length - celebsInCelebsBar;
                  nextCelebsButton.style('display', 'none')
                } else {
                  currentCeleb += celebsInCelebsBar;
                  nextCelebsButton.style('display', 'block')
                }
                if (currentCeleb > 0) {
                  prevCelebsButton.style('display', 'block')
                } else {
                  prevCelebsButton.style('display', 'block')
                }
                celebsRoll
                  .transition()
                  .attr({transform: utils.translate(rollScale(currentCeleb), 0)});
                var startRange = currentCeleb - 2;
                var celebsInBar = celebsRoll.selectAll('.celeb');
                celebsInBar.each(function (d, i) {
                  if (i == startRange) {
                    console.log(d.id)
                  }
                  if (i > startRange && i <= startRange + 6) {
                    d3.select(this)
                      .select('image')
                      .attr({
                        'xlink:href': function (d, i) {
                          return d.thumbnail
                        }
                      })
                  }
                })
              });

            prevCelebsButton
              .on('click', function () {
                if (currentCeleb < celebsInCelebsBar * 2) {
                  currentCeleb = 0;
                  prevCelebsButton.style('display', 'none')
                }
                else {
                  currentCeleb -= celebsInCelebsBar;
                  prevCelebsButton.style('display', 'block')
                }

                if (currentCeleb >= celebs.length - celebsInCelebsBar - 1) {
                  nextCelebsButton.style('display', 'none')
                } else {
                  nextCelebsButton.style('display', 'block')
                }


                celebsRoll
                  .transition()
                  .attr({transform: 'translate(' + [rollScale(currentCeleb), 0] + ')'})
                var startRange = currentCeleb - 2;
                var celebsInBar = celebsRoll.selectAll('.celeb');
                celebsInBar.each(function (d, i) {
                  if (i == startRange) {
                    console.log(d.id)
                  }
                  if (i > startRange && i <= startRange + 6) {
                    d3.select(this)
                      .select('image')
                      .attr({
                        'xlink:href': function (d, i) {
                          return d.thumbnail
                        }
                      })
                  }
                })

              });

            var celeb = celebsRoll.selectAll('.celeb')
              .data(celebs)
              .enter()
              .append('g')
              .attr({
                class: 'celeb',
                'data-local-id': function (d, i) {return i},
                transform: function (d, i) {
                  return 'translate(' + [i * celebWidth, 0] + ')'
                }
              });
            celeb.append('circle').attr(
              {
                fill: 'white',
                r: 20,
                cx: celebWidth / 2,
                cy: 50,
                'stroke-width': 1,
                stroke: '#ccc'


              }
            );
            celeb.append('image').attr(
              {
                width: 40,
                height: 40,
                x: -20,
                y: -20,
                'clip-path': 'url(#rounded-corners-clip)',
                transform: 'translate(' + [celebWidth / 2, 50] + ')'
              }
            );
            celeb.append('text')
              .style(
              {
                fill: '#444',
                'font-size': 12,
                'text-anchor': 'middle'
              }
            )
              .attr({
                transform: 'translate(' + [celebWidth / 2, 0] + ')',
                dy: 87
              })
              .text(function (d, i) {
                return d.name
              });

            celeb.append('rect').attr(
              {
                width: celebWidth,
                height: 100,
                x: 0,
                y: 0
              }
            )
              .style({
                fill: 'transparent'
              })
            ;
            var ghost = celebsRoll.selectAll('.ghost')
              .data([0, 1, 2, 3])
              .enter()
              .append('g')
              .attr({
                class: 'ghost',
                transform: function (d, i) {
                  if (i < 2) {
                    return 'translate(' + [0 - (i + 1) * celebWidth, 0] + ')'
                  }
                  else {
                    return 'translate(' + [-rollScale(celebs.length - 2 + i), 0] + ')'
                  }
                }
              });
            ghost.append('circle').attr(
              {
                fill: '#eee',
                r: 20,
                cx: celebWidth / 2,
                cy: 50,
                'stroke-width': 1,
                stroke: '#eee'


              }
            );
            ghost.append('rect').attr(
              {
                width: celebWidth,
                height: 100,
                x: 0,
                y: 0
              }
            )
              .style({
                fill: 'transparent'
              })
            ;
            $timeout(function () {
              var me = d3.select('.persons-area').select('.person.me');
              var xy = utils.getXYFromTranslate(me.attr('transform'));
              _activateCelebInCelebsBar(me.attr('data-id'));
              _showTooltip(me.datum(), xy[0], xy[1]);
            }, 3000)

            celeb.on('mouseenter', function (d, i) {
              d3.selectAll('.celeb')
                .select('circle')
                .transition()
                .attr({
                  r: 20
                })

              d3.select(this)
                .select('circle')
                .transition()
                .attr({
                  r: 70
                })

              var personInGrid = grid.select('.person[data-id="' + d.id + '"]');
              personInGrid.moveToFront()
              d3.select(this).select('image')
                .attr({
                  'xlink:href': function (d, i) {
                    return d.thumbnail
                  }
                })


              var xy = utils.getXYFromTranslate((personInGrid.attr('transform')));
              _showTooltip(d, xy[0], xy[1])

              personInGrid.classed('highlighted', true)
            });
            celeb.on('mouseleave', function (d, i) {
              d3.select(this)
                .select('circle')
                .transition()
                .attr({
                  r: 20
                })

              var allPersonsInGrid = grid.selectAll('.person');
              allPersonsInGrid.classed('highlighted', false)
              _hideTooltip(d, i)
            })
          }

          $scope.$watch(function () {
            return ProfileService.active;
          }, function (active) {
            if (active) {
              _buildNavigator();
              _initGrid();
//              _loadCelebrities();
//
              _initCelebsBar();
              _initCelebTooltip();
              _populateCelebsBar();

            }
          });
          $scope.$watch('rankLocal', function (rank) {
            if (rank) {
//              console.log(rank)
//              console.log($scope.rankLocalTotal)
              _updateLocalBar(rank, $scope.rankLocalTotal);
            }
          });

          $scope.$watch('rankGlobal', function (rank) {
            if (rank) {
              _updateGlobalBar(rank, $scope.rankGlobalTotal);
            }
          });

          _buildBarChart();
        }
      };
    });

}());