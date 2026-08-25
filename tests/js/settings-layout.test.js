'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const styles = fs.readFileSync(
  path.join(extensionRoot, 'css/CRM_Volunteer_Form_Settings.css'),
  'utf8'
);

assert.ok(
  !styles.includes('padding-left: 17%'),
  'Nested settings labels must not consume their width with percentage padding.'
);
assert.ok(
  styles.includes('margin-left: 17%'),
  'Nested settings labels must be indented outside their text width.'
);
assert.ok(
  styles.includes('@media (min-width: 480px)'),
  'Nested label indentation must only apply to the horizontal form layout.'
);

console.log('Volunteer settings layout source checks passed.');
