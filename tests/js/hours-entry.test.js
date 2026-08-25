'use strict';

// Behavioural checks for the VolunteerHours controller (ang/volunteer/Hours.js).
//
// The controller is captured through a fake angular.module() — the
// shift-filter.test.js pattern — then invoked with a hand-built $scope,
// synchronous thenables and recording stubs, so every assertion below
// exercises the real conversion, validation and dirty-state code and its
// return values, not source text.
//
// The source executes under vm.runInThisContext rather than a new vm context:
// Hours.js builds its row/payload objects inside the vm, and
// assert.deepStrictEqual refuses objects whose prototypes come from another
// realm. Running here (with `angular`/`CRM` installed as temporary globals)
// keeps the same capture pattern while allowing strict structural comparison.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const extensionRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(extensionRoot, 'ang/volunteer/Hours.js'), 'utf8');

// A thenable whose .then/.finally callbacks run at once, so controller
// construction and saveHours() complete synchronously inside the test.
function resolved(value) {
  const promise = {
    then(onFulfilled) { return resolved(onFulfilled ? onFulfilled(value) : value); },
    finally(onSettled) { if (onSettled) { onSettled(); } return promise; },
  };
  return promise;
}

// The lodash surface Hours.js uses through CRM._.
const lodash = {
  map(list, fn) { return (list || []).map(fn); },
  filter(list, fn) { return (list || []).filter(fn); },
  reduce(list, fn, initial) { return (list || []).reduce(fn, initial); },
  find(list, fn) { return (list || []).find(fn); },
  findWhere(list, attrs) {
    return (list || []).find(item => Object.keys(attrs).every(key => item[key] === attrs[key]));
  },
  without(list, ...drop) { return (list || []).filter(item => drop.indexOf(item) < 0); },
};

const alerts = [];
// CiviCRM's ts substitutes %1, %2, ... — enough for the strings asserted here.
function translate(text, params) {
  if (!params) { return text; }
  return Object.keys(params).reduce((out, key) => out.replace('%' + key, String(params[key])), text);
}
const CRM = {
  ts: () => translate,
  alert: (message, title, type) => alerts.push({message, title, type}),
  vars: {},
  _: lodash,
  $: () => {},
};

let controller;
const moduleApi = {
  controller(name, definition) {
    assert.strictEqual(name, 'VolunteerHours');
    controller = definition;
    return moduleApi;
  },
};
const angular = {
  module() { return moduleApi; },
  forEach(collection, fn) { (collection || []).forEach((value, key) => fn(value, key)); },
  toJson: value => JSON.stringify(value),
  noop: () => {},
};

// The globals stay installed until the end of the file: the controller body
// resolves `CRM` through the global binding at call time, not capture time.
// They are restored after the last assertion (a failed assertion exits this
// standalone process immediately, so leakage is not a concern).
const savedGlobals = {angular: global.angular, CRM: global.CRM};
global.angular = angular;
global.CRM = CRM;
vm.runInThisContext(source);

// crmApi4 stub: records every call; apiResponses queues results per entity.action.
const apiCalls = [];
const apiResponses = {};
const crmApi4 = (entity, action, params) => {
  apiCalls.push({entity, action, params});
  const key = entity + '.' + action;
  return resolved(apiResponses[key] !== undefined ? apiResponses[key] : []);
};
const logHoursCalls = () => apiCalls.filter(call => call.action === 'logHours');

const volWorkflow = {
  loadContext: () => resolved({
    project: {id: 7, title: 'River cleanup', is_active: true},
    summary: {filled: 1, total: 2},
    beneficiaryNames: ['Friends of the River'],
  }),
  confirmDiscard: () => resolved(),
  cancel: () => resolved(),
};
const q = {
  all: promises => resolved(promises),
  reject: reason => ({rejectedWith: reason}),
};
const statusOptions = [];
const crmStatus = (options, promise) => { statusOptions.push(options); return promise; };

const baseContext = {
  needs: [
    {id: 21, is_flexible: 0, role_label: 'Greeter', display_time: 'Sat 9:00 AM', duration: 90},
    {id: 5, is_flexible: 1, role_label: 'General availability', display_time: 'All shifts'},
  ],
  statuses: [{value: '1', label: 'Available'}, {value: '2', label: 'Attended'}],
  completed_status_id: '2',
  no_show_status_id: '3',
  flexible_need_id: '5',
};
const row = (id, contact, minutes, extra = {}) => Object.assign({
  id: id,
  assignee_contact_id: contact,
  volunteer_need_id: 21,
  status_id: '2',
  time_completed_minutes: minutes,
  details: '',
}, extra);

apiResponses['VolunteerAssignment.getHourEntries'] = [Object.assign({}, baseContext, {rows: [
  row(11, 101, 90),
  row(12, 102, 125),
  row(13, 103, null),
  row(14, 104, ''),
  row(15, 105, 60),
]})];

