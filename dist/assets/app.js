/*eslint-globals L*/
/*eslint-env browser*/
(function () {

    'use strict';

    var regionsGeoJson;
    var regionsShapes;

    var map, popupTpl, modalTpl, regionsListContainer, regionListItemTpl, datePickerItemTpl, datePickerStatusTpl, datePickerContainers;
    var markerClusters;

    var features = [];

    var filterFunctions = {
      checkboxes: function(filter, feature) {
        var featureFiltered = feature.properties[filter.field];
        var featureFilters = filter.values;
        // ignore filter if field is empty     filter passes when field matches filter
        return !featureFiltered || featureFiltered.length === 0 || _.intersection(featureFiltered, featureFilters).length
      },
      date: function(filter, feature) {
        console.log(filter)
        var featureFilteredStart = feature.properties[filter.field_start];
        var featureFilteredEnd = feature.properties[filter.field_end];
        var featureFiltersStart = filter.start;
        var featureFiltersEnd = filter.end;

        var isAfterStart = !featureFilteredStart || moment(featureFilteredStart, filter.format).isAfter( moment(featureFiltersStart, filter.format) );
        var isBeforeEnd = !featureFilteredEnd || moment(featureFilteredEnd, filter.format).isBefore( moment(featureFiltersEnd, filter.format) );

        return isAfterStart && isBeforeEnd;
      },
    }

    function buildFeatures(data) {
        L.geoJson(data, {
            onEachFeature: function (feature, layer) {
                var popupData = feature.properties;
                var popup = L.popup().setContent( popupTpl( {data: popupData, internalIndex: features.length }) );
                layer.bindPopup(popup);
                feature.layer = layer;
                feature.show = true;
                features.push(feature);
            }
        });

        markerClusters = new L.MarkerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 40,
            spiderfyDistanceMultiplier: 2
        });

        renderMarkers();
    }

    function renderMarkers() {
      features.forEach(function(feature) {
        if (feature.show) {
          markerClusters.addLayer(feature.layer);
        } else {
          markerClusters.removeLayer(feature.layer);
        }
      })
      map.addLayer(markerClusters);
    }

    function filterMarkers(filters) {
      features.forEach(function(feature) {
        // flag feature for show/hide in later renderMarkers
        feature.show = filters.every(function(filter) {
          return filterFunctions[filter.type](filter, feature);
        })
      })
      renderMarkers();
    }

    function updateFilters(newDate) {
        function updateCheckboxList(name) {
            var values = _.map( $('#' + name + ' input'), function(el) {return el.checked; });
            $('[data-countof=' + name + ']').text( _.contains(values, false) ? _.compact(values).length + '/' + values.length : 'toutes' );
        }
        updateCheckboxList('actionType');
        updateCheckboxList('population');

        if (newDate) {
          newDate.parents('.dropdown-menu').data('date', newDate.data().date);
          newDate.parents('.dropdown-menu').data('dateFormatted', newDate.html());
        }

        $('.js-filter-dates-start-month .js-lbl').html( datePickerContainers.startMonth.data('dateFormatted') )
        $('.js-filter-dates-start-year .js-lbl').html( datePickerContainers.startYear.data('dateFormatted') )
        $('.js-filter-dates-end-month .js-lbl').html( datePickerContainers.endMonth.data('dateFormatted') )
        $('.js-filter-dates-end-year .js-lbl').html( datePickerContainers.endYear.data('dateFormatted') )

        $('.js-filter-dates-status').html(datePickerStatusTpl({
          startMonth: moment.monthsShort()[datePickerContainers.startMonth.data('date')],
          endMonth: moment.monthsShort()[datePickerContainers.endMonth.data('date')],
          startYear: datePickerContainers.startYear.data('date'),
          endYear: datePickerContainers.endYear.data('date')
        }));
    }

    function getFilters() {
        // build a list of filters activated in the panels
        var filters = [];
        var filterCheckboxes = $('.js-filter-checkboxes');
        filterCheckboxes.each(function(index, el) {
          var field = $(el).data().filterCheckboxesField;
          var filter = {
            type: 'checkboxes',
            field: field,
            values: []
          }
          $(el).find('input').each(function(inputIndex, inputEl) {
            if ($(inputEl).is(':checked')) {
              filter.values.push($(inputEl).data().filterCheckboxValue);
            }
          })
          filters.push(filter);
        });

        var dateFormat = $('.js-filter-dates').data().filterDatesFormat;
        var dateFilter = {
          type: 'date',
          field_start: $('.js-filter-dates').data().filterDatesFieldStart,
          field_end: $('.js-filter-dates').data().filterDatesFieldEnd,
          format: dateFormat,
          start: moment({
            month:  datePickerContainers.startMonth.data('date'),
            year:  datePickerContainers.startYear.data('date')
          }).format(dateFormat),
          end: moment({
            month:  datePickerContainers.endMonth.data('date'),
            year:  datePickerContainers.endYear.data('date')
          }).format(dateFormat)
        }
        filters.push(dateFilter);

        return filters;
    }


    function initRegionsListEvents() {
        regionsListContainer.find('a').on('click', function (e) {
            var latlonStr = $(e.currentTarget).data('latlon');
            var latlon = latlonStr.split(',');

            //shift a bit to the west to compensate space taken by right controls
            //TODO : only desktop
            latlon[1] = parseFloat(latlon[1]) + 1;
            map.setView(latlon, 8);

            if (regionsShapes) {
                map.removeLayer(regionsShapes);
            }

            regionsShapes = L.geoJson(regionsGeoJson, {
                filter: function(feature) {
                    return feature.properties.NAME_2 === $(this).html();
                }.bind(this)
            }).addTo(map);
        });
    }

    function initDatePicker() {

      datePickerContainers = {
        startMonth: $('.js-filter-dates-start-month .dropdown-menu'),
        startYear: $('.js-filter-dates-start-year .dropdown-menu'),
        endMonth: $('.js-filter-dates-end-month .dropdown-menu'),
        endYear: $('.js-filter-dates-end-year .dropdown-menu')
      }

      var initialDate = moment('2010-01-01');
      var today = moment();
      var current = initialDate.clone();

      moment.months().forEach(function(month, index) {
        var d = {
          dateFormatted: month,
          date: index
        };
        datePickerContainers.startMonth.append(datePickerItemTpl(d));
        datePickerContainers.endMonth.append(datePickerItemTpl(d));

        if (index === initialDate.month()) datePickerContainers.startMonth.data(d);
        if (index === today.month()) datePickerContainers.endMonth.data(d);
      });


      while(current.isBefore(today)) {
        var d = {
          dateFormatted: current.year(),
          date: current.year()
        };
        datePickerContainers.startYear.append(datePickerItemTpl(d));
        datePickerContainers.endYear.append(datePickerItemTpl(d));

        if (current.year() === initialDate.year()) datePickerContainers.startYear.data(d);
        if (current.year() === today.year()) datePickerContainers.endYear.data(d);

        current.add(1, 'years');
      }
    }

    function openModal(link) {
        var index = $(link).parents('.js-popup').data().index;
        var data = features[index].properties;
        var modalDom = modalTpl({data: data});

        $(modalDom).modal();
    }

    function init() {
        map = L.map('map', {
            center: [-18.766947, 49],
            zoom: 6,
            minZoom: 4,
            maxZoom: 10
        });

        L.tileLayer('http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png').addTo(map);


        popupTpl = _.template( $('.js-tpl-popup').html() );
        modalTpl = _.template( $('.js-tpl-modal').html() );

        regionsListContainer = $('.js-regions');
        regionListItemTpl = _.template('<li><a href="#" data-latlon="<%= center %>"><%= name %></a></li>');
        datePickerItemTpl = _.template('<li><a href="#" data-date="<%= date %>"><%= dateFormatted %></a></li>');
        datePickerStatusTpl = _.template('<%= startMonth %> <%= startYear %> → <%= endMonth %> <%= endYear %>');

        moment.locale(window.appConfig.locale);
        if ($('.js-filter-dates').length) initDatePicker();

        // initialize filters count without actually filtering (geoJSON no there yet)
        updateFilters();


        //move that to a sass loop later :)
        _.each($('#actionType .checkboxList input'), function(el, index) {
          $('<span class="icon"></span>').insertBefore(el).css('background-position', '-' + index * 30 + 'px' + ' 0');
        });

        _.each($('#population .checkboxList input'), function(el, index) {
          $('<span class="icon"></span>').insertBefore(el).css('background-position', '-' + index * 30 + 'px' + ' 0');
        });


        $('.js-showfilters').on('click', function () {
          $('.js-filters').addClass('opened');
        });

        $('.js-closeFilters').on('click', function() {
          $('.js-filters').removeClass('opened');
        });

        $('.js-filter-checkboxes input').on('change', function () {
          updateFilters();
          filterMarkers(getFilters());
        });

        $('.js-filter-dates li').on('click', function(e) {
          updateFilters($(e.target));
          filterMarkers(getFilters());
        })

        $.ajax(window.appConfig.testDataPath).done( buildFeatures );
        // $.ajax('http://195.154.35.191:8000/geoactions/').done( buildMarkers );

        $.getJSON( window.appConfig.faritraGeoJsonPath, function(geojson) {
            regionsGeoJson = geojson;
            regionsShapes = L.geoJson(geojson, {
                onEachFeature: function(feature, layer) {
                    var center = layer.getBounds().getCenter();
                    var regionListItem = regionListItemTpl({
                        name: feature.properties.NAME_2,
                        center: center.lat + ',' + center.lng
                    });
                    $(regionListItem).appendTo(regionsListContainer);
                }
            });

            initRegionsListEvents();
        } );


        $('#map').on('click', '.js-openContentModal', function(e) {
            e.preventDefault();
            openModal(e.target);
        });


    }

    init();



})();
