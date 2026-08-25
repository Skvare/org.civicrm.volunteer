// http://civicrm.org/licensing
CRM.volunteerApp.module('Entities', function(Entities, volunteerApp, Backbone, Marionette, $, _) {

  Entities.VolCustomFieldModel = Backbone.Model.extend({});

  Entities.VolCustomFields = Backbone.Collection.extend({
    model: Entities.VolCustomFieldModel,
    comparator: 'weight'
  });

  Entities.getVolCustomFields = function() {
    var defer = CRM.$.Deferred();
    CRM.api4('VolunteerUtil', 'getCustomFields', {})
      .then(function(fields) {
        defer.resolve(_.toArray(fields));
      }, function(error) {
        defer.reject(error);
      });
    return defer.promise();
  };

  /**
   * Retrieves option values for the given option group IDs
   *
   * @param {Array} ids IDs of option groups for which to retrieve option values
   * @returns {Promise} The callback should expect data in the format of
   *                 {option_group_id: [api.OptionValue.getsingle, api.OptionValue.getsingle...]}
   *                 e.g. {19: [Object, Object, Object], 21: [Object]}
   */
  Entities.getOptions = function(ids) {
    var defer = CRM.$.Deferred();

    CRM.api4('OptionValue', 'get', {
      select: ['*'],
      where: [
        ['is_active', '=', true],
        ['option_group_id', 'IN', ids]
      ],
      orderBy: {weight: 'ASC'},
      limit: 0
    }).then(function(rows) {
      defer.resolve(_.groupBy(_.toArray(rows), 'option_group_id'));
    }, function(error) {
      defer.reject(error);
    });

    return defer.promise();
  };
});