'use strict';

// Behavioural checks for the VolunteerRoster controller (ang/volunteer/Roster.js).
//
// The controller is captured through a fake angular.module() — the
// shift-filter.test.js pattern — then invoked with a hand-built $scope, a
// synchronous crmApi4 stub and a $window whose URL/document objects record
// everything exportCsv() touches. csvCell is a closure, so the CSV-injection
// guard is exercised end-to-end through exportCsv()'s output; applyFilters()
// and the grouping sort run through $scope.filterRows().
//
// The source executes under vm.runInThisContext rather than a new vm context:
// Roster.js builds its group objects inside the vm, and assert.deepStrictEqual
// refuses objects whose prototypes come from another realm. Running here (with
// `angular`/`CRM`/`Blob` installed as temporary globals) keeps the same capture
// pattern while allowing strict structural comparison.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const extensionRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(extensionRoot, 'ang/volunteer/Roster.js'), 'utf8');

// A thenable whose .then/.finally callbacks run at once, so construction and
// load() complete synchronously inside the test.
function resolved(value) {
  const promise = {
    then(onFulfilled) { return resolved(onFulfilled ? onFulfilled(value) : value); },
    finally(onSettled) { if (onSettled) { onSettled(); } return promise; },
  };
  return promise;
}

// The lodash surface Roster.js uses through CRM._ (chain is only needed for
// the statuses list, so it carries exactly the methods load() calls).
const lodash = {
  filter: (list, fn) => (list || []).filter(fn),
  map(collection, fn) {
    if (Array.isArray(collection)) { return collection.map(fn); }
    return Object.keys(collection || {}).map(key => fn(collection[key], key));
  },
  every: (list, fn) => (list || []).every(fn),
  groupBy(list, fn) {
    const grouped = {};
    (list || []).forEach(item => {
      const key = fn(item);
      (grouped[key] = grouped[key] || []).push(item);
    });
    return grouped;
  },
  chain(value) {
    const api = {
      map: fn => { value = lodash.map(value, fn); return api; },
      filter: fn => { value = (value || []).filter(fn); return api; },
      pluck: key => { value = (value || []).map(item => item[key]); return api; },
      uniq: (isSorted, fn) => {
        const seen = [];
        value = (value || []).filter(item => {
          const key = fn ? fn(item) : item;
          if (seen.indexOf(key) >= 0) { return false; }
          seen.push(key);
          return true;
        });
        return api;
      },
      sortBy: key => {
        value = (value || []).slice().sort((a, b) => String(a[key]).localeCompare(String(b[key])));
        return api;
      },
      value: () => value,
    };
    return api;
  },
};

const translate = (text, params) => {
  if (!params) { return text; }
  return Object.keys(params).reduce((out, key) => out.replace('%' + key, String(params[key])), text);
};
const CRM = {
  ts: () => translate,
  alert: () => {},
  vars: {},
  _: lodash,
  $: () => {},
};

let controller;
const moduleApi = {
  controller(name, definition) {
    assert.strictEqual(name, 'VolunteerRoster');
    controller = definition;
    return moduleApi;
  },
};
const angular = {
  module() { return moduleApi; },
  forEach(collection, fn) { (collection || []).forEach((value, key) => fn(value, key)); },
  noop: () => {},
};

// exportCsv() news up a Blob and drives an <a download> through $window;
// capture both instead of needing a DOM.
const blobs = [];
class FakeBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options && options.type;
    blobs.push(this);
  }
}

// The globals stay installed until the end of the file: the controller body
// resolves `CRM` and `Blob` through the global binding at call time. They are
// restored after the last assertion (a failed assertion exits this standalone
// process immediately, so leakage is not a concern).
const savedGlobals = {angular: global.angular, CRM: global.CRM, Blob: global.Blob};
global.angular = angular;
global.CRM = CRM;
global.Blob = FakeBlob;
vm.runInThisContext(source);

const rosterRows = [
  {
    id: 1,
    assignee_display_name: '=SUM(A1:A9)',
    assignee_email: 'jane@example.org',
    assignee_phone: '555-0100',
    role_label: 'Greeter',
    display_time: 'Sat 9:00 AM',
    start_time: '2026-08-22 09:00:00',
    status_name: 'completed',
    status_label: 'Attended',
  },
  {
    id: 2,
    assignee_display_name: 'Doe, Jane',
    assignee_email: 'JANE2@EXAMPLE.ORG',
    assignee_phone: '+1 555-0101',
    role_label: 'Usher',
    display_time: 'Sat 11:00 AM',
    start_time: '2026-08-22 11:00:00',
    status_name: 'available',
    status_label: 'Available',
  },
  {
    id: 3,
    assignee_display_name: 'He said "hi"',
    assignee_email: undefined,
    assignee_phone: null,
    role_label: '-coach',
    display_time: '',
    start_time: '',
    status_name: 'completed',
    status_label: '@import',
  },
];

const apiCalls = [];
const crmApi4 = (entity, action, params) => {
  apiCalls.push({entity, action, params});
  const responses = {
    'VolunteerAssignment.getRoster': [{project_title: 'River cleanup', rows: rosterRows}],
  };
  return resolved(responses[entity + '.' + action] !== undefined ? responses[entity + '.' + action] : []);
};

const volWorkflow = {
  loadContext: () => resolved({
    project: {id: 7, title: 'River cleanup', is_active: true},
    summary: {filled: 2, total: 3},
    beneficiaryNames: ['Friends of the River'],
    supporting: {workflow: {can_send_email: true, email_activity_type_id: 5, sms: {enabled: false, activity_type_id: null}}},
  }),
  confirmDiscard: () => resolved(),
  cancel: () => resolved(),
};

