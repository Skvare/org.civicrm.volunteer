(function(angular, $, _) {
  // Declare a list of dependencies.
  angular
    .module('volunteer', CRM.angRequires('volunteer'))

    // Makes lodash/underscore available in templates
    .run(function($rootScope) {
      $rootScope._ = _;
    })

    // The public opportunity browser and project management UI share this
    // Angular module, but CiviCRM selects separate frontend/backend themes from
    // the server-side host route. Redirect historical public-host management
    // URLs so administrative screens use the configured backend theme.
    .run(function($rootScope, $location, $window) {
      $rootScope.$on('$routeChangeStart', function(event) {
        if (!(CRM.config && CRM.config.isFrontend)
          || !/^\/volunteer\/manage(?:\/|$)/.test($location.path())) {
          return;
        }

        event.preventDefault();
        var backendHost = CRM.url('civicrm/volunteer/manage', null, 'back');
        $window.location.replace(backendHost + '#' + $location.url());
      });
    })

    // Show/hide "loading" spinner between routes
    .run(function($rootScope) {
      $rootScope.$on('$routeChangeStart', function() {
        CRM.$('#crm-main-content-wrapper').block();
      });

      $rootScope.$on('$routeChangeSuccess', function() {
        CRM.$('#crm-main-content-wrapper').unblock();
      });

      $rootScope.$on('$routeChangeError', function() {
        CRM.$('#crm-main-content-wrapper').unblock();
      });

      // the first route that is loaded fires a $routeChangeSuccess event on
      // completing load, but it doesn't raise $routeChangeStart when it starts,
      // so we will just start the app with the spinner going
      CRM.$('#crm-main-content-wrapper').block();
    })

    // Administrative routes share this Angular module with the public
    // opportunity browser. Server-side callbacks and APIs remain authoritative;
    // this guard gives a clear client-side denial when someone changes only the
    // public page's hash to an administrative route.
    .factory('volProjectManagementAccess', function($q) {
      return function() {
        var allowed = CRM.checkPerm('create volunteer projects')
          || CRM.checkPerm('edit own volunteer projects')
          || CRM.checkPerm('edit all volunteer projects');
        if (allowed) {
          return true;
        }

        var message = CRM.ts('org.civicrm.volunteer')('You do not have permission to manage volunteer projects.');
        CRM.alert(message, CRM.ts('org.civicrm.volunteer')('Access denied'), 'error');
        return $q.reject({is_error: 1, error_message: message});
      };
    })

    // The Search Kit hours report exposes contact-level data across all
    // projects. Keep its workflow tab aligned with the report page and API4
    // entity instead of treating ordinary project-edit access as sufficient.
    .factory('volHoursReportAccess', function($q) {
      return function() {
        var allowed = CRM.checkPerm('edit all volunteer projects')
          && CRM.checkPerm('view all contacts');
        if (allowed) {
          return true;
        }

        var message = CRM.ts('org.civicrm.volunteer')('You do not have permission to view the volunteer hours report.');
        CRM.alert(message, CRM.ts('org.civicrm.volunteer')('Access denied'), 'error');
        return $q.reject({is_error: 1, error_message: message});
      };
    })

    .factory('volOppSearch', ['crmApi4', '$location', '$route', function(crmApi4, $location, $route) {
      //Search params and results are stored here and assigned by reference to the form
      var volOppSearch = {};
      var result = {};

      /**
       * This translates the url params with nested key names
       * into a complex object format that Angular can assign to form objects
       * VOL-240
       *
       * @param params
       * @returns complex object
       */
      var parseQueryParams = function(params) {
        var returnParams = {};
        _.each(params, function(value, name) {
          //Get the base name. will return whole key if no mathing bracket is found.
          var basename = name.replace(/([^\[]*)\[.*/g, "$1");
          //If we have subkeys
          if (basename.length < name.length) {
            var tmp = returnParams[basename] || {};
            //This gives us an array of the key of each level
            var path = name.replace(basename + "[", "").slice(0, -1).split("][");
            var ptr = tmp;
            var last = path.length - 1;
            for(var i in path) {
              //Set the value
              if (i == last) {
                ptr[path[i]] = value;
              } else {
                //If the path doesn't exist, create it.
                if(!ptr.hasOwnProperty(path[i])) {
                  ptr[path[i]] = {};
                }
                //Move the Pointer
                ptr = ptr[path[i]];
              }
            }
            //Set the value in our return object.
            returnParams[basename] = tmp;
          } else {
            returnParams[basename] = value;
          }
        });

        // The radius field is of type number; Angular errors if the value is a string
        if (returnParams['proximity'] && returnParams['proximity']['radius']) {
          returnParams['proximity']['radius'] = parseFloat(returnParams['proximity']['radius']);
        }

        // Angular preserves the brackets in `role_id[]=4`, so the generic
        // nested parser above represents it as {'': '4'}. Normalize both that
        // bookmark form and repeated role_id[] values for the multi-select and
        // the API4 array parameter.
        angular.forEach(['role_id', 'selected'], function(key) {
          if (!returnParams[key]) {
            return;
          }
          var values = angular.isArray(returnParams[key])
            ? returnParams[key]
            : (angular.isObject(returnParams[key])
              ? _.values(returnParams[key])
              : [returnParams[key]]);
          returnParams[key] = _.flatten(values);
        });

        return returnParams;
      };

      volOppSearch.params = parseQueryParams($route.current.params);

      /**
       * Formats the search params for bookmarkable links.
       *
       * @return string
       */
      var buildQueryString = function () {
        // VOL-187: The beneficiary widget is an entityRef; it expects values as CSV rather than an array.
        if (volOppSearch.params.beneficiary && typeof volOppSearch.params.beneficiary !== "string") {
          volOppSearch.params.beneficiary = volOppSearch.params.beneficiary.join(',');
        }

        // clean up the URL by filtering out those params with falsy values
        var cleanUpSearchParams = function (params) {
          return _.transform(params, function (result, value, key) {
            if (typeof value == 'object') {
              result[key] = cleanUpSearchParams(value);
            } else if (value) {
              result[key] = value;
            }
          });
        };
        var searchParams = cleanUpSearchParams(volOppSearch.params);

        // jQuery.param properly handles complex objects (recursively); if we don't do this,
        // we end up with URLs like "proximity=[Object]"
        return CRM.$.param(searchParams);
      }

      /**
       * Translate the form's filter names into API4 parameter names.
       *
       * The form and the bookmarkable URL keep APIv3's snake_case names;
       * API4 action parameters are camelCase, and API4 refuses an unknown
       * parameter outright rather than ignoring it.
       *
       * @param params
       * @returns object
       */
      var toApi4SearchParams = function(params) {
        var map = {
          beneficiary: 'beneficiary',
          project: 'project',
          proximity: 'proximity',
          role_id: 'roleId',
          date_start: 'dateStart',
          date_end: 'dateEnd',
          timeFilter: 'timeFilter',
          campaign_id: 'campaignId'
        };
        var api4Params = {};
        angular.forEach(map, function(api4Name, formName) {
          var value = params[formName];
          if (value === undefined || value === null || value === '') {
            return;
          }
          if (angular.isObject(value) && !angular.isArray(value) && _.isEmpty(value)) {
            return;
          }
          api4Params[api4Name] = value;
        });
        return api4Params;
      };

      volOppSearch.search = function() {
        //Update the URL for bookmarkability
        $location.search(buildQueryString());

        // VOL-187: The beneficiary widget is an entityRef, so the value arrives as CSV rather than an array.
        if (volOppSearch.params.beneficiary && typeof volOppSearch.params.beneficiary === "string") {
          volOppSearch.params.beneficiary = volOppSearch.params.beneficiary.split(',');
        }

        // API4 resolves to the rows themselves rather than an APIv3 envelope.
        // Replace the visible rows only after a successful response. A failed
        // geocode should leave the last valid result set in place while the
        // user corrects the location fields.
        return crmApi4('VolunteerNeed', 'search', toApi4SearchParams(volOppSearch.params))
          .then(function(needs) {
            result = needs;
          });
      };

      // Selection state belongs in the hash URL so Back to shifts can restore
      // the cart without issuing another signup or relying on browser memory.
      volOppSearch.setSelected = function(ids) {
        volOppSearch.params.selected = (ids || []).map(String);
        if (!volOppSearch.params.selected.length) {
          delete volOppSearch.params.selected;
        }
        // Replace rather than push. Picking six shifts would otherwise leave
        // six history entries, so the Back gesture -- the primary way people
        // navigate on a phone -- rewinds the cart one shift at a time instead
        // of leaving the page. Filter changes still push, because there Back
        // undoing the filter is what the user means.
        $location.search(buildQueryString()).replace();
      };

      volOppSearch.returnContext = function(ids) {
        volOppSearch.setSelected(ids);
        var query = buildQueryString();
        return '/volunteer/opportunities' + (query ? '?' + query : '');
      };

      //We are returning this as a function because there is a bug that causes
      //the 'result' to be unbound on the client side (eg, the listing is never refreshed)
      //this function acts as a closure and maintains binding
      volOppSearch.results = function results() { return result; };

      return volOppSearch;

    }])


    // Example: <div crm-vol-perm-to-class></div>
    // Adds a class to the element for each volunteer permission the user has.
    // This does not provide security but a better UX; i.e., don't show me
    // buttons I can't use.
    .directive('crmVolPermToClass', function(crmApi4) {
      return {
        restrict: 'A',
        scope: {},
        link: function (scope, element, attrs) {
          var classes = [];
          crmApi4('VolunteerUtil', 'getPermissions').then(function(perms) {
            angular.forEach(perms, function(value) {
              if (CRM.checkPerm(value.name) === true) {
                classes.push('crm-vol-perm-' + value.safe_name);
              }
            });

            $(element).addClass(classes.join(' '));
          });
        }
      };
    })


    /**
     * This is a service for loading the backbone-based volunteer UIs (and their
     * prerequisite scripts) into angular routes.
     */
    .factory('volBackbone', function(crmApi4, $q) {

      var loadPromise = null;
      var ts = CRM.ts('org.civicrm.volunteer');

      // This was done as a recursive function because the scripts must execute in order.
      function loadNextScript(scripts, callback, fail) {
        var script = scripts.shift();
        // Not $.getScript(): that hard-codes cache:false, appending a fresh
        // timestamp to every request and re-downloading the whole Backbone
        // stack each time a dialog opens. The URLs already carry CiviCRM's
        // resource cache code, so they are safe to cache and are invalidated by
        // a resource flush.
        CRM.$.ajax({url: script, dataType: 'script', cache: true})
          .done(function(scriptData, status) {
            if(scripts.length > 0) {
              loadNextScript(scripts, callback, fail);
            } else {
              callback();
            }
          }).fail(function(jqxhr, settings, exception) {
            var detail = exception && (exception.message || exception.toString());
            var status = jqxhr.status ? 'HTTP ' + jqxhr.status : settings;
            fail({
              is_error: 1,
              error_message: ts('Unable to load a required volunteer-management script: %1 (%2)', {
                1: script,
                2: [status, detail].filter(Boolean).join(': ')
              }),
              exception: exception
            });
          });
      }

      function loadSettings(settings) {
        CRM.$.extend(true, CRM, settings);
      }

      function loadStyleFile(url) {
        // Idempotent: load() may run again after a failed attempt, and appending
        // the same <link> repeatedly is pointless.
        var container = CRM.$("#backbone_resources");
        if (container.find('link[href="' + url + '"]').length) {
          return;
        }
        container.append('<link rel="stylesheet" type="text/css" href="' + url + '" />');
      }

      /**
       * Fetches a URL and puts the fetched HTML into #volunteer_backbone_templates.
       *
       * The intended use is to fetch a Smarty-generated page which contains all
       * of the backbone templates (e.g., <script type="text/template">foo</script>).
       */
      function loadTemplate(index, url) {
        var deferred = $q.defer();
        var divId = 'volunteer_backbone_template_' + index;

        CRM.$("#volunteer_backbone_templates").append("<div id='" + divId + "'></div>");
        CRM.$("#" + divId).load(CRM.url(url, {snippet: 5}), function(response, status, jqxhr) {
          if (status === 'error') {
            CRM.$("#" + divId).remove();
            deferred.reject({
              is_error: 1,
              error_message: ts('Unable to load the volunteer-management templates.'),
              status: jqxhr.status
            });
          } else {
            deferred.resolve(response);
          }
        });

        return deferred.promise;
      }

      function loadScripts(scripts) {
        var deferred = $q.defer();

        scripts = scripts.slice();
        if (!scripts.length) {
          deferred.reject({
            is_error: 1,
            error_message: ts('No volunteer-management scripts were provided.')
          });
          return deferred.promise;
        }

        // What's this weird stuff going on with jQuery, you ask?
        //
        // Based on a discussion with totten, we anticipate problems with
        // competing versions of jQuery. On a given page, there are two copies
        // of jQuery (CMS's and CRM's), but only one of them includes Civi's
        // custom widgets and preferred add-ons (crmDatepicker, etc). jQuery
        // version problems wouldn't manifest all the time -- in many cases, the
        // different variants of jQuery are interchangeable, but we suspect that
        // certain directives (like crm-ui-datepicker) would fail in snippet
        // mode because they can't access a required jQuery function. So far
        // there don't seem to be any problems, but I'm flagging this as needing
        // more testing and as a potential source of mysterious problems.
        CRM.origJQuery = window.jQuery;
        window.jQuery = CRM.$;

        // We need to put underscore on the global scope or backbone fails to load
        if(!window._) {
          window._ = CRM._;
        }

        var restoreGlobals = function() {
          window.jQuery = CRM.origJQuery;
          delete CRM.origJQuery;
        };

        loadNextScript(scripts, function () {
          restoreGlobals();
          if (CRM.volunteerApp) {
            CRM.volunteerBackboneScripts = true;
            deferred.resolve(true);
          } else {
            deferred.reject({
              is_error: 1,
              error_message: ts('The volunteer-management application did not initialize.')
            });
          }
        }, function(error) {
          restoreGlobals();
          deferred.reject(error);
        });

        return deferred.promise;
      }

      // TODO: Figure out a more authoritative way to check this, rather than
      // simply setting and checking a flag.
      function verifyScripts() {
        return !!CRM.volunteerBackboneScripts && !!CRM.volunteerApp;
      }
      function verifyPrerequisites() {
        return !!CRM.BB && !!CRM.BB.Marionette;
      }
      function verifyTemplates() {
        return (angular.element("#volunteer_backbone_templates #crm-vol-define-layout-tpl").length > 0);
      }
      function verifySettings() {
        return !!CRM.volunteerBackboneSettings;
      }
      function verifyAll() {
        return (verifyPrerequisites() && verifyScripts() && verifySettings()
          && verifyTemplates() && !!CRM.volunteerAppStarted);
      }

      return {
        verify: verifyAll,
        load: function() {
          if (verifyAll()) {
            return $q.resolve(true);
          }
          if (loadPromise) {
            return loadPromise;
          }

          loadPromise = crmApi4('VolunteerUtil', 'loadBackbone').then(function(resourceResult) {
            // loadBackbone describes one bundle, so API4 returns a single row.
            var resources = resourceResult[0] || {};
            var promises = [];

            if (CRM.$("#backbone_resources").length < 1) {
              CRM.$("body").append("<div id='backbone_resources'></div>");
            }

            if(CRM.$("#volunteer_backbone_templates").length < 1) {
              CRM.$("body").append("<div id='volunteer_backbone_templates'></div>");
            }

            // The settings must be loaded before the libraries
            // because the libraries depend on the settings.
            if(!verifySettings()) {
              loadSettings(resources.settings);
              CRM.volunteerBackboneSettings = true;
            }

            if(!verifyScripts()) {
              var scripts = resources.scripts || [];
              if (!verifyPrerequisites()) {
                scripts = (resources.prerequisite_scripts || []).concat(scripts);
              }
              promises.push(loadScripts(scripts));
            }

            if(!verifyTemplates()) {
              CRM.$.each(resources.templates, function(index, url) {
                promises.push(loadTemplate(index, url));
              });
            }

            CRM.$.each(resources.css, function(index, url) {
              loadStyleFile(url);
            });

            return $q.all(promises).then(function() {
              if (!verifyScripts()) {
                return $q.reject({
                  is_error: 1,
                  error_message: ts('The volunteer-management application did not initialize.')
                });
              }

              // Start only after every module and its HTML templates are
              // available. Starting from volunteer_app.js's DOM-ready callback
              // races the asynchronous script/template requests and causes
              // module initializers to render missing templates.
              if (!CRM.volunteerAppStarted) {
                CRM.volunteerApp.start();
                CRM.volunteerAppStarted = true;
              }
              return true;
            });
          }).catch(function(error) {
            loadPromise = null;
            var message = error && error.error_message
              ? error.error_message
              : ts('Failed to load the volunteer-management interface.');
            CRM.alert(message, ts('Error'), 'error');
            return $q.reject(error);
          });

          return loadPromise;
        }
      };
    });

})(angular, CRM.$, CRM._);
