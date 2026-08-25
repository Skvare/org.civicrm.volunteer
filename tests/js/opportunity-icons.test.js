'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const opportunitiesTemplate = fs.readFileSync(
  path.join(extensionRoot, 'ang/volunteer/VolOppsCtrl.html'),
  'utf8'
);
const signupTemplate = fs.readFileSync(
  path.join(extensionRoot, 'templates/CRM/Volunteer/Form/VolunteerSignUp.tpl'),
  'utf8'
);
const styles = fs.readFileSync(
  path.join(extensionRoot, 'ang/volunteer.css'),
  'utf8'
);

// The redesigned opportunity cards expose descriptions inline and remove cart
// entries through a labeled control, so no sprite icons remain there.
assert.ok(
  !opportunitiesTemplate.includes('ui-icon-comment') &&
    !opportunitiesTemplate.includes('ui-icon-trash'),
  'Opportunity controls must not depend on retired jQuery UI sprite icons.'
);
assert.ok(
  opportunitiesTemplate.includes('class="crm-vol-remove-shift"'),
  'Cart removal must stay a labeled control, not a bare sprite icon.'
);

// The signup page keeps the compact description popups on its commitment
// summaries; those must use current CiviCRM icons with hover semantics.
assert.ok(
  !signupTemplate.includes('ui-icon-comment') &&
    (signupTemplate.match(/class="crm-i fa-comment"/g) || []).length >= 2,
  'Project and role description popups must use fa-comment.'
);
assert.ok(
  signupTemplate.includes('crm-hover-button crm-vol-icon-button crm-vol-description'),
  'Icon controls must use CiviCRM hover-button semantics.'
);
assert.ok(
  styles.includes('.crm-container .crm-vol-icon-button > .crm-i'),
  'Icon controls must neutralize Riverlea button chrome without hiding the icon.'
);

console.log('Volunteer opportunity icon source checks passed.');
