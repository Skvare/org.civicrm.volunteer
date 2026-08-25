// http://civicrm.org/licensing
CRM.volunteerApp.module('Entities', function(Entities, volunteerApp, Backbone, Marionette, $, _) {

  Entities.ContactModel = Backbone.Model.extend({});

  Entities.ContactPagerModel = Backbone.Model.extend({
    defaults: {
      'end': 0,
      'start': 0,
      'total': 0
    }
  });

  Entities.Contacts = Backbone.Collection.extend({
    model: Entities.ContactModel,
    comparator: 'sort_name'
  });

  /**
   * The columns the search results template renders.
   *
   * APIv3's Contact.get flattened the primary address, email and phone onto
   * the record; API4 reaches them through implicit joins, so the rows are
   * remapped to the same keys in formatContact().
   */
  var contactSelect = [
    'id',
    'sort_name',
    'address_primary.city',
    'address_primary.state_province_id:label',
    'email_primary.email',
    'phone_primary.phone'
  ];

  /**
   * Give every row the keys the underscore templates interpolate. An absent
   * key would throw rather than render blank.
   */
  function formatContact(row) {
    return {
      contact_id: row.id,
      id: row.id,
      sort_name: row.sort_name || '',
      city: row['address_primary.city'] || '',
      state_province: row['address_primary.state_province_id:label'] || '',
      email: row['email_primary.email'] || '',
      phone: row['phone_primary.phone'] || ''
    };
  }

  Entities.getContacts = function() {
    var Search = CRM.volunteerApp.module('Search');
    Search.params = Search.params || {};
    Search.params.filters = Search.params.filters || [];
    Search.params.options = _.extend({
      limit: Search.resultsPerPage,
      offset: 0
    }, Search.params.options || {});

    var defer = CRM.$.Deferred();
    // Selecting row_count alongside the page's fields makes API4 report the
    // unpaged total as countMatched, so the pager needs no second request.
    CRM.api4('Contact', 'get', {
      select: ['row_count'].concat(contactSelect),
      where: Search.params.filters,
      limit: Search.params.options.limit,
      offset: Search.params.options.offset
    }).then(function(rows) {
      var total = _.isUndefined(rows.countMatched) ? rows.length : rows.countMatched;
      var end = Search.params.options.offset + Search.params.options.limit;
      var start = Search.params.options.offset + 1;

      if (end > total) {
        end = total;
      }

      Search.pagerData.set({
        'end': end,
        'start': start,
        'total': total
      });

      defer.resolve(_.map(_.toArray(rows), formatContact));
    }, function(error) {
      defer.reject(error);
    });
    return defer.promise();
  };
});
