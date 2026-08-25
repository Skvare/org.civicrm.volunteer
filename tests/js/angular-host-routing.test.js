'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const angularModule = fs.readFileSync(path.join(extensionRoot, 'ang/volunteer.ang.php'), 'utf8');
const angularController = fs.readFileSync(path.join(extensionRoot, 'ang/volunteer.js'), 'utf8');
const menu = fs.readFileSync(path.join(extensionRoot, 'xml/Menu/Volunteer.xml'), 'utf8');
const settingsForm = fs.readFileSync(path.join(extensionRoot, 'CRM/Volunteer/Form/Settings.php'), 'utf8');

assert.ok(
  angularModule.includes("'civicrm/volunteer/manage'") &&
  angularModule.includes("'civicrm/volunteer/roster'") &&
  angularModule.includes("'civicrm/volunteer/loghours'"),
  'The Angular module must declare its public, administrative, roster, and hours hosts.'
);
assert.ok(
  angularController.includes("CRM.url('civicrm/volunteer/manage', null, 'back')"),
  'Legacy public-host management routes must resolve a backend URL explicitly.'
);
assert.ok(
  angularController.includes("$window.location.replace(backendHost + '#' + $location.url())"),
  'Legacy public-host management routes must preserve and replace the hash route.'
);

const manageMenuItem = menu.match(/<item>\s*<path>civicrm\/volunteer\/manage<\/path>[\s\S]*?<\/item>/);
assert.ok(manageMenuItem, 'The administrative management host must have a menu entry.');
assert.ok(
  !manageMenuItem[0].includes('<is_public>'),
  'The administrative management host must remain a backend page.'
);
const opportunityMenuItem = menu.match(/<item>\s*<path>civicrm\/vol<\/path>[\s\S]*?<\/item>/);
assert.ok(
  opportunityMenuItem && opportunityMenuItem[0].includes('<title>Volunteer Opportunities</title>'),
  'The public opportunities host must provide Drupal with its route-specific page title.'
);
assert.ok(
  settingsForm.includes("'civicrm/volunteer/manage'"),
  'The settings form must link new projects to the backend host.'
);

console.log('Angular host routing source checks passed.');
