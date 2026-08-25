'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(extensionRoot, file), 'utf8');
const workflow = read('ang/volunteer/Workflow.js');
const projects = read('ang/volunteer/Projects.js');
const menu = read('xml/Menu/Volunteer.xml');
const assign = read('ang/volunteer/Assign.js');
const assignBody = read('ang/volunteer/AssignBody.html');
const rosterBody = read('ang/volunteer/RosterBody.html');
const hours = read('ang/volunteer/Hours.js');
const shifts = read('ang/volunteer/Shifts.js');
const shiftsBody = read('ang/volunteer/ShiftsBody.html');
const shiftFilters = shifts;
const styles = read('ang/volunteer.css');
const roster = read('ang/volunteer/Roster.js');
const hoursBody = read('ang/volunteer/HoursBody.html');
const shell = read('ang/volunteer/WorkflowShell.html');
const dialogTpl = read('ang/volunteer/WorkflowDialog.html');
const standaloneTpl = read('ang/volunteer/WorkflowStandalone.html');
const project = read('ang/volunteer/Project.js');
const projectHtml = read('ang/volunteer/Project.html');
const projectsList = read('ang/volunteer/ProjectsList.html');
const projectsDashboard = read('ang/volunteer/ProjectsDashboard.html');

for (const step of ['details', 'shifts', 'assign', 'roster', 'hours', 'report']) {
  assert.ok(
    workflow.includes(step),
    `The shared workflow must advertise the ${step} step.`
  );
}

assert.ok(
  workflow.includes('CRM.volunteerPopup = function') && workflow.includes("Define: 'shifts'") && workflow.includes("Assign: 'assign'"),
  'Legacy popup callers must be adapted to the shared Angular dialogs.'
);
assert.ok(
  !projects.includes('volBackbone.load()') && !projects.includes('CRM.loadPage(url'),
  'Manage Projects must open shared workflow dialogs without booting the legacy Backbone app.'
);
assert.ok(
  menu.includes('<page_callback>CRM_Volunteer_Page_AngularRoster</page_callback>') &&
  menu.includes('<page_callback>CRM_Volunteer_Page_AngularHours</page_callback>'),
  'Historic roster and hours URLs must remain as Angular compatibility hosts.'
);

for (const partial of [
  'WorkflowShell.html', 'ShiftsBody.html', 'AssignBody.html', 'RosterBody.html', 'HoursBody.html', 'HoursReport.html'
]) {
  assert.ok(fs.existsSync(path.join(extensionRoot, 'ang/volunteer', partial)), `${partial} must exist.`);
}

// The Assign step must keep the wireframe's structure: metric tiles, a shift
// rail, a selected-shift panel and drag-and-drop placement.
for (const marker of [
  'crm-vol-assign-metrics',
  'crm-vol-shift-rail',
  'crm-vol-selected-shift',
  'crm-vol-available-pool',
  'crm-vol-open-spot',
  'crm-vol-actions-menu',
  'crm-vol-drop-target',
  'crm-vol-draggable-volunteer',
]) {
  assert.ok(
    assignBody.includes(marker),
    `The Assign step must render ${marker}.`
  );
}
assert.ok(
  assign.includes("directive('crmVolDraggableVolunteer'") && assign.includes("directive('crmVolDropTarget'"),
  'Assign must provide its own drag source and drop target directives.'
);
assert.ok(
  assign.includes('$scope.selectedNeed') && assign.includes('$scope.metrics'),
  'Assign must track a selected shift and the headline metrics.'
);
assert.ok(
  assign.includes('$scope.openSpots') && assign.includes('adjustFilled'),
  'Assign must render open spots and adjust filled counts optimistically.'
);

// "Log hours for this shift" deep-links into the Hours step.
assert.ok(
  assign.includes('$scope.goToHours = function(need)') && assignBody.includes('goToHours(selectedNeed)'),
  'Assign must offer a per-shift hand-off to the Hours step.'
);
assert.ok(
  hours.includes('$location.search() || {}).needId'),
  'The Hours step must honour a needId deep link.'
);

// Roster must match the wireframe's columns and per-row actions.
for (const marker of [
  'crm-vol-selection-label',
  'crm-vol-roster-row-actions',
  'crm-vol-roster-footnote',
  'data-print-title',
  'canEmail(row)',
  'canSms(row)',
]) {
  assert.ok(rosterBody.includes(marker), `The Roster step must render ${marker}.`);
}
assert.ok(
  rosterBody.includes('value="{{status.name}}">{{status.label}}'),
  'The roster status filter must show labels, not machine names.'
);

assert.ok(
  shifts.includes('$scope.visibleNeeds') && shiftsBody.includes('need in visibleNeeds'),
  'Shift filtering must render from a stable visible-needs snapshot.'
);
assert.ok(
  shifts.includes('shift_filter_presets') && shiftFilters.includes('interval.end < range.from') &&
    shiftFilters.includes('interval.start > range.to'),
  'Date filters must use server-calculated site-local ranges and interval overlap.'
);
for (const marker of [
  "setShiftDateScope('upcoming')", "setShiftDateScope('today')",
  "setShiftDateScope('this_week')", "setShiftDateScope('next_week')",
  "setShiftDateScope('last_week')", "setShiftDateScope('all')",
  'applyCustomShiftRange(shiftFilterForm)', "value=\"ongoing\"",
  'ui.shiftFilters.roleId', 'ui.shiftFilters.signupStatus',
]) {
  assert.ok(shiftsBody.includes(marker), `The Shifts toolbar must render ${marker}.`);
}
assert.ok(
  shiftsBody.includes("need.schedule_mode === 'ongoing'") &&
    shiftsBody.includes("ng-model=\"need.start_time\""),
  'Ongoing shifts must expose an editable start date and time.'
);

