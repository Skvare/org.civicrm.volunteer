'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(extensionRoot, relativePath), 'utf8');

const page = read('CRM/Volunteer/Page/Roster.php');
const template = read('templates/CRM/Volunteer/Page/Roster.tpl');
const styles = read('css/roster.css');
const behavior = read('js/roster.js');

assert.ok(
  page.includes("addScriptFile('org.civicrm.volunteer', 'js/roster.js', 0, 'ajax-snippet')") &&
    page.includes("addStyleFile('org.civicrm.volunteer', 'css/roster.css', 0, 'ajax-snippet')") &&
    page.includes("$this->assign('assignmentCount'") &&
    page.includes("$this->assign('shiftCount'"),
  'The roster page must load its AJAX resources and expose summary counts.'
);
assert.ok(
  page.includes('CRM_Contact_BAO_Contact_Permission::allowList') &&
    page.includes("'can_view_contact'"),
  'Contact links must be controlled by CiviCRM contact-view permissions.'
);
assert.ok(
  page.includes("usort($group['values']") &&
    page.includes("$group['assignment_count']"),
  'Volunteers must remain alphabetized within counted shifts.'
);

assert.ok(
  template.includes('crm-vol-roster-summary') &&
    template.includes('panel panel-default crm-vol-roster-shift') &&
    template.includes('<thead>') &&
    template.includes('<tbody>'),
  'The roster must use Riverlea-style shift panels and a semantic table.'
);
assert.ok(
  template.includes('data-label=') &&
    template.includes('{$assignment.email|escape}') &&
    template.includes('{$assignment.phone|escape}'),
  'Responsive rows and printable contact values must remain available.'
);
assert.ok(
  template.includes('crm-vol-roster-print') &&
    template.includes('crm-vol-modal-closer') &&
    !template.includes('class="button"'),
  'The dialog must have explicit print and close controls without legacy primary button chrome.'
);

assert.ok(
  styles.includes('var(--crm-border-color') &&
    styles.includes('@media (max-width: 767px)') &&
    styles.includes('@media print'),
  'Roster styles must inherit theme tokens and support mobile and print layouts.'
);
assert.ok(
  behavior.includes(".crm-dialog-titlebar-print") &&
    behavior.includes(".closest('.ui-dialog')") &&
    behavior.includes(".closest('.ui-dialog-content')") &&
    behavior.includes('window.print()') &&
    behavior.includes(".dialog('close')"),
  'Roster controls must use CiviCRM printable snippets and close their dialog.'
);

console.log('Volunteer roster layout source checks passed.');
