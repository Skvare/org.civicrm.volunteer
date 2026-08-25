'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(extensionRoot, relativePath), 'utf8');

const projectsShell = read('ang/volunteer/Projects.html');
const projectsList = read('ang/volunteer/ProjectsList.html');
const projectsDashboard = read('ang/volunteer/ProjectsDashboard.html');
const projectsController = read('ang/volunteer/Projects.js');
const opportunitiesTemplate = read('ang/volunteer/VolOppsCtrl.html');
const opportunitiesController = read('ang/volunteer/VolOppsCtrl.js');
const volunteerApp = read('ang/volunteer.js');
const volunteerStyles = read('ang/volunteer.css');
const publicWorkflowStyles = read('css/public_workflow.css');
const signupTemplate = read('templates/CRM/Volunteer/Form/VolunteerSignUp.tpl');
const signupStyles = read('css/signup.css');
const additionalVolunteerStyles = read('css/additional_volunteers.css');
const additionalVolunteerScript = read('js/VolunteerSignUp.js');
const signupForm = read('CRM/Volunteer/Form/VolunteerSignUp.php');

// Management route: a shared shell switching between list and dashboard.
assert.ok(
  projectsShell.includes("ng-if=\"view === 'list'\"") &&
    projectsShell.includes("ng-if=\"view === 'dashboard'\""),
  'The Projects route must host both the list and dashboard bodies behind ?view=.'
);
assert.ok(
  fs.existsSync(path.join(extensionRoot, 'ang/volunteer/ProjectsList.html')) &&
    fs.existsSync(path.join(extensionRoot, 'ang/volunteer/ProjectsDashboard.html')),
  'The list and dashboard partials must exist.'
);
assert.ok(
  projectsList.includes('ng-click="resetFilters()"') &&
    projectsList.includes('batchActionRunning'),
  'The project list must offer filter reset and guarded bulk actions.'
);
assert.ok(
  projectsController.includes("crmApi4('VolunteerProject', 'getManageOverview'") &&
    projectsController.includes("$scope.ui = {batchAction: '', batchActionRunning: false, allSelected: false};"),
  'Project management must load through the overview bundle and keep bulk state on a scope object.'
);
// The list renders through ng-include, so two-way bindings must be object-rooted.
assert.ok(
  projectsList.includes('ng-model="ui.batchAction"') &&
    projectsList.includes('ng-model="ui.allSelected"') &&
    !/ng-model="(batchAction|allSelected)"/.test(projectsList),
  'Bulk action and select-all must bind through ui.* so ng-include cannot shadow them.'
);
// Beneficiary names must be paired by contact ID, never positionally.
assert.ok(
  projectsController.includes('project.beneficiary_options') &&
    !projectsController.includes('project.beneficiary_names || [])[index]'),
  'The beneficiary filter must read the keyed beneficiary_options map.'
);
assert.ok(
  projectsDashboard.includes('openAttention('),
  'Dashboard attention items must open the scoped workflow dialogs.'
);

