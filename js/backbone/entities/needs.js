// http://civicrm.org/licensing
CRM.volunteerApp.module('Entities', function(Entities, volunteerApp, Backbone, Marionette, $, _) {

  Entities.NeedModel = Backbone.Model.extend({
    defaults: {
      'display_start_date': null, // generated in getNeeds
      'display_start_time': null, // generated in getNeeds
      'display_end_date': null, // generated in getNeeds
      'display_end_time': null, // generated in getNeeds
      'is_active' : 1,
      'is_flexible': 0,
      'duration': 0,
      'role_id': null,
      'start_time': CRM.volunteer.default_date,
      'end_time': null,
      'quantity': null,
      'filled': null,
      'userAdded': false, // see this.createNewNeed() and initializeTimeComponents() in the view
      'visibility_id': CRM.pseudoConstant.volunteer_need_visibility.public
    }
  });

  Entities.Needs = Backbone.Collection.extend({
    model: Entities.NeedModel,
    comparator: 'start_time',
    createNewNeed: function (params) {
      params = _.extend({
        project_id: volunteerApp.project_id,
        quantity: 1,
        start_time: CRM.volunteer.default_date,
        visibility_id: CRM.pseudoConstant.volunteer_need_visibility.public
      }, params);
      formatDate(params);
      var need = new this.model(params);
      // this feels a bit like a dirty hack... passing a flag along so the view
      // can distinguish between user-added models and ones that were already there
      need.set('userAdded', true);
      this.add(need);
      // Callers use jQuery's .done(), and expect the new record, so bridge
      // API4's native promise back onto a jQuery deferred. crmApi's fourth
      // argument used to supply the saving/saved feedback; CRM.status does now.
      var defer = CRM.$.Deferred();
      CRM.status({}, defer.promise());
      CRM.api4('VolunteerNeed', 'create', {values: params})
        .then(function(created) {
          need.set('id', created[0].id);
          defer.resolve(created[0]);
        }, function(error) {
          defer.reject(error);
        });
      return defer.promise();
   }
 });

  /**
   * Fetch this project's needs, optionally with their assignments.
   *
   * @param {object} options
   *   activeOnly: restrict to active needs.
   *   assignments: attach each need's assignments as `assignments`.
   *   assignmentCounts: attach each need's assignment tally as
   *     `assignment_count`. Implied by `assignments`.
   * @returns {Promise} Resolves with an array of need records.
   */
  Entities.getNeeds = function(options) {
    options = options || {};
    var wantAssignments = !!(options.assignments || options.assignmentCounts);

    var where = [['project_id', '=', volunteerApp.project_id]];
    if (options.activeOnly) {
      where.push(['is_active', '=', true]);
    }

    var defer = $.Deferred();
    CRM.api4('VolunteerNeed', 'get', {
      select: ['*'],
      where: where,
      limit: 0
    }).then(function(rows) {
      var needs = _.map(_.toArray(rows), normalizeNeed);
      if (!wantAssignments || !needs.length) {
        defer.resolve(needs);
        return;
      }
      // APIv3 hung api.volunteer_assignment.get/getcount off each need; API4
      // expresses this as one grouped read over the whole page of needs.
      CRM.api4('VolunteerAssignment', 'get', {
        where: [['volunteer_need_id', 'IN', _.pluck(needs, 'id')]]
      }).then(function(assignments) {
        var byNeed = _.groupBy(_.map(_.toArray(assignments), normalizeAssignment), 'volunteer_need_id');
        _.each(needs, function(need) {
          var mine = byNeed[need.id] || [];
          need.assignments = mine;
          need.assignment_count = mine.length;
        });
        defer.resolve(needs);
      }, function(error) {
        defer.reject(error);
      });
    }, function(error) {
      defer.reject(error);
    });
    return defer.promise();
  };

  /**
   * APIv3 quoted every scalar, and this layer compares the boolean flags
   * against '1'/'0' strictly (see getFlexible/getScheduled). API4 returns real
   * booleans, so restore the string form before the collections see the data.
   */
  function normalizeNeed(need) {
    _.each(['is_active', 'is_flexible'], function(field) {
      if (!_.isUndefined(need[field]) && need[field] !== null) {
        need[field] = need[field] ? '1' : '0';
      }
    });
    formatDate(need);
    return need;
  }

  /**
   * Give an assignment the keys the Assign templates interpolate.
   *
   * The assignment service prefixes joined contact columns with the activity
   * role they came from (assignee_display_name and friends), while the
   * templates address the assignee's own columns unprefixed.
   */
  function normalizeAssignment(assignment) {
    return _.extend({}, assignment, {
      contact_id: assignment.assignee_contact_id,
      sort_name: assignment.assignee_sort_name || '',
      display_name: assignment.assignee_display_name || '',
      email: assignment.assignee_email || '',
      phone: assignment.assignee_phone || ''
    });
  }

  function formatDate (arrayData) {
    if (arrayData.start_time) {
      var timeDate = arrayData.start_time.split(" ");
      var date = $.datepicker.parseDate("yy-mm-dd", timeDate[0]);
      arrayData.display_start_date = $.datepicker.formatDate($.datepicker._defaults.dateFormat, date);
      arrayData.display_start_time = timeDate[1].substring(0, 5);
    }
    if (arrayData.end_time) {
      var timeDate = arrayData.end_time.split(" ");
      var date = $.datepicker.parseDate("yy-mm-dd", timeDate[0]);
      arrayData.display_end_date = $.datepicker.formatDate($.datepicker._defaults.dateFormat, date);
      arrayData.display_end_time = timeDate[1].substring(0, 5);
    }
  }

  Entities.Needs.getFlexible = function(arrData) {
    return new Entities.Needs(_.where(arrData, {is_flexible: '1'}));
  };

  Entities.Needs.getScheduled = function(arrData) {
    return new Entities.Needs(_.where(arrData, {is_flexible: '0'}));
  };

});
