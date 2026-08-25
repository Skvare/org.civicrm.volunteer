'use strict';

// Behavioral checks for the volWorkflow factory in ang/volunteer/Workflow.js:
// summarize() capacity totals, projectPath() normalization, setActive()
// optimistic flip and revert, the consumeAppNavigation() one-shot flag, and
// the cancel() branches. The factory is captured with a fake angular module
// and invoked directly with stub services; the APIv4 stub is always named
// crmApi4.
//
// summarize() counts a need only when it has a finite positive quantity and
// is neither flexible nor inactive — the same rule as Assign.js isCounted()
// and the server-side VolunteerAssignment.getCapacity action; the three must
// move together.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const extensionRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(extensionRoot, 'ang/volunteer/Workflow.js'), 'utf8');

const factories = {};
const controllers = {};
const moduleApi = {
  factory(name, factory) { factories[name] = factory; return moduleApi; },
  controller(name, controller) { controllers[name] = controller; return moduleApi; },
  component() { return moduleApi; },
  config() { return moduleApi; },
  run() { return moduleApi; },
};
const angular = {
  module() { return moduleApi; },
  forEach(object, fn) {
    if (object === null || object === undefined) { return; }
    if (Array.isArray(object)) { object.forEach(fn); }
    else { Object.keys(object).forEach((key) => fn(object[key], key)); }
  },
  isFunction: (value) => typeof value === 'function',
  noop() {},
};

function makeUnderscore() {
  const wrap = (value) => ({
    value,
    map(fn) { return wrap(value.map(fn)); },
    filter(fn) { return wrap(value.filter(fn)); },
    uniq() { return wrap(Array.from(new Set(value))); },
    pluck(key) { return wrap(value.map((item) => item[key])); },
    value() { return value; },
  });
  return {
    chain: wrap,
    keys: Object.keys,
    values: (object) => Object.values(object || {}),
    map: (list, fn) => (list || []).map(fn),
    filter: (list, fn) => (list || []).filter(fn),
    find: (list, fn) => (Array.isArray(list) ? list.find(fn) : Object.values(list || {}).find(fn)),
    pluck: (list, key) => (list || []).map((item) => item[key]),
  };
}

const underscore = makeUnderscore();
const confirmations = [];
const bodyTriggers = [];
const CRM = {
  $: (selector) => ({trigger: (event) => bodyTriggers.push({selector, event})}),
  _: underscore,
  ts: () => (text, params) => String(text).replace(
    /%1/g, params && params[1] !== undefined ? String(params[1]) : '%1'
  ),
  alert: () => {},
  confirm: (options) => ({
    on(event, callback) {
      if (event === 'crmConfirm:yes') { confirmations.push({options, callback}); }
      return this;
    },
  }),
  url: (route) => 'url:' + route,
  utils: {},
  vars: {},
};

vm.runInNewContext(source, {angular, Date, CRM, jQuery: {}, _: underscore});
assert.strictEqual(typeof factories.volWorkflow, 'function');

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// Values produced inside the vm context carry the vm realm's prototypes, so
// deep comparisons go through a host-realm round trip first.
const deepEqual = (actual, expected, message) => assert.deepStrictEqual(
  JSON.parse(JSON.stringify(actual)), expected, message
);

function makeQ() {
  const all = (work) => {
    if (Array.isArray(work)) { return Promise.all(work); }
    const keys = Object.keys(work);
    return Promise.all(keys.map((key) => work[key])).then((values) => {
      const result = {};
      keys.forEach((key, index) => { result[key] = values[index]; });
      return result;
    });
  };
  const deferred = () => {
    const result = {};
    result.promise = new Promise((resolve, reject) => {
      result.resolve = resolve;
      result.reject = reject;
    });
    return result;
  };
  return {resolve: (value) => Promise.resolve(value), reject: (error) => Promise.reject(error), defer: deferred, all};
}

function makeApi() {
  const calls = [];
  const responses = [];
  const crmApi4 = (entity, action, params) => {
    calls.push({entity, action, params});
    const response = responses.length ? responses.shift() : {rows: [{}]};
    return response.error ? Promise.reject(response.error) : Promise.resolve(response.rows);
  };
  return {crmApi4, calls, responses};
}

function buildWorkflow() {
  const paths = [];
  const searches = [];
  const location = {
    path(destination) { paths.push(destination); return location; },
    search(params) { searches.push(params); return location; },
  };
  const state = {reloads: 0, opened: []};
  const route = {reload: () => { state.reloads += 1; }, current: {params: {}}};
  const window = {open: (url) => state.opened.push(url)};
  const api = makeApi();
  const volWorkflow = factories.volWorkflow(
    makeQ(), location, route, window, api.crmApi4, (messages, promise) => promise
  );
  return {volWorkflow, api, paths, searches, state};
}