// Public opportunities: hero shell, quick filters, cart, and checkout state.
assert.ok(
  opportunitiesTemplate.includes('crm-vol-public-hero') &&
    opportunitiesTemplate.includes('crm-vol-quick-filters') &&
    opportunitiesTemplate.includes("setTimeFilter('no_fixed_time')"),
  'The opportunities page must keep the public hero and the quick time filters.'
);
assert.ok(
  opportunitiesTemplate.includes('ng-click="toggleMoreFilters()"') &&
    opportunitiesTemplate.includes("moreFiltersOpen ? ts('Fewer filters') : ts('More filters')") &&
    opportunitiesTemplate.includes('id="crm-vol-more-filters-heading" class="crm-vol-sr-only"') &&
    opportunitiesController.includes('$scope.toggleMoreFilters = function()'),
  'The detailed filter control must toggle controller state and announce its open state.'
);
assert.ok(
  publicWorkflowStyles.includes('.crm-vol-public-filter-grid .crm-vol-date-range input') &&
    publicWorkflowStyles.includes('.crm-vol-public-filter-grid .crm-vol-radius-fields select') &&
    publicWorkflowStyles.includes('flex-wrap: nowrap'),
  'Date-range and proximity controls must remain inline within the detailed filter panel.'
);
const dateFieldPosition = opportunitiesTemplate.indexOf("name: 'volOppSearchForm.date_start'");
const organizerFieldPosition = opportunitiesTemplate.indexOf("name: 'volOppSearchForm.beneficiary'");
const roleFieldPosition = opportunitiesTemplate.indexOf("name: 'volOppSearchForm.role_id'");
const campaignFieldPosition = opportunitiesTemplate.indexOf("name: 'volOppSearchForm.campaign_id'");
assert.ok(
  opportunitiesTemplate.includes('crm-vol-opportunity-filter-grid') &&
    dateFieldPosition < organizerFieldPosition &&
    organizerFieldPosition < roleFieldPosition &&
    roleFieldPosition < campaignFieldPosition &&
    publicWorkflowStyles.includes('.crm-vol-opportunity-filter-grid .crm-vol-date-range > .crm-form-date-wrapper') &&
    publicWorkflowStyles.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'),
  'Detailed filters must render Date/Organizer above Role/Campaign without overflowing date widgets.'
);
assert.ok(
  opportunitiesTemplate.includes('ng-submit="applyFilters(volOppSearchForm)"') &&
    !opportunitiesTemplate.includes('ng-disabled="volOppSearchForm.$invalid"') &&
    opportunitiesTemplate.includes('crm-vol-filter-validation') &&
    opportunitiesTemplate.includes('name="postal_code"') &&
    opportunitiesController.includes('$scope.applyFilters = function(form)') &&
    opportunitiesController.includes('control.$setDirty()'),
  'Applying invalid detailed filters must identify the missing required fields.'
);
assert.ok(
  opportunitiesTemplate.includes('crm-vol-shift-cart') &&
    opportunitiesTemplate.includes("ts('Continue to your details')"),
  'The sticky shift cart must lead into the signup form.'
);
assert.ok(
  opportunitiesController.includes('return: volOppSearch.returnContext(ids)') &&
    volunteerApp.includes("volOppSearch.returnContext = function(ids)"),
  'Checkout must pass a hash-relative return context built from the live filters.'
);
assert.ok(
  volunteerApp.includes('volOppSearch.setSelected = function(ids)'),
  'Selection state must live in the URL so Back to shifts can restore the cart.'
);
assert.ok(
  !opportunitiesController.includes('floating_cart') &&
    !opportunitiesController.includes('.effect(') &&
    !volunteerStyles.includes('.floating_cart'),
  'The fixed fading cart and transfer animation must not return.'
);

