'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const template = fs.readFileSync(path.join(extensionRoot, 'ang/volunteer/Project.html'), 'utf8');
const controller = fs.readFileSync(path.join(extensionRoot, 'ang/volunteer/Project.js'), 'utf8');

function getFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? getFiles(entryPath) : [entryPath];
  });
}

assert.ok(
  template.includes('track by profile._client_id'),
  'Profile rows must use stable identities instead of array indexes.'
);
assert.ok(
  !template.includes('ng-init="selectedProfile'),
  'Selected profile metadata must not be captured by a one-time ng-init alias.'
);
assert.ok(
  template.includes('getProfileOption(profile.uf_group_id).fields'),
  'Field summaries must resolve metadata reactively from the selected ID.'
);
assert.ok(
  controller.includes("data._client_id = 'profile-' + nextProfileClientId++"),
  'Loaded profile rows must receive stable client identities.'
);
assert.ok(
  controller.includes('delete profile._client_id'),
  'Client-only identities must not be submitted to APIv3.'
);

const unsafeScalarOptions = [];
getFiles(path.join(extensionRoot, 'ang'))
  .filter((file) => file.endsWith('.html'))
  .forEach((file) => {
    const markup = fs.readFileSync(file, 'utf8');
    const optionExpression = /ng-options\s*=\s*(["'])(.*?)\1/gs;
    let match;
    while ((match = optionExpression.exec(markup)) !== null) {
      if (match[2].includes(' as ') && match[2].includes(' track by ')) {
        unsafeScalarOptions.push(`${path.relative(extensionRoot, file)}: ${match[2]}`);
      }
    }
  });
assert.deepStrictEqual(
  unsafeScalarOptions,
  [],
  'Scalar ng-options models must not combine select-as with track-by; AngularJS cannot match the primitive model value back to the option.'
);

console.log('Project profile editor source checks passed.');