(async function() {
  // -- summarize(): capacity totals over counted needs -----------------------------

  {
    const {volWorkflow} = buildWorkflow();
    const needs = [
      {id: 1, quantity: 5, is_flexible: 1, is_active: 1}, // flexible: excluded
      {id: 2, quantity: 4, is_flexible: 0, is_active: 0}, // inactive: excluded
      {id: 3, quantity: 0, is_flexible: 0, is_active: 1}, // zero quantity: excluded
      {id: 4, quantity: null, is_flexible: 0, is_active: 1}, // no quantity: excluded
      {id: 5, quantity: '2', is_flexible: 0, is_active: 1},
      {id: 6, quantity: 3, is_flexible: '0', is_active: '1'},
    ];
    const assignments = [
      {volunteer_need_id: 5}, {volunteer_need_id: 5},
      {volunteer_need_id: 1}, // belongs to an uncounted need
      {volunteer_need_id: 2}, // belongs to an uncounted need
      {volunteer_need_id: 99}, // unknown need
      {volunteer_need_id: 6},
    ];
    deepEqual(volWorkflow.summarize(needs, assignments), {filled: 3, total: 5},
      'only finite-quantity active scheduled needs count toward totals');
    deepEqual(volWorkflow.summarize([], []), {filled: 0, total: 0});
  }

  // -- projectPath(): the project id is normalized ---------------------------------

  {
    const {volWorkflow} = buildWorkflow();
    assert.strictEqual(volWorkflow.projectPath('42', 'assign'), '/volunteer/manage/42/assign');
    assert.strictEqual(volWorkflow.projectPath(42), '/volunteer/manage/42/details',
      'a missing step defaults to details');
    assert.strictEqual(volWorkflow.projectPath('042', 'report'), '/volunteer/manage/42/report',
      'a padded id is parsed to a number');
  }

  // -- setActive(): non-boolean no-op, optimistic flip, revert on failure -----------

  {
    const {volWorkflow, api} = buildWorkflow();

    // Angular's <select> commits undefined before the project loads; only a
    // real boolean is treated as a choice.
    const untouched = {project: {id: 42, is_active: true}};
    await volWorkflow.setActive(untouched, undefined);
    await volWorkflow.setActive(untouched, null);
    assert.strictEqual(untouched.project.is_active, true, 'non-boolean values change nothing');
    assert.strictEqual(api.calls.length, 0);

    // Before the project has an id, the flip is local only.
    const local = {project: {id: null, is_active: false}};
    await volWorkflow.setActive(local, true);
    assert.strictEqual(local.project.is_active, true);
    assert.strictEqual(api.calls.length, 0, 'no project id means no write');

    // With a project id the flip is optimistic, then saved.
    const saved = {project: {id: 42, is_active: false}};
    const saving = volWorkflow.setActive(saved, true);
    assert.strictEqual(saved.project.is_active, true, 'the flip is immediate');
    assert.strictEqual(saved.statusSaving, true);
    await saving;
    assert.strictEqual(saved.project.is_active, true);
    assert.strictEqual(saved.statusSaving, false);
    assert.strictEqual(api.calls.length, 1);
    assert.strictEqual(api.calls[0].entity, 'VolunteerProject');
    assert.strictEqual(api.calls[0].action, 'update');
    deepEqual(api.calls[0].params.where, [['id', '=', 42]]);
    deepEqual(api.calls[0].params.values, {is_active: true});

    // A failed save restores the previous value.
    api.responses.push({error: {error_message: 'nope'}});
    const failed = {project: {id: 43, is_active: true}};
    await volWorkflow.setActive(failed, false).catch((error) => error);
    assert.strictEqual(failed.project.is_active, true, 'failure restores the previous value');
    assert.strictEqual(failed.statusSaving, false);
  }

  // -- navigate() / consumeAppNavigation(): the one-shot flag ------------------------

  {
    const {volWorkflow, paths, searches} = buildWorkflow();
    assert.strictEqual(volWorkflow.consumeAppNavigation(), false,
      'no navigation has happened yet');

    volWorkflow.navigate('/volunteer/manage/42/assign', {needId: 30});
    deepEqual(paths, ['/volunteer/manage/42/assign']);
    deepEqual(searches, [{needId: 30}]);
    assert.strictEqual(volWorkflow.consumeAppNavigation(), true,
      'a navigation the app initiated sets the flag');
    assert.strictEqual(volWorkflow.consumeAppNavigation(), false, 'the flag is one-shot');

    volWorkflow.navigate('/volunteer/manage');
    deepEqual(searches[1], {}, 'navigate without a search clears the query');
  }

  // -- cancel(): the three branches --------------------------------------------------

  {
    // A clean standalone context navigates back to the project list.
    const clean = buildWorkflow();
    clean.volWorkflow.cancel({isDirty: () => false, formContext: 'standAlone'});
    deepEqual(clean.paths, ['/volunteer/manage']);

    // An undefined context is tolerated.
    const bare = buildWorkflow();
    bare.volWorkflow.cancel(undefined);
    deepEqual(bare.paths, ['/volunteer/manage']);

    // A dirty context waits for the discard confirmation before navigating.
    const dirty = buildWorkflow();
    dirty.volWorkflow.cancel({isDirty: () => true, formContext: 'standAlone'});
    deepEqual(dirty.paths, [], 'a dirty context must not navigate before confirmation');
    assert.strictEqual(confirmations.length, 1);
    assert.strictEqual(confirmations[0].options.title, 'Discard unsaved changes?');
    confirmations.shift().callback();
    await settle();
    deepEqual(dirty.paths, ['/volunteer/manage']);

    // An event-tab context has nowhere to navigate: it refreshes in place.
    const eventTab = buildWorkflow();
    const pristines = [];
    eventTab.volWorkflow.cancel({
      formContext: 'eventTab',
      isDirty: () => false,
      markPristine: () => pristines.push(true),
    });
    deepEqual(eventTab.paths, [], 'the event tab never navigates away');
    deepEqual(pristines, [true], 'the event tab is marked pristine');
    assert.strictEqual(eventTab.state.reloads, 1, 'the route is reloaded to re-read the event');
    deepEqual(bodyTriggers[bodyTriggers.length - 1], {selector: 'body', event: 'volunteerProjectCancel'},
      'the cancel event is still announced for listeners');
  }

  console.log('Volunteer workflow factory behavior checks passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