// Signup: hero and progress, two-column layout, profile card, commitments
// sidebar grouped by project, responsive actions, and the disclosure.
assert.ok(
  signupTemplate.includes('crm-vol-signup-hero') &&
    signupTemplate.includes('crm-vol-signup-steps') &&
    signupTemplate.includes('crm-vol-signup-layout') &&
    signupTemplate.includes('crm-vol-signup-commitments'),
  'Signup must use the hero/progress header and the two-column commitment layout.'
);
assert.ok(
  signupTemplate.includes('Almost done — tell us who you are') &&
    signupTemplate.includes('}Pick shifts{/ts}') &&
    signupTemplate.includes('}Your details{/ts}'),
  'The signup hero must use the compact progress copy from the wireframe.'
);
assert.ok(
  signupStyles.includes('grid-template-columns: minmax(0, 1fr) minmax(17rem, 19.75rem)') &&
    signupStyles.includes('grid-template-columns: repeat(2, minmax(0, 1fr))') &&
    signupStyles.includes('justify-content: flex-start') &&
    signupStyles.includes('background-color: transparent !important') &&
    signupStyles.includes('box-shadow: none !important'),
  'The signup page must use the available details width, a transparent Profile grid, and wireframe action alignment.'
);
assert.ok(
  !signupTemplate.includes('crm-vol-signup-summary-table') &&
    !signupTemplate.includes('<table'),
  'The signup page must not lead with a commitments table.'
);
assert.ok(
  signupTemplate.includes('from=$commitmentGroups') &&
    signupTemplate.includes('{$commitment.schedule_summary}') &&
    signupTemplate.includes('1=$group.organizers'),
  'Commitments must render from the project-grouped summaries.'
);
assert.ok(
  signupTemplate.includes('backToShiftsUrl') &&
    signupForm.includes("ts('Confirm my sign-up'"),
  'Back to shifts and the renamed confirm action must be wired through.'
);
assert.ok(
  signupTemplate.includes('{$form.bringingAdditionalVolunteers.html}') &&
    signupForm.includes("ts('I am bringing other people'") &&
    signupTemplate.includes('{$form.bringingAdditionalVolunteers.label}') &&
    signupTemplate.includes('crm-vol-bringing-copy') &&
    signupTemplate.includes('crm-vol-additional-people'),
  'Additional volunteers must sit behind the disclosure control, labelled once.'
);
// The panel used to be hidden by JS alone, so the quantity field flashed on
// load and stayed visible with JS off -- the quantity-first UI the disclosure
// was meant to replace.
assert.ok(
  signupTemplate.includes('{if !$bringingAdditionalVolunteers} hidden{/if}') &&
    signupStyles.includes('.crm-vol-additional-people[hidden]') &&
    additionalVolunteerScript.includes("removeAttr('hidden')"),
  'The disclosure panel must render collapsed and be revealed by script.'
);
assert.ok(
  signupForm.includes("'aria-expanded'") && signupForm.includes("'aria-controls'") &&
    additionalVolunteerScript.includes("attr('aria-expanded'"),
  'The disclosure must expose its expanded state.'
);
// Read out of the DOM by CRM_Volunteer_Form_VolunteerSignUp.js into a
// CRM.alert; nothing hid it, so descriptions printed inline in the sidebar.
assert.ok(
  signupStyles.includes('[class$="-description-wrapper"]'),
  'The description payload must not render in place.'
);
assert.ok(
  additionalVolunteerScript.includes('clearAdditionalVolunteers') &&
    additionalVolunteerScript.includes('$("#additionalVolunteers .additional-volunteer-profile").remove()'),
  'Unchecking the disclosure must clear the quantity and every generated row.'
);
assert.ok(
  additionalVolunteerScript.includes('max !== null && max !== undefined'),
  'The quantity cap must not apply when the server supplies no finite maximum.'
);
assert.ok(
  signupForm.includes('getMaxAdditionalVolunteers') &&
    signupForm.includes('return NULL;'),
  'Flexible-only selections must produce a null client-side maximum.'
);
assert.ok(
  signupForm.includes('getAdditionalVolunteerQuantity') &&
    signupForm.includes("empty($submittedValues['bringingAdditionalVolunteers'])"),
  'The disclosure checkbox must gate additional volunteers server-side.'
);
assert.ok(
  signupForm.includes("addStyleFile('org.civicrm.volunteer', 'css/public_workflow.css')"),
  'The signup page must load the shared public-workflow stylesheet.'
);
assert.ok(
  !signupTemplate.includes('ui-icon-comment') &&
    signupTemplate.includes('class="crm-i fa-comment"'),
  'Signup descriptions must use current CiviCRM icons rather than jQuery UI sprites.'
);

// Theme: styles must inherit Riverlea tokens rather than hard-coded chrome.
assert.ok(
  signupStyles.includes('var(--crm-layer1-bg-color') &&
    signupStyles.includes('var(--crm-danger-color') &&
    additionalVolunteerStyles.includes('var(--crm-layer1-bg-color') &&
    volunteerStyles.includes('var(--crm-primary-color') &&
    publicWorkflowStyles.includes('--crm-vol-public-hero'),
  'CiviVolunteer layout styles must inherit Riverlea theme tokens.'
);
assert.ok(
  additionalVolunteerScript.includes("ts('Additional volunteer %1'") &&
    !additionalVolunteerStyles.includes(':nth-child(n+2)'),
  'Every additional volunteer must keep visible labels and receive a numbered heading.'
);
assert.ok(
  additionalVolunteerStyles.includes('grid-template-columns: repeat(2, minmax(0, 1fr))') &&
    additionalVolunteerStyles.includes('box-sizing: border-box') &&
    additionalVolunteerStyles.includes('width: 100% !important'),
  'Additional-volunteer Profile fields must use the bounded two-column form grid.'
);
assert.ok(
  signupStyles.includes('@media (max-width: 767px)'),
  'The signup layout must collapse responsively.'
);
// .crm-vol-signup-page .crm-vol-signup-layout outranks the shared
// .crm-vol-signup-layout rule, so if the two stack breakpoints drift apart the
// signup page silently keeps two columns across the gap between them.
assert.ok(
  publicWorkflowStyles.includes('@media (max-width: 900px)') &&
    signupStyles.includes('@media (max-width: 900px)'),
  'Both public layouts must stack at the same breakpoint.'
);
// Once stacked, the panel that says what has been picked has to come first,
// and the action has to stay reachable without scrolling the whole list.
assert.ok(
  publicWorkflowStyles.includes('.crm-vol-shift-bar') &&
    opportunitiesTemplate.includes('class="crm-vol-shift-bar"') &&
    publicWorkflowStyles.includes('order: -1') &&
    signupStyles.includes('order: -1'),
  'Stacked layouts must lead with the summary panel and keep a reachable action.'
);
// Riverlea publishes dark mode by redefining :root tokens, with no class or
// attribute to override. Its --crm-*-ink-color tokens flip to the light colors
// in dark while --crm-*-light-color does not darken, so pairing a light-color
// surface with ink text renders light-on-light.
for (const [sheet, name] of [
  [volunteerStyles, 'ang/volunteer.css'],
  [signupStyles, 'css/signup.css'],
  [publicWorkflowStyles, 'css/public_workflow.css'],
]) {
  const offenders = (sheet.match(/background[^;]*--crm-\w+-light-color/g) || []);
  assert.deepStrictEqual(
    offenders, [],
    `${name} paints a surface from a --crm-*-light-color token (${offenders.join(', ')}); ` +
    'mix against --crm-paper instead so it darkens with the theme.'
  );
}
// The viewport-relative hero arithmetic misaligned the hero from the content
// below it and overflowed on CMSes whose page padding is not 1rem.
const stripCssComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
for (const [sheet, name] of [
  [publicWorkflowStyles, 'css/public_workflow.css'],
  [signupStyles, 'css/signup.css'],
]) {
  assert.ok(
    !/padding[^;{}]*100vw/.test(stripCssComments(sheet)),
    `${name} pads the hero off the viewport; use the containing block so it ` +
    'lines up with the content and cannot overflow.'
  );
}

