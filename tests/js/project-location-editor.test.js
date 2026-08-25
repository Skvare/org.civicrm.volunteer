'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(extensionRoot, relativePath), 'utf8');

const template = read('ang/volunteer/Project.html');
const controller = read('ang/volunteer/Project.js');
const projectBao = read('CRM/Volunteer/BAO/Project.php');
const stateField = template.match(/<div class="crm-vol-location-state-province"[\s\S]*?<\/div>/);
const selectTags = template.match(/<select\b[^>]*>/g) || [];

assert.ok(
  stateField &&
  template.includes('state.id as state.name for state in stateProvinces') &&
    template.includes('ng-model="locBlock.address.state_province_id"') &&
    template.includes('ng-disabled="stateProvincesLoading || !locBlock.address.country_id"'),
  'The project location editor must expose CiviCRM State/Province values.'
);
assert.ok(
  !stateField[0].includes('crm-ui-select'),
  'The asynchronously populated State/Province select must not trigger crm-ui-select nested digests.'
);
assert.strictEqual(
  selectTags.filter(tag => tag.includes('crm-ui-select') && tag.includes('ng-options')).length,
  0,
  'Project selects must not combine crm-ui-select with the ng-options render hook that causes nested digests.'
);
assert.ok(
  template.includes('ng-options="v.id as v.name for (k, v) in countries"'),
  'The native country select must bind numeric CiviCRM IDs so loaded addresses retain their selection.'
);
assert.ok(
  template.includes('ng-change="countryChanged()"') &&
    controller.includes("crmApi4('StateProvince', 'get'") &&
    controller.includes("where: [['country_id', '=', countryId]]") &&
    controller.includes('delete $scope.locBlock.address.state_province_id'),
  'Changing country must refresh the State/Province choices and clear an incompatible selection.'
);
assert.ok(
  projectBao.includes("'postal_code', 'postal_code_suffix', 'state_province_id'") &&
    projectBao.includes("'address_id.*'"),
  'Project location writes and reads must round-trip state_province_id.'
);

console.log('Volunteer project location-editor source checks passed.');