const scope = {$on() {}};
controller(
  scope,
  {current: {params: {projectId: '7'}}},
  {search: () => ({})},
  {addEventListener() {}, removeEventListener() {}},
  q, crmApi4, crmStatus, volWorkflow
);

// --- Construction drove the initial load; prepareData converted minutes. ---
assert.strictEqual(scope.projectId, 7);
assert.strictEqual(scope.loading, false, 'Construction must settle the initial load synchronously here.');
assert.deepStrictEqual(apiCalls[0], {
  entity: 'VolunteerAssignment',
  action: 'getHourEntries',
  params: {projectId: 7, volunteerNeedId: null},
}, "The 'all' scope must request the whole project.");

assert.strictEqual(scope.rows[0].hours, 1.5, '90 minutes must render as 1.5 hours.');
assert.strictEqual(scope.rows[1].hours, 2.08, '125 minutes must round to two decimals.');
assert.strictEqual(scope.rows[2].hours, null, 'NULL minutes must stay NULL, not become 0.');
assert.strictEqual(scope.rows[3].hours, null, 'Empty-string minutes must normalise to NULL.');
assert.strictEqual(scope.rows[4].hours, 1);
assert.strictEqual(scope.rows[0].status_id, 2, 'Row statuses must be parsed to integers.');
assert.strictEqual(scope.completedStatusId, 2);
assert.strictEqual(scope.noShowStatusId, 3);
assert.strictEqual(scope.flexibleNeedId, 5);
assert.strictEqual(scope.needs.length, 1, 'The flexible need must be excluded from the per-shift scope options.');
assert.strictEqual(scope.needs[0].id, 21);
assert.deepStrictEqual(scope.statuses, [{value: '1', label: 'Available'}, {value: '2', label: 'Attended'}]);

// --- isDirty / markPristine snapshot the payload, not the scope. ---
assert.strictEqual(scope.workflow.isDirty(), false, 'A freshly loaded sheet is pristine.');
scope.rows[0].hours = 2;
assert.strictEqual(scope.workflow.isDirty(), true, 'Editing hours must mark the sheet dirty.');
scope.rows[0].hours = 1.5;
assert.strictEqual(scope.workflow.isDirty(), false, 'Restoring the loaded value must be pristine again.');
scope.rows[0].hours = 2;
scope.workflow.markPristine();
assert.strictEqual(scope.workflow.isDirty(), false, 'markPristine must snapshot the current rows.');
scope.rows[0].hours = 1.5;
assert.strictEqual(scope.workflow.isDirty(), true, 'Changing away from the new snapshot must be dirty.');
scope.workflow.markPristine();
scope.rows[0].details = 'late arrival';
assert.strictEqual(scope.workflow.isDirty(), true, 'Editing details must mark the sheet dirty too.');
scope.rows[0].details = '';
assert.strictEqual(scope.workflow.isDirty(), false);

// --- saveHours converts hours back to whole minutes and normalises rows. ---
scope.rows = [
  {id: 11, assignee_contact_id: 101, volunteer_need_id: 21, status_id: 2, hours: 1.75, details: 'brisk pace'},
  {_new: true, assignee_contact_id: 202, volunteer_need_id: 5, status_id: '2', hours: '0.5'},
];
apiResponses['VolunteerAssignment.logHours'] = [Object.assign({}, baseContext, {rows: [
  row(11, 101, 105),
]})];
const saved = scope.saveHours();
assert.strictEqual(typeof saved.then, 'function');
const entries = logHoursCalls()[0].params.entries;
assert.strictEqual(entries.length, 2);
assert.deepStrictEqual(entries[0], {
  id: 11,
  assignee_contact_id: 101,
  volunteer_need_id: 21,
  status_id: 2,
  time_completed_minutes: 105,
  details: 'brisk pace',
});
assert.deepStrictEqual(entries[1], {
  id: null,
  assignee_contact_id: 202,
  volunteer_need_id: 5,
  status_id: 2,
  time_completed_minutes: 30,
  details: '',
}, 'A new row normalises: no id, parsed status, string hours converted, details "".');
assert.strictEqual(scope.workflow.saving, false, 'saving must reset once the request settles.');
assert.strictEqual(scope.rows[0].hours, 1.75, '105 minutes from the server must render back as 1.75 hours (round trip).');
assert.strictEqual(scope.workflow.isDirty(), false, 'A successful save must snapshot the server state as pristine.');
assert.strictEqual(statusOptions[statusOptions.length - 1].success, 'Volunteer hours saved');

