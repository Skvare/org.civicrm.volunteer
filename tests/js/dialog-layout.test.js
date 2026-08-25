'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(extensionRoot, relativePath), 'utf8');

const app = read('js/backbone/apps/volunteer_app.js');
const defineTemplate = read('templates/CRM/Volunteer/Page/Backbone/Define.tpl');
const defineBehavior = read('js/backbone/apps/define/define_views.js');
const assignTemplate = read('templates/CRM/Volunteer/Page/Backbone/Assign.tpl');
const assignBehavior = read('js/backbone/apps/assign/assign_views.js');
const searchTemplate = read('templates/CRM/Volunteer/Page/Backbone/Search.tpl');
const searchBehavior = read('js/backbone/apps/search/search_views.js');
const logTemplate = read('templates/CRM/Volunteer/Form/Log.tpl');
const logBehavior = read('js/CRM_Volunteer_Form_Log.js');
const logForm = read('CRM/Volunteer/Form/Log.php');
const appStyles = read('css/volunteer_app.css');
// The jQuery-UI wrapper chrome for .crm-volunteer-*-workflow-dialog lives here,
// not in css/volunteer_app.css: that file is only added by the CiviEvent tab
// and the Backbone loader, so the redesigned dialogs opened from Manage
// Volunteer Projects were unstyled.
const angStyles = read('ang/volunteer.css');
const logStyles = read('css/log.css');

assert.ok(
  app.includes("dialogClass: 'crm-volunteer-workflow-dialog'") &&
    app.includes('project_title = projectTitle'),
  'Backbone workflows must use the shared dialog shell and retain project context.'
);

assert.ok(
  defineTemplate.includes('crm-vol-define-needs-list') &&
    defineTemplate.includes('crm-vol-save-state') &&
    defineTemplate.includes('Visible on public signup') &&
    !defineTemplate.includes('crm-vol-define-needs-table'),
  'Define Opportunities must use autosaving cards instead of the legacy nested table.'
);
assert.ok(
  defineBehavior.includes("thisNeed.setSaveState('saving')") &&
    defineBehavior.includes("thisNeed.setSaveState('error')"),
  'Opportunity cards must expose their save and failure states.'
);

assert.ok(
  assignTemplate.includes('crm-vol-capacity-summary') &&
    assignTemplate.includes('Search contacts') &&
    assignTemplate.includes('fa-ellipsis-v') &&
    assignTemplate.includes('data-label='),
  'Assign Volunteers must show capacity, visible search/actions, and responsive row labels.'
);
assert.ok(
  assignBehavior.includes("handle: '.crm-vol-drag'") &&
    assignBehavior.includes("ts('Fully staffed')") &&
    !appStyles.includes('rgba(255, 0, 0, 0.25)'),
  'Dragging must have a handle and vacancy state must not be presented as an error.'
);
assert.ok(
  searchTemplate.includes('crm-vol-search-selected-count') &&
    searchTemplate.includes('contactUrl(contact_id)') &&
    searchBehavior.includes('Search.updateSelectionSummary'),
  'Volunteer search must expose selection capacity and linked responsive results.'
);

assert.ok(
  logTemplate.includes('crm-vol-log-context') &&
    logTemplate.includes('crm-vol-batch-action') &&
    logTemplate.includes('Add another volunteer') &&
    !logTemplate.includes('i/copy.png'),
  'Log Hours must use project context, labeled batch actions, and modern add controls.'
);
assert.ok(
  logForm.includes("ts('Save hours'") &&
    logForm.includes("'css/log.css'") &&
    logBehavior.includes('updateVisibleRows()') &&
    logBehavior.includes('markDirty()'),
  'Log Hours must communicate its explicit save behavior and visible entry state.'
);

assert.ok(
  appStyles.includes('var(--crm-layer1-bg-color') &&
    appStyles.includes('background: var(--crm-paper, #fff)') &&
    appStyles.includes('@media (max-width: 767px)') &&
    angStyles.includes('--crm-dialog-body-bg-color: var(--crm-paper, #fff)') &&
    angStyles.includes('@media (max-width: 767px)') &&
    logStyles.includes('var(--crm-border-color') &&
    logStyles.includes('@media (max-width: 680px)'),
  'All three dialogs must have an opaque Riverlea surface and responsive layouts.'
);

assert.ok(
  !appStyles.includes('.crm-volunteer-workflow-dialog {') &&
    !appStyles.includes('.crm-volunteer-search-workflow-dialog {') &&
    angStyles.includes('.crm-volunteer-workflow-dialog,') &&
    angStyles.includes('.crm-volunteer-search-workflow-dialog {'),
  'Dialog wrapper chrome must ship with the Angular bundle, not with the event-tab-only stylesheet.'
);

console.log('Volunteer workflow dialog layout source checks passed.');
