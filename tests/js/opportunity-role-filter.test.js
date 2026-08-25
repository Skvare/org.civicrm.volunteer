'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const angularApp = fs.readFileSync(path.join(extensionRoot, 'ang/volunteer.js'), 'utf8');
const searchAction = fs.readFileSync(
  path.join(extensionRoot, 'Civi/Api4/Action/VolunteerNeed/Search.php'),
  'utf8'
);

// Bookmarked role_id[] (and selected[]) parameters are normalized through the
// shared bracket-aware parser so the multi-select and API4 receive arrays.
assert.ok(
  angularApp.includes("angular.forEach(['role_id', 'selected'], function(key)"),
  'Bookmarked role_id[] and selected[] parameters must be normalized for array widgets.'
);
assert.ok(
  angularApp.includes('? _.values(returnParams[key])') &&
    angularApp.includes(': [returnParams[key]]'),
  'A scalar or nested parameter value must become one array item rather than split into digits.'
);
assert.ok(
  angularApp.includes('_.flatten(values)'),
  'Normalized lists must be flattened before use.'
);
assert.ok(
  searchAction.includes('@var int|array|null'),
  'The role and beneficiary API parameters must advertise the supported array type.'
);
assert.ok(
  !searchAction.includes('@var int|int[]|null'),
  'API4 action metadata must not contain the unsupported int[] validator type.'
);

console.log('Volunteer opportunity role-filter source checks passed.');