// --- validateRows gates: new row needs a contact, every row needs a status
// --- and non-negative numeric hours.
const logHoursBefore = logHoursCalls().length;
scope.rows = [{_new: true, assignee_contact_id: null, volunteer_need_id: 5, status_id: 2, hours: 1}];
assert.strictEqual(scope.saveHours().rejectedWith, false, 'A new row without a volunteer must reject.');
scope.rows = [{_new: true, assignee_contact_id: 202, volunteer_need_id: 5, status_id: null, hours: 1}];
assert.strictEqual(scope.saveHours().rejectedWith, false, 'A row without a status must reject.');
scope.rows = [{id: 11, assignee_contact_id: 101, volunteer_need_id: 21, status_id: 2, hours: -0.5}];
assert.strictEqual(scope.saveHours().rejectedWith, false, 'Negative hours must reject.');
scope.rows = [{id: 11, assignee_contact_id: 101, volunteer_need_id: 21, status_id: 2, hours: 'lots'}];
assert.strictEqual(scope.saveHours().rejectedWith, false, 'Non-numeric hours must reject.');
assert.strictEqual(logHoursCalls().length, logHoursBefore, 'Invalid sheets must not reach the API.');
assert.strictEqual(alerts[alerts.length - 1].title, 'Check hour entries');

// Null hours are legitimate (attended, no duration recorded) and must save.
scope.rows = [{id: 11, assignee_contact_id: 101, volunteer_need_id: 21, status_id: 2, hours: null}];
scope.saveHours();
assert.strictEqual(
  logHoursCalls()[logHoursCalls().length - 1].params.entries[0].time_completed_minutes,
  null,
  'NULL hours must round-trip as NULL minutes.'
);

// --- applyBulkHours guards: empty or invalid input never touches the rows. ---
const sheet = () => (scope.rows = [
  {id: 11, assignee_contact_id: 101, volunteer_need_id: 21, status_id: 2, hours: 1},
  {id: 12, assignee_contact_id: 102, volunteer_need_id: 21, status_id: 3, hours: 2},
]);
for (const empty of [null, '', undefined]) {
  sheet();
  scope.ui.bulkHours = empty;
  scope.applyBulkHours();
  assert.deepStrictEqual(
    scope.rows.map(item => item.hours),
    [1, 2],
    'An empty bulk-hours box must not zero everyone (Number(null) === 0).'
  );
}
sheet();
scope.ui.bulkHours = 'four';
scope.applyBulkHours();
assert.deepStrictEqual(scope.rows.map(item => item.hours), [1, 2], 'Non-numeric bulk hours must be refused.');
sheet();
scope.ui.bulkHours = -1;
scope.applyBulkHours();
assert.deepStrictEqual(scope.rows.map(item => item.hours), [1, 2], 'Negative bulk hours must be refused.');
assert.deepStrictEqual(
  alerts.slice(-5).map(alert => alert.title),
  ['No hours entered', 'No hours entered', 'No hours entered', 'Invalid hours', 'Invalid hours']
);
sheet();
scope.ui.bulkHours = '2.25';
scope.applyBulkHours();
assert.strictEqual(scope.rows[0].hours, 2.25, 'Bulk hours must apply to Attended rows.');
assert.strictEqual(scope.rows[1].hours, 2, 'Rows in another status must keep their hours.');

// --- attendedSummary sums Attended rows, ignoring non-numeric hours. ---
scope.rows = [
  {id: 11, assignee_contact_id: 101, volunteer_need_id: 21, status_id: 2, hours: 1.5},
  {id: 12, assignee_contact_id: 102, volunteer_need_id: 21, status_id: 2, hours: 'garbage'},
  {id: 13, assignee_contact_id: 103, volunteer_need_id: 21, status_id: 2, hours: null},
  {id: 14, assignee_contact_id: 104, volunteer_need_id: 21, status_id: 3, hours: 99},
];
assert.strictEqual(
  scope.attendedSummary(),
  '1.5 hours across 3 volunteers marked Attended',
  'Non-numeric hours are excluded by isFinite; a non-attended row is not counted at all.'
);

// --- addVolunteer / removeNewRow / markAllAttended. ---
const rowsBefore = scope.rows.length;
scope.ui.scopeNeedId = 'all';
scope.addVolunteer();
const added = scope.rows[scope.rows.length - 1];
assert.strictEqual(added._new, true);
assert.strictEqual(added.volunteer_need_id, 5, "The 'all' scope files new rows under the flexible need.");
assert.strictEqual(added.role_label, 'General availability');
assert.strictEqual(added.status_id, 2, 'New rows start out marked Attended.');
assert.strictEqual(added.hours, null);
scope.removeNewRow(added);
assert.strictEqual(scope.rows.length, rowsBefore);
scope.rows[0].status_id = 3;
scope.markAllAttended();
assert.strictEqual(scope.rows[0].status_id, 2);

global.angular = savedGlobals.angular;
global.CRM = savedGlobals.CRM;

console.log('Volunteer hours entry behavior checks passed.');
