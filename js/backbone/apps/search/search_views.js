// http://civicrm.org/licensing
(function (ts){
  CRM.volunteerApp.module('Search', function(Search, volunteerApp, Backbone, Marionette, $, _) {

    Search.layout = Marionette.Layout.extend({
      template: "#crm-vol-search-layout-tpl",
      regions: {
        searchForm: "#crm-vol-search-form-region",
        searchPager: "#crm-vol-search-pager",
        searchResults: "#crm-vol-search-results-region"
      }
    });

    var fieldView = Marionette.CompositeView.extend({
      hasBeenInitialized: false,
      profileUrl: '',
      className: 'crm-vol-search-field crm-section',

      initialize: function() {
        // @todo: These field type lists are a little redundant with Entities.allowedCustomFieldTypes;
        // there's probably a smarter way to do this.

        /**
         * Keys will be used to select the appropriate template for the field, i.e.
         * '#crm-vol-search-field-' + type + '-tpl'. The array of values represents
         * the HTML type (i.e., api.customField.getsingle.html_type).
         *
         * @type Object
         */
        var typeMap = {
          checkRadio: ['CheckBox', 'Radio'],
          select: ['Autocomplete-Select', 'Multi-Select', 'Select'],
          text: ['Text']
        };
        // html_types which allow the user to select multiple values
        var typeMulti = ['CheckBox', 'Multi-Select'];

        var html_type = this.model.get('html_type');
        var type = _.findKey(typeMap, function(group) {
          return _.contains(group, html_type);
        });

        this.model.set({
          elementName: 'crm-vol-search-field-' + this.model.get('column_name'),
          selectMultiple: _.contains(typeMulti, html_type)
        });

        this.template = '#crm-vol-search-field-' + type + '-tpl';
      }
    });

    /**
     * Returns a field's value(s)
     *
     * TODO: It might be more consistent to make this a method of fieldView, above.
     *
     * @param {jQuery object} field
     * @returns {mixed} Array of values if any exist, else null
     */
    Search.getFieldValue = function (field) {
      var value = [];
      if (field.is(':checkbox') || field.is(':radio')) {
        field.each(function() {
          var item = CRM.$(this);
          if (item.is(':checked')) {
            value.push(item.val());
          }
        });
      } else {
        var v = field.val();
        if (_.isArray(v) && v.length > 0) {
          // some widgets return an array; in this case, we can return as-is
          value = v;
        } else if (v) {
          value.push(v);
        }
      }

      if (value.length === 0) {
        value = null;
      }
      return value;
    };

    Search.fieldsCollectionView = Marionette.CollectionView.extend({
      itemView: fieldView,
      className: 'crm-vol-search-form crm-form-block',

      handleForm: function(e) {
        var dialog = CRM.$("#crm-volunteer-search-dialog");
        dialog.block();
        e.preventDefault();

        // API4 takes explicit where clauses rather than APIv3's flat filter
        // map, so the form builds them directly. `options` stays separate
        // because the pager advances its offset in place.
        Search.params = {
          filters: [],
          options: {limit: Search.resultsPerPage, offset: 0}
        };
        Search.formFields.each(function(item) {

          var field = CRM.$('[name=' + item.get('elementName') + ']');
          var val = Search.getFieldValue(field);
          if (!val) {
            return;
          }

          // Group membership is a bridge join, and API4 defines only IN and
          // NOT IN for it -- APIv3 spelled this filter.group_id.
          if (!item.get('id')) {
            Search.params.filters.push(['groups', 'IN', val]);
            return;
          }

          // API4 addresses a custom field as CustomGroupName.field_name;
          // there is no custom_n alias.
          var key = item.get('custom_group_id.name') + '.' + item.get('name');

          if (item.get('serialize')) {
            // A multi-value custom field stores a separated list, so each
            // requested value must be matched inside it. APIv3's IN filter on
            // such a field meant "has any of these", which is an OR group.
            Search.params.filters.push(['OR', _.map(val, function(one) {
              return [key, 'CONTAINS', one];
            })]);
            return;
          }

          Search.params.filters.push(val.length > 1
            ? [key, 'IN', val]
            : [key, '=', val[0]]);
        });

        volunteerApp.Entities.getContacts().done(function(result) {
          Search.resultsView.collection.reset(result);
          Search.updateSelectionSummary();
          CRM.$('#crm-vol-search-form-region').closest('.crm-accordion-wrapper').addClass('collapsed');
          dialog.unblock();
        });
      },

      onRender: function() {
        this.$('select').crmSelect2();
        this.$('input[name="crm-vol-search-field-group"]').attr('placeholder', '- any group -').crmEntityRef({
          entity: 'group'
        });

        var btn = CRM.$('<button></button>', {
          'type': 'submit',
          'class': 'crm-button crm-form-submit',
          'html': '<i aria-hidden="true" class="crm-i fa-search"></i> ' + _.escape(ts('Search'))
        });
        var btn_wrapper = CRM.$('<div></div>', {class: 'crm-submit-buttons'})
                .append(btn);
        this.$el.append(btn_wrapper);

        // this is a bit of a hack; submit handlers can't be bound via the events
        // attribute because the events are delegated jQuery events and they fire too late
        CRM.$('form.crm-event-manage-volunteer-search-form-block').submit(this.handleForm);
      }

    });

    Search.pagerView = Marionette.ItemView.extend({
      template: '#crm-vol-search-pager-tpl',

      attributes: function() {
        return {
          class: 'crm-pager'
        };
      },

      modelEvents: {
        'change': function() {
          this.render();
        }
      },

      onRender: function() {
        if (this.model.get('total') === 0) {
          this.$el.hide();
        } else {
          this.$el.show();
        }

        this.$('.crm-button').click(function(e) {
          e.preventDefault();
          var dialog = CRM.$("#crm-volunteer-search-dialog");
          dialog.block();

          var increment = $(this).is('.crm-button-type-back') ? -(Search.resultsPerPage) : Search.resultsPerPage;
          Search.params.options.offset += increment;

          volunteerApp.Entities.getContacts().done(function(result) {
            Search.resultsView.collection.reset(result);
            Search.updateSelectionSummary();
            dialog.unblock();
          });
        });
      }
    });

    Search.updateSelectionSummary = function() {
      var contactCheckboxes = $('#crm-vol-search-results-region [name=selected_contacts]');
      var selectedCount = contactCheckboxes.filter(':checked').length;
      contactCheckboxes.not(':checked').prop('disabled', selectedCount >= Search.cnt_open_assignments);
      $('.crm-vol-search-selected-count').text(selectedCount);

      var buttonPane = $('#crm-volunteer-search-dialog').siblings('.ui-dialog-buttonpane');
      var button = buttonPane.find('button.crm-vol-search-assign');
      button.button(selectedCount > 0 ? 'enable' : 'disable');
    };

    Search.contactView = Marionette.ItemView.extend({
      tagName: 'tr',
      template: '#crm-vol-search-contact-tpl',

      templateHelpers: {
        contactUrl: function(contactId) {
          return CRM.url('civicrm/contact/view', {reset: 1, cid: contactId});
        }
      },

      attributes: function() {
        return {
          class: (this.model.collection.indexOf(this.model) % 2 ? 'even' : 'odd')
        };
      },

      onRender: function() {
        var rendered_view = this;
        rendered_view.$('[name=selected_contacts]').change(function() {
          var toggle = CRM.$(this).is(':checked');
          $(this).closest('tr').toggleClass('crm-row-selected', toggle);

          Search.updateSelectionSummary();
        });
      }
    });

    Search.resultsCompositeView = Marionette.CompositeView.extend({
      template: '#crm-vol-search-result-tpl',
      itemView: Search.contactView,
      itemViewContainer: 'tbody',

      onRender: function() {
        var rendered_view = this;
        rendered_view.$('[name=select_all_contacts]').change(function() {
          var selectAll = CRM.$(this).is(':checked');
          var contacts = rendered_view.$('[name=selected_contacts]');

          if (selectAll) {
            var max = Search.cnt_open_assignments - contacts.filter(':checked').length;
            contacts.not(':checked').slice(0, max).prop('checked', true);
          } else {
            contacts.prop('checked', false);
          }

          contacts.first().trigger('change');
          Search.updateSelectionSummary();
        });
      }
    });
  });
}(CRM.ts('org.civicrm.volunteer')));
