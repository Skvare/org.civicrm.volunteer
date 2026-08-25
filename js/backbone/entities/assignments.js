// http://civicrm.org/licensing
CRM.volunteerApp.module('Entities', function(Entities, volunteerApp, Backbone, Marionette, $, _) {

  Entities.Assignment = Backbone.Model.extend({
    defaults: {
      'phone': '',
      'email': ''
    }
  });

  Entities.Assignments = Backbone.Collection.extend({
    model: Entities.Assignment,
    comparator: 'sort_name',

    createNewAssignment: function(params) {
      var thisCollection = this;
      var defer = CRM.$.Deferred();
      // crmApi's fourth argument used to supply the saving/saved feedback.
      CRM.status({}, defer.promise());
      // API4 resolves to the created rows themselves rather than to APIv3's
      // envelope keyed by the new ID.
      CRM.api4('VolunteerAssignment', 'create', {values: params})
        .then(function(created) {
          thisCollection.add(new Entities.Assignment(created[0]));
          defer.resolve(created[0]);
        }, function(error) {
          defer.reject(error);
        });
      return defer.promise();
    }
  });

});
