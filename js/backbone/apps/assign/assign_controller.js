// http://civicrm.org/licensing
CRM.volunteerApp.module('Assign', function(Assign, volunteerApp, Backbone, Marionette, $, _) {
  var layout;
  Assign.startWithParent = false;

  // Kick everything off
  Assign.addInitializer(function() {
    layout = new Assign.layout();
    volunteerApp.dialogRegion.show(layout);
  });

  // Initialize entities and views
  Assign.on('start', function() {
    volunteerApp.Entities.getNeeds({assignments: true, activeOnly: true})
      .done(function(arrData) {
        var scheduledNeeds = volunteerApp.Entities.Needs.getScheduled(arrData);
        Assign.flexibleView = new Assign.needsView({
          collection: volunteerApp.Entities.Needs.getFlexible(arrData)
        });
        Assign.scheduledView = new Assign.needsView({
          collection: scheduledNeeds
        });
        layout.flexibleRegion.show(Assign.flexibleView);
        layout.scheduledRegion.show(Assign.scheduledView);
        layout.$('#crm-vol-assign-empty').toggleClass('is-visible', scheduledNeeds.length === 0);
      });
    // Hide menu when clicking away
    $('body').on('click', ':not(".crm-vol-menu-items *")', function(e) {
      $('.crm-vol-menu-items').remove();
      $('.crm-vol-menu-button').attr('aria-expanded', 'false');
    });
  });
  // Detach event handlers
  Assign.on('stop', function() {
    $('body').off('click', ':not(".crm-vol-menu-items *")');
  });

});
