'use strict';

// The redesign left the CiviEvent Volunteers tab rendering the full standalone
// page chrome inside a CiviCRM tab panel, and nothing in the suite asserted
// anything about the eventTab form context. These pin the shape of that fix.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(extensionRoot, relativePath), 'utf8');

const shellTemplate = read('ang/volunteer/WorkflowShell.html');
const workflow = read('ang/volunteer/Workflow.js');
const projectTemplate = read('ang/volunteer/Project.html');
const projectController = read('ang/volunteer/Project.js');
const tabTemplate = read('templates/CRM/Volunteer/Form/Volunteer.tpl');
const tabScript = read('js/CRM_Volunteer_Form_Volunteer.js');
const eventStyles = read('css/volunteer_events.css');
const angStyles = read('ang/volunteer.css');
const listTemplate = read('ang/volunteer/ProjectsList.html');
const listController = read('ang/volunteer/Projects.js');

assert.ok(
  workflow.includes('ctrl.isEmbedded = function()') &&
    workflow.includes("ctrl.workflow.formContext === 'eventTab'"),
  'The workflow shell must know whether it owns the page or is hosted in a tab.'
);

assert.ok(
  shellTemplate.includes('ng-if="!$ctrl.isEmbedded()"') &&
    /class="crm-vol-breadcrumb" ng-if="!\$ctrl\.isEmbedded\(\)"/.test(shellTemplate) &&
    /<h1 ng-if="!\$ctrl\.isEmbedded\(\)">/.test(shellTemplate),
  'Embedded in the event tab, the shell must drop the breadcrumb and heading the host already provides.'
);

assert.ok(
  shellTemplate.includes("$ctrl.isEmbedded() ? 'crm-vol-workflow-steps' : 'nav nav-tabs'"),
  'The step list must not render as nav-tabs inside CiviEvent’s own tab bar.'
);

// Following this link from inside the event tab rendered the standalone project
// list *in* the tab, so it must exist only within the guarded breadcrumb.
assert.strictEqual(
  (shellTemplate.match(/href="#\/volunteer\/manage"/g) || []).length,
  1,
  'The link back to the standalone project list must appear once, inside the guarded breadcrumb.'
);

assert.ok(
  angStyles.includes('.crm-vol-workflow--embedded') &&
    angStyles.includes('.crm-vol-workflow-tabs .crm-vol-workflow-steps'),
  'The embedded step navigation needs styling of its own.'
);

// The Save button was gated on standAlone, so the event tab had no way to save
// without moving on to Shifts -- while the manual still told users to click it.
assert.ok(
  !projectTemplate.includes("ng-show=\"formContext === 'standAlone'\""),
  'Save must be available in every form context.'
);
assert.ok(
  projectTemplate.includes('crm-vol-project-save-done') &&
    projectTemplate.includes('crm-vol-project-save-next'),
  'Both Save and Save-and-continue must remain present.'
);

// The legacy duplicate action row is gone; the anchor the frame is moved after
// is all that remains of it.
['crm-volunteer-event-define', 'crm-volunteer-event-assign',
  'crm-volunteer-event-log-hours', 'crm-volunteer-event-edit'].forEach(id => {
  assert.ok(
    !tabTemplate.includes(id) && !tabScript.includes(id),
    `The event tab must not duplicate the workflow steps as a legacy ${id} button.`
  );
});
assert.ok(
  tabTemplate.includes('crm-volunteer-event-action-items-all') &&
    tabScript.includes("$('.crm-volunteer-event-action-items-all').after(angFrame)"),
  'The frame relocation anchor must survive.'
);
assert.ok(
  !tabScript.includes('slideUp()') && !tabScript.includes('slideDown()'),
  'The show/hide two-state model went with the Edit Settings button.'
);
assert.ok(
  tabScript.includes("CRM.vars && CRM.vars['org.civicrm.volunteer']") &&
    /if \(!vars\) \{\s*return;/.test(tabScript),
  'Reaching the tab without its bootstrap must bail, not throw.'
);
assert.ok(
  !/background(?:-color)?:\s*rgb\(62/.test(eventStyles),
  'Riverlea tokens, not a hard-coded grey.'
);


// An event carries its own campaign; it beats the site-wide default.
assert.ok(
  projectController.includes("CRM.vars['org.civicrm.volunteer'].entityCampaignId") &&
    projectController.includes('project.campaign_id = '),
  "A new project on an event tab must inherit the event's campaign."
);

// Component availability is published to the client, not assumed.
assert.ok(
  projectController.includes('$scope.isCampaignEnabled = !!CRM.volunteer.isCampaignEnabled') &&
    read('ang/volunteer/Project.html').includes('ng-if="isCampaignEnabled"'),
  'The campaign field must be withheld when CiviCampaign is off.'
);
assert.ok(
  listController.includes('$scope.associatedEntityUrl = function') &&
    listController.includes('civicrm/event/manage/settings') &&
    listTemplate.includes('associatedEntityTitle(project)') &&
    listTemplate.includes('project.campaign_label'),
  'The project listing must show, and link to, the event and campaign it computes.'
);
assert.ok(
  listTemplate.includes('ng-if="isCampaignEnabled"'),
  'The campaign filter must be withheld when CiviCampaign is off.'
);

console.log('event-tab-context: ok');