let objectUrlBlob = null;
let createdLink = null;
let linkClicked = false;
let linkRemoved = false;
let linkAppended = false;
let urlRevoked = false;
const windowStub = {
  print() {},
  URL: {
    createObjectURL(blob) { objectUrlBlob = blob; return 'blob:mock-url'; },
    revokeObjectURL() { urlRevoked = true; },
  },
  document: {
    createElement(tag) {
      createdLink = {
        tag: tag,
        click() { linkClicked = true; },
        remove() { linkRemoved = true; },
      };
      return createdLink;
    },
    body: {appendChild() { linkAppended = true; }},
  },
};

const scope = {$on() {}};
controller(
  scope,
  {current: {params: {projectId: '7'}}},
  windowStub,
  crmApi4,
  volWorkflow
);

// --- Construction drove the initial load; the status list is deduped and
// --- sorted by label.
assert.deepStrictEqual(apiCalls[0], {
  entity: 'VolunteerAssignment',
  action: 'getRoster',
  params: {projectId: 7, includePast: false},
});
assert.strictEqual(scope.projectId, 7);
assert.strictEqual(scope.loading, false);
assert.strictEqual(scope.workflow.project.title, 'River cleanup');
assert.deepStrictEqual(scope.statuses, [
  {name: 'completed', label: 'Attended'},
  {name: 'available', label: 'Available'},
]);
assert.strictEqual(scope.canSendEmail(), true, 'Email actions follow the workflow context capabilities.');
assert.strictEqual(scope.canEmail(scope.rows[0]), true);
assert.strictEqual(scope.canEmail(scope.rows[2]), false, 'A row without an email address cannot be emailed.');
assert.strictEqual(scope.canSms(scope.rows[1]), false, 'SMS is gated on an enabled provider.');

// --- applyFilters: case-insensitive search across name, email, phone, role,
// --- shift and status; status narrowing; groups sorted by start time.
const visibleIds = () => scope.visibleRows.map(row => row.id);
scope.ui.search = 'JANE';
scope.filterRows();
assert.deepStrictEqual(visibleIds(), [1, 2],
  'Search is case-insensitive and spans fields: an email hit and a name hit.');
scope.ui.search = 'greet';
scope.filterRows();
assert.deepStrictEqual(visibleIds(), [1], 'Search also matches the role label.');
scope.ui.search = '555-0101';
scope.filterRows();
assert.deepStrictEqual(visibleIds(), [2], 'Search also matches the phone number.');
scope.ui.search = '';
scope.ui.statusFilter = 'completed';
scope.filterRows();
assert.deepStrictEqual(visibleIds(), [1, 3], 'The status filter narrows by machine name.');
scope.ui.search = '=sum';
scope.filterRows();
assert.deepStrictEqual(visibleIds(), [1], 'Search and status filters combine.');
scope.ui.search = '';
scope.ui.statusFilter = '';
scope.filterRows();

assert.deepStrictEqual(scope.groups.map(group => group.label),
  ['Unscheduled', 'Sat 9:00 AM', 'Sat 11:00 AM'],
  'Rows group by display time; unscheduled rows fall last in label but sort first by empty start.');
assert.strictEqual(scope.groups[0].start, '');
assert.strictEqual(scope.groups[1].start, '2026-08-22 09:00:00');
assert.strictEqual(scope.groups[1].rows.length, 1);
assert.strictEqual(scope.groups[1].rows[0].id, 1);
assert.strictEqual(scope.groups[2].rows[0].id, 2);

// applyFilters keeps the select-all checkbox in sync with the visible rows.
scope.ui.search = 'greet';
scope.filterRows();
assert.strictEqual(scope.ui.allSelected, false);
scope.selected[1] = true;
scope.filterRows();
assert.strictEqual(scope.ui.allSelected, true, 'Selecting every visible row checks the select-all box.');
scope.ui.search = '';
scope.ui.statusFilter = '';
scope.filterRows();

// --- csvCell, exercised through exportCsv: spreadsheet-formula injection
// --- is neutralised; quotes and commas are escaped; ordinary text is intact.
scope.exportCsv();
assert.strictEqual(blobs.length, 1);
assert.strictEqual(blobs[0].type, 'text/csv;charset=utf-8');
assert.strictEqual(blobs[0].parts.length, 1);
const expectedCsv = '\ufeff' + [
  '"Volunteer","Role","Shift","Status","Email","Phone"',
  '"\'=SUM(A1:A9)","Greeter","Sat 9:00 AM","Attended","jane@example.org","555-0100"',
  '"Doe, Jane","Usher","Sat 11:00 AM","Available","JANE2@EXAMPLE.ORG","\'+1 555-0101"',
  '"He said ""hi""","\'-coach","","\'@import","",""',
].join('\r\n');
assert.strictEqual(blobs[0].parts[0], expectedCsv,
  'Formula-leading cells are single-quote prefixed; embedded quotes are doubled; commas are quoted; null/undefined become empty cells.');
assert.strictEqual(objectUrlBlob, blobs[0], 'The download URL is created from the generated CSV blob.');
assert.strictEqual(createdLink.tag, 'a');
assert.strictEqual(createdLink.download, 'volunteer-roster-7.csv');
assert.strictEqual(linkAppended, true);
assert.strictEqual(linkClicked, true);
assert.strictEqual(linkRemoved, true);
assert.strictEqual(urlRevoked, true);

global.angular = savedGlobals.angular;
global.CRM = savedGlobals.CRM;
global.Blob = savedGlobals.Blob;

console.log('Volunteer roster CSV and filter behavior checks passed.');
