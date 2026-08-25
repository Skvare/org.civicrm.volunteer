'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const form = fs.readFileSync(path.join(extensionRoot, 'CRM/Volunteer/Form/Log.php'), 'utf8');
const behavior = fs.readFileSync(path.join(extensionRoot, 'js/CRM_Volunteer_Form_Log.js'), 'utf8');

assert.ok(
  form.includes("'class' => 'big crm-vol-contact'"),
  'Contact fields must use a semantic class instead of being unconditionally required.'
);
assert.ok(
  form.includes("'class' => 'crm-vol-actual-duration'"),
  'Actual-duration fields must use a semantic class instead of being unconditionally required.'
);
assert.ok(
  behavior.includes("$table.find('.crm-grid-row').each(") &&
    behavior.includes("$row.find(requiredFields).addClass('required')"),
  'Initially active rows must receive client-side required validation.'
);
assert.ok(
  behavior.includes("$table.find('.hiddenElement:first')") &&
    behavior.includes('activateRow($row)'),
  'A newly revealed row must receive client-side required validation when activated.'
);

console.log('Log-hours active-row validation source checks passed.');
