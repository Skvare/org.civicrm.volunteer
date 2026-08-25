// http://civicrm.org/licensing
(function (ts){
  CRM.volunteerApp.module('Assign', function(Assign, volunteerApp, Backbone, Marionette, $, _) {
    var dragFrom, infoDialog;

    Assign.layout = Marionette.Layout.extend({
      template: "#crm-vol-assign-layout-tpl",
      templateHelpers: function() {
        return {projectTitle: volunteerApp.project_title};
      },
      regions: {
        flexibleRegion: "#crm-vol-assign-flexible-region",
        scheduledRegion: "#crm-vol-assign-scheduled-region"
      }
    });

    var menuItemTemplate = function (params) {
      var compiled = _.template($('#crm-vol-menu-item-tpl').html());
      return compiled(params);
    }

    var assignmentViewSettings = {
      tagName: 'tr',
      attributes: function() {
        return {
          class: 'crm-vol-assignment ' + (this.model.collection.indexOf(this.model) % 2 ? 'even' : 'odd'),
          // Store ids to facilitate dragging & dropping
          'data-id': this.model.get('id'),
          'data-cid': this.model.get('contact_id')
        };
      },

      templateHelpers: {
        contactUrl: function(cid) {
          return CRM.url('civicrm/contact/view', {reset: 1, cid: cid});
        }
      },

      events: {
        'click a.crm-vol-info': function() {
          infoDialog && infoDialog.close && infoDialog.close();
          infoDialog = CRM.alert(this.model.get('details'), this.model.get('display_name'), 'info', {expires: 0});
          return false;
        },
        'click a.crm-vol-menu-parent': function () {return false;},
        'click a.crm-vol-menu-button': function() {
          $('.crm-vol-menu-items').remove();
          this.$('.crm-vol-menu-button').attr('aria-expanded', 'true');
          var $menu = $($('#crm-vol-menu-tpl').html());
          $((this.isFlexible ? '' : '.crm-vol-menu-move-to, ') + '.crm-vol-menu-copy-to', $menu).append(menuItemTemplate({
            cid: 'flexible',
            title: ts('Available Volunteers'),
            time: ''
          }));
          $.each(Assign.scheduledView.getOpenSlots(this.$el), function() {
            $('.crm-vol-menu-move-to, .crm-vol-menu-copy-to', $menu).append(menuItemTemplate(this));
          });
          $menu.appendTo($('.crm-vol-menu', this.$el));
          this.$('.crm-vol-menu-list').menu();
          return false;
        }
      }
    };

    Assign.scheduledAssignmentView = Marionette.ItemView.extend(_.extend(assignmentViewSettings, {
      template: '#crm-vol-scheduled-assignment-tpl',
      isFlexible: false
    }));

    Assign.flexibleAssignmentView = Marionette.ItemView.extend(_.extend(assignmentViewSettings, {
      template: '#crm-vol-flexible-assignment-tpl',
      isFlexible: true
    }));

    var needView = Marionette.CompositeView.extend({
      hasBeenInitialized: false,
      profileUrl: '',
      itemViewContainer: '.crm-vol-assignment-list',
      className: 'crm-vol-need crm-form-block panel panel-default',

      initialize: function() {
        this.collection = new volunteerApp.Entities.Assignments(_.toArray(this.model.get('assignments') || []));
        var type = this.model.get('is_flexible') == '1' ? 'flexible' : 'scheduled';
        this.isFlexible = !(type == 'scheduled');
        this.template = '#crm-vol-' + type + '-tpl';
        this.itemView = Assign[type + 'AssignmentView'];
      },

      templateHelpers: {
        pseudoConstant: CRM.pseudoConstant
      },

      events: {
        'change [name=add-volunteer]': 'addNewContact',
        'click .crm-vol-menu-item a': 'moveContact',
        'click .crm-vol-del': 'removeContact',
        'click .crm-vol-search': function (e) {
          if ($(e.currentTarget).hasClass('disabled')) {
            e.preventDefault();
            return false;
          }
          var Search = CRM.volunteerApp.module('Search');
          $('#crm-volunteer-search-dialog').dialog(Search.dialogSettings);

          var params = {
            need_id: this.model.get('id'),
            cnt_open_assignments: parseInt(this.model.get('quantity'), 10) > 0
              ? parseInt(this.model.get('quantity'), 10) - this.collection.length
              : 25
          };
          Search.start(params);
          e.preventDefault();
        }
      },

      onAfterItemAdded: function() { this.doCount(); },
      onItemRemoved: function() { this.doCount(); },

      onRender: function() {
        var thisView = this;
        $(this.itemViewContainer, this.$el).droppable({
          activeClass: "ui-state-default",
          hoverClass: "ui-state-hover",
          drop: function(event, ui) {
            var id = $(ui.draggable).data('id');
            var assignment = dragFrom.collection.get(id);
            thisView.addAssignment(assignment.clone());
            dragFrom.collection.remove(assignment);
          },
          accept: function($item) {
            return thisView.acceptVolunteers($item);
          }
        });
        this.hasBeenInitialized = true;
        this.doCount();
      },

      // Adds a cloned or existing assignment to the view
      addAssignment: function(assignment) {
        var thisView = this, statusMsg = '';
        assignment.set('volunteer_need_id', this.model.get('id'));
        this.collection.add(assignment);
        var status = _.invert(CRM.pseudoConstant.volunteer_status),
          params = {
            activity_date_time: this.model.get('start_time'),
            time_scheduled_minutes: this.model.get('duration'),
            volunteer_need_id: this.model.get('id'),
            volunteer_role_id: this.model.get('role_id'),
            status_id: status[this.isFlexible ? 'Available' : 'Scheduled']
          };
        // APIv3's create doubled as an update when given an ID; API4 keeps the
        // two apart, so a move updates and a clone creates.
        var existingId = assignment.get('id');
        var write;
        if (existingId) {
          statusMsg = ts('Volunteer Moved');
          write = CRM.api4('VolunteerAssignment', 'update', {
            where: [['id', '=', existingId]],
            values: params
          });
        }
        else {
          _.extend(params, _.pick(assignment.attributes, 'contact_id', 'details'));
          statusMsg = ts('Volunteer Copied');
          write = CRM.api4('VolunteerAssignment', 'create', {values: params});
        }
        write.then(function(saved) {
            assignment.set('id', saved[0].id);
            // refresh the data-id property and even-odd rows
            thisView.render();
            CRM.status(statusMsg);
          }, function(error) {
            CRM.alert(error && error.error_message, ts('Error'), 'error');
          });
      },

      doCount: function() {
        if (!this.hasBeenInitialized) {
          return;
        }
        var thisView = this;
        this.isFlexible && $('input[name=add-volunteer]', this.$el).crmEntityRef({create: true});
        var quantity = parseInt(this.model.get('quantity'), 10) || 0;
        var assigned = this.collection.length;
        var vacanciesRemain = !quantity || quantity > assigned;
        this.$('.crm-vol-search')
          .toggleClass('disabled', !vacanciesRemain)
          .attr('aria-disabled', !vacanciesRemain ? 'true' : 'false');
        $('.crm-vol-vacancy, .crm-vol-placeholder', this.$el).remove();
        var $summary = this.$('.crm-vol-capacity-summary')
          .removeClass('is-open is-full is-over is-unlimited');
        if (quantity) {
          this.$('.crm-vol-capacity').text(ts('%1 of %2 assigned', {1: assigned, 2: quantity}));
          if (assigned < quantity) {
            var delta = quantity - assigned;
            $summary.addClass('is-open');
            this.$('.crm-vol-capacity-detail').text(ts('%1 more needed', {1: delta}));
          }
          else if (assigned === quantity) {
            $summary.addClass('is-full');
            this.$('.crm-vol-capacity-detail').text(ts('Fully staffed'));
          }
          else {
            $summary.addClass('is-over');
            this.$('.crm-vol-capacity-detail').text(ts('%1 over capacity', {1: assigned - quantity}));
          }
        }
        else {
          $summary.addClass('is-unlimited');
          this.$('.crm-vol-capacity').text(ts('%1 assigned', {1: assigned}));
          this.$('.crm-vol-capacity-detail').text(ts('No capacity limit'));
        }
        if (!assigned) {
          var colspan = this.isFlexible ? 1 : 3;
          $('.crm-vol-assignment-list', this.$el).append(
            '<tr class="crm-vol-placeholder"><td colspan="' + colspan + '">' + ts('No volunteers assigned yet') + '</td></tr>'
          );
        }
        // Initialize draggable on any new objects
        $('.crm-vol-assignment:not(.ui-draggable)', this.$el).draggable({
          helper: "clone",
          handle: '.crm-vol-drag',
          zIndex: 99999999999,
          cancel: '.crm-vol-menu',
          containment: '#crm-volunteer-dialog',
          start: function(e, ui) {
            dragFrom = thisView;
            $('.crm-vol-need table').removeClass('row-highlight');

            // fix the width of the dragged row and the cells within it
            var td_widths = [];
            var original_row = CRM.$(e.currentTarget);
            original_row.children('td').each(function (i) {
              td_widths[i] = CRM.$(this).width();
            });
            var new_row = ui.helper;
            new_row.width(original_row.width());
            new_row.children('td').each(function (i) {
              CRM.$(this).width(td_widths[i]);
            });
          },
          stop: function() {
            $('.crm-vol-need table').addClass('row-highlight');
          }
        });
      },

      acceptVolunteers: function($item) {
        // If we have no room for more volunteers
        if (this.model.get('quantity') && this.model.get('quantity') <= this.collection.length) {
          return false;
        }
        // If this activity is already in the collection
        if (this.collection.get($item.data('id'))) {
          return false;
        }
        // If any activity for the same contact is already in a non-flexible collection
        return this.isFlexible || !(this.collection.where({contact_id: $item.attr('data-cid')}).length);
      },

      addNewContact: function() {
        var newContactId =  $('input[name=add-volunteer]', this.$el).select2('val');
        if (newContactId) {
          var status = _.invert(CRM.pseudoConstant.volunteer_status);
          $('input[name=add-volunteer]', this.$el).select2('val', '');
          var params = {
            contact_id: newContactId,
            volunteer_need_id: this.model.get('id'),
            status_id: status[this.isFlexible ? 'Available' : 'Scheduled'],
            activity_date_time: this.model.get('start_time'),
            volunteer_role_id: this.model.get('role_id'),
            time_scheduled_minutes: this.model.get('duration')
          };
          this.collection.createNewAssignment(params);
        }
        return false;
      },

      removeContact: function(e) {
        var thisView = this;
        var id = $(e.currentTarget).closest('tr').data('id');
        var assignment = this.collection.get(id);
        CRM.confirm(function() {
          thisView.collection.remove(assignment);
          $('.crm-vol-menu-items').remove();
          CRM.status({}, CRM.toJqPromise(
            CRM.api4('VolunteerAssignment', 'delete', {where: [['id', '=', id]]})
          ));
        }, {
          title: ts('Delete Volunteer'),
          message: ts('Remove %1 from %2?', {
            1: assignment.get('display_name'),
            2: this.isFlexible ? ts('Available Volunteers') : CRM.pseudoConstant.volunteer_role[this.model.get('role_id')]
          })
        });
        return false;
      },

      moveContact: function(e) {
        var targetView, newAssignment,
          id = $(e.currentTarget).closest('tr').data('id'),
          assignment = this.collection.get(id),
          cid = $(e.currentTarget).attr('href').substr(1);
        if (cid === 'flexible') {
          targetView = Assign.flexibleView.children.findByIndex(0);
        }
        else {
          targetView = Assign.scheduledView.children.findByCid(cid);
        }
        if ($(e.currentTarget).is('.crm-vol-menu-move-to a')) {
          this.collection.remove(assignment);
          newAssignment = assignment;
        }
        else {
          newAssignment = assignment.clone();
          newAssignment.set('id', null);
          $('.crm-vol-menu-items').remove();
        }
        targetView.addAssignment(newAssignment);
        return false;
      }

    });

    Assign.needsView = Marionette.CollectionView.extend({
      itemView: needView,
      className: 'crm-vol-assign-region-inner',
      getOpenSlots: function($el) {
        var slots = [];
        this.children.each(function(view) {
          if (view.acceptVolunteers($el)) {
            slots.push({
              cid: view.cid,
              title: CRM.pseudoConstant.volunteer_role[view.model.get('role_id')],
              time: view.model.get('display_time')
            });
          }
        });
        return slots;
      }
    });

  });
}(CRM.ts('org.civicrm.volunteer')));
