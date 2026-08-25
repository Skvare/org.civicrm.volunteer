(function(window) {
  'use strict';

  if (!window.CRM || !window.Backbone || !window.Backbone.Marionette) {
    throw new Error('CiviVolunteer requires Backbone and Backbone.Marionette.');
  }

  if (!window.CRM.BB || !window.CRM.BB.Marionette) {
    window.CRM.BB = window.Backbone.noConflict();
  }
})(window);