// The stylesheet must use tokens Riverlea actually publishes, so the workflow
// follows the active stream and dark mode.
assert.ok(
  !styles.includes('--crm-c-') && !styles.includes('--crm-roundness'),
  'volunteer.css must not reference colour tokens Riverlea does not define.'
);
for (const token of [
  '--crm-text-color', '--crm-paper', '--crm-layer1-bg-color',
  '--crm-border-color', '--crm-link-color', '--crm-inactive-color',
  '--crm-success-ink-color', '--crm-danger-ink-color', '--crm-l-radius',
]) {
  assert.ok(styles.includes(token), `volunteer.css must theme from ${token}.`);
}
assert.ok(
  /\.crm-vol-workflow,\s*\.crm-vol-workflow-dialog,\s*\.crm-vol-workflow-standalone\s*\{[^}]*--crm-vol-border:[^}]*--crm-vol-muted:[^}]*--crm-vol-panel:/s.test(styles),
  'Every workflow host must initialize the shared panel, border, and muted tokens used by reusable body templates.'
);
for (const hook of [
  '.crm-vol-primary-action', '.crm-vol-capacity-summary', '.crm-vol-autosave-state',
  '.crm-vol-print-heading',
]) {
  assert.ok(styles.includes(hook), `${hook} must have a stylesheet rule.`);
}

// The *Body partials render through ng-include inside a transcluded component,
// so every ng-model must go through an object. A bare primitive is shadowed on
// the child scope and the controller never sees the user's input.
for (const [file, name] of [
  [rosterBody, 'RosterBody.html'], [hoursBody, 'HoursBody.html'],
  [shiftsBody, 'ShiftsBody.html'],
  // ProjectsList/ProjectsDashboard render through ng-include from Projects.html
  // and hit the same shadowing rule.
  [projectsList, 'ProjectsList.html'], [projectsDashboard, 'ProjectsDashboard.html'],
]) {
  const bare = (file.match(/ng-model="([^"]+)"/g) || [])
    .map(m => m.replace(/ng-model="|"/g, ''))
    .filter(expr => !expr.includes('.') && !expr.includes('['));
  assert.deepStrictEqual(
    bare, [],
    `${name} binds ng-model to bare primitives (${bare.join(', ')}); they must go through an object or the controller never sees them.`
  );
}
assert.ok(
  roster.includes('$scope.ui = {') && hours.includes('$scope.ui = {') &&
    projects.includes('$scope.ui = {'),
  'Roster, Hours and Projects must keep their view state on a scope object.'
);

// ngSwitchWhen and ngInclude both transclude; on one element $compile throws
// multidir and the whole template fails to render.
for (const [file, name] of [[dialogTpl, 'WorkflowDialog.html'], [standaloneTpl, 'WorkflowStandalone.html']]) {
  assert.ok(
    !/ng-switch-when="[^"]*"\s+ng-include=/.test(file),
    `${name} must not put ng-switch-when and ng-include on the same element.`
  );
}

// A <select> bound to undefined commits a value of its own, so the status
// control must not exist until the project's real status is known.
assert.ok(
  shell.includes("$ctrl.workflow.project.is_active === true || $ctrl.workflow.project.is_active === false"),
  'The project status select must be withheld until is_active is a real boolean.'
);
// The step you are on must stay reachable even before the project exists.
assert.ok(
  shell.includes("!$ctrl.workflow.projectId && step.id !== $ctrl.workflow.step"),
  'Only downstream steps may be disabled on an unsaved project.'
);

// The form lives inside the shell's transclusion, so its controller has to be
// published into an object for isDirty() to see it.
assert.ok(
  projectHtml.includes('name="forms.projectForm"') && project.includes('$scope.forms = {}'),
  'The Details form controller must be published through a scope object.'
);
assert.ok(
  project.includes('markPristine:') && hours.includes('markPristine:'),
  'Steps that track unsaved changes must be able to drop them once discarded.'
);
assert.ok(
  project.includes('pristineDetailsState') &&
    project.includes('!angular.equals(pristineDetailsState, detailsState())') &&
    project.includes('if (newValue === oldValue)'),
  'Details must detect real model changes without treating widget or watcher initialization as an edit.'
);

// A cancelled route change leaves the module spinner up, and its overlay sits
// above the confirmation dialog.
assert.ok(
  workflow.includes("$('#crm-main-content-wrapper').unblock()"),
  'The navigation guard must clear the loading overlay before prompting.'
);
assert.ok(
  workflow.includes('consumeAppNavigation'),
  'In-app navigation must be distinguishable from browser-driven navigation.'
);

console.log('Volunteer workflow redesign source checks passed.');
