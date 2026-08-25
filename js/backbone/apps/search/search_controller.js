// http://civicrm.org/licensing
(function(ts) {
  CRM.volunteerApp.module('Search', function(Search, volunteerApp, Backbone, Marionette, $, _) {
    var layout;
    Search.startWithParent = false;
    Search.resultsPerPage = 25;
    // API4 where clauses, plus the paging state the pager advances in place.
    Search.params = {filters: [], options: {limit: Search.resultsPerPage, offset: 0}};

    // Kick everything off
    Search.addInitializer(function() {
      layout = new Search.layout();
      volunteerApp.searchRegion.show(layout);
    });

    // Initialize entities and views
    Search.on('start', function(params) {
      Search.need_id = params.need_id;
      Search.cnt_open_assignments = params.cnt_open_assignments;
      layout.$('.crm-vol-search-capacity').text(
        ts('Select up to %1 volunteers for this shift.', {1: Search.cnt_open_assignments})
      );
      layout.$('.crm-vol-search-selected-count').text('0');

      // build search form
      volunteerApp.Entities.getVolCustomFields().done(function(data) {
        Search.formFields = new volunteerApp.Entities.VolCustomFields(data);
        Search.formFields.push({
          column_name: 'group',
          html_type: 'Text',
          label: ts('Group')
        });
        Search.formView = new Search.fieldsCollectionView({
          'collection': Search.formFields
        });
        layout.searchForm.show(Search.formView);
      });

      // build pager
      Search.pagerData = new volunteerApp.Entities.ContactPagerModel();
      Search.pager = new Search.pagerView({
        'model': Search.pagerData
      });
      layout.searchPager.show(Search.pager);

      // build search results listing
      Search.results = new volunteerApp.Entities.Contacts();
      Search.resultsView = new Search.resultsCompositeView({
        'collection': Search.results
      });
      layout.searchResults.show(Search.resultsView);
    });

    Search.saveAssignments = function(){
      var scheduledView = CRM.volunteerApp.module('Assign').scheduledView;
      var need = scheduledView.collection.get(Search.need_id);
      var needView = scheduledView.children.findByModel(need);
      var status = _.invert(CRM.pseudoConstant.volunteer_status);

      needView.$el.block();

      var contactIDs = [];
      CRM.$('.crm-event-manage-volunteer-results-form-block [name=selected_contacts]:checked').each(function() {
        contactIDs.push($(this).val());
      });

      $(this).dialog('close');

      var params = {
        volunteer_need_id: need.get('id'),
        status_id: status['Scheduled'],
        activity_date_time: need.get('start_time'),
        volunteer_role_id: need.get('role_id'),
        time_scheduled_minutes: need.get('duration')
      };

      var i = 0;
      var doSave = function() {
        if (contactIDs.length > i) {
          params.contact_id = contactIDs[i++];
          needView.collection.createNewAssignment(params)
            .done(doSave)
            .fail(function() {
              needView.$el.unblock();
            });
        } else {
          needView.$el.unblock();
        }
      };

      doSave();
    };

    Search.dialogSettings = {
      modal: true,
      title: ts('Find Volunteers'),
      width: '75%',
      height: parseInt($(window).height() * .70),
      dialogClass: 'crm-volunteer-search-workflow-dialog',
      buttons: [
        {
          class: 'crm-vol-search-assign',
          disabled: true,
          text: ts('Assign selected'),

          click: Search.saveAssignments
        },
        {
          text: ts('Cancel'),
          click: function() {
            $(this).dialog('close');
          }
        }
      ],
      close: function() {
        Search.stop();
      }
    };
  });
}(CRM.ts('org.civicrm.volunteer')));