// Keyboard and assistive-tech affordances -------------------------------
// .crm-vol-status-toggle clips its radios, so the browser's own focus ring is
// clipped with them; without a rule on the label there is no visible focus.
assert.ok(
  volunteerStyles.includes('.crm-vol-status-toggle label:has(input:focus-visible)') &&
    volunteerStyles.includes(':focus-visible') &&
    publicWorkflowStyles.includes(':focus-visible') &&
    signupStyles.includes(':focus-visible'),
  'Every restyled control must show a visible keyboard focus ring.'
);
// The active chip was conveyed by colour alone.
assert.ok(
  (opportunitiesTemplate.match(/aria-pressed=/g) || []).length === 4,
  'Each quick time filter must report its pressed state.'
);
// The live region used to wrap the whole results list, re-announcing every
// card on every filter change.
assert.ok(
  !/aria-live/.test(opportunitiesTemplate) &&
    opportunitiesTemplate.includes('role="status"') &&
    opportunitiesController.includes('$scope.resultsLabel = function()'),
  'Results must announce a count, not re-read the whole list.'
);
// aria-controls pointed at a panel ng-if removes from the DOM exactly when the
// attribute would matter.
assert.ok(
  !opportunitiesTemplate.includes('aria-controls="crm-vol-more-filters"'),
  'aria-controls must not reference a conditionally rendered element.'
);

// The manage table's thead is `position: sticky` via core's .crm-sticky. Giving
// its wrapper overflow-x makes the wrapper the sticky scrollport (overflow-y
// computes from `visible` to `auto`), so the thead resolves
// `top: var(--crm-menubar-bottom)` against the wrapper it already sits at the
// top of -- and is pushed down over the first data row.
{
  const wrap = stripCssComments(volunteerStyles).match(/\.crm-vol-table-wrap\s*\{[^}]*\}/);
  assert.ok(wrap, '.crm-vol-table-wrap must have a rule.');
  assert.ok(
    !/overflow/.test(wrap[0]),
    '.crm-vol-table-wrap must not become a scroll container; it would displace ' +
    'the sticky table header over the first row.'
  );
  assert.ok(
    projectsList.includes('crm-sticky'),
    'The manage table keeps core\'s sticky header.'
  );
  assert.ok(
    volunteerStyles.includes('@media (max-width: 900px)') &&
      /@media \(max-width: 900px\)[\s\S]*?\.crm-vol-manage-page table tbody td::before/.test(volunteerStyles),
    'The manage table must collapse to cards at 900px so six columns never need ' +
    'horizontal scrolling.'
  );
}

// Dead code ------------------------------------------------------------
for (const orphan of [
  'crm-vol-opportunity-table', 'crm-vol-opp-cart-list', 'crm-vol-results-heading',
  'crm-vol-select-control', 'crm-vol-selection-panel', 'crm-vol-selection-summary',
  'crm-vol-filter-footer',
]) {
  assert.ok(
    !volunteerStyles.includes(orphan),
    `${orphan} has no markup left; its rules must not linger in the stylesheet.`
  );
}

console.log('CiviVolunteer Riverlea layout source checks passed.');
