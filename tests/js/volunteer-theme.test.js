'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const hooks = fs.readFileSync(path.join(extensionRoot, 'volunteer.php'), 'utf8');
const angularPage = fs.readFileSync(
  path.join(extensionRoot, 'CRM/Volunteer/Page/Angular.php'),
  'utf8'
);

assert.ok(
  hooks.includes('function volunteer_civicrm_activeTheme(&$theme, $context)'),
  'CiviVolunteer must select its configured theme through activeTheme.'
);
assert.ok(
  hooks.includes("Civi::settings()->get('theme_backend')"),
  'CiviVolunteer routes must use the configured CiviCRM backend theme.'
);
assert.ok(
  hooks.includes("^civicrm/(?:vol(?:/|$)|volunteer(?:/|$))"),
  'The theme override must be scoped to CiviVolunteer host routes.'
);
assert.ok(
  angularPage.includes("$this->assign('urlIsPublic', FALSE)"),
  'The public opportunities host must promote session messages to notifications.'
);

console.log('CiviVolunteer theme and notification source checks passed.');
