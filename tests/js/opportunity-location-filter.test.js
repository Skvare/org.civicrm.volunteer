'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(extensionRoot, relativePath), 'utf8');

const template = read('ang/volunteer/VolOppsCtrl.html');
const controller = read('ang/volunteer/VolOppsCtrl.js');
const app = read('ang/volunteer.js');
const projectBao = read('CRM/Volunteer/BAO/Project.php');
const utilBao = read('CRM/Volunteer/BAO/VolunteerUtil.php');

assert.ok(
  template.includes('state.id as state.name for state in stateProvinces') &&
    template.includes('locationFilters.state_province_id') &&
    controller.includes("crmApi4('StateProvince', 'get'") &&
    controller.includes("where: [['country_id', '=', countryId]]"),
  'Location filters must load CiviCRM State/Province values for the selected country.'
);
assert.ok(
  controller.includes('country.is_default == 1') &&
    controller.includes('$scope.locationFilters.country = $scope.defaultCountryId') &&
    controller.includes('$scope.searchParams.proximity.country = parseInt(selectedCountry.id, 10)') &&
    template.includes('value.id as value.name for (key, value) in countries'),
  'Country must default from CiviCRM Core and normalize bookmarked values to numeric IDs.'
);
assert.ok(
  controller.includes('$scope.locationFilters = angular.copy($scope.searchParams.proximity)') &&
    controller.includes('$scope.searchParams.proximity = angular.copy($scope.locationFilters)') &&
    template.includes('!groups.length && !flexibleNeeds.length'),
  'The displayed default must remain a draft until Apply, and flexible results must suppress the empty state.'
);
assert.ok(
  template.includes('ng-disabled="!proximityAvailable"') &&
    template.includes('ng-required="isProximitySearch"') &&
    template.includes('Distance filtering requires the Geocoder extension'),
  'Only the distance controls should be conditionally enabled and required.'
);
assert.ok(
  !/name="postal_code"[^>]*ng-required/.test(template) &&
    !/name="country"[^>]*ng-required/.test(template),
  'Postal code and country must remain optional ordinary address filters.'
);
assert.ok(
  controller.includes('$scope.proximityAvailable = !!supporting_data.proximity_available') &&
    controller.includes('$scope.isProximitySearch = $scope.proximityAvailable') &&
    controller.includes('$scope.locationCenterMissing'),
  'The controller must derive distance validation from the server capability and radius.'
);
assert.ok(
  controller.includes("delete $scope.searchParams.proximity.radius") &&
    controller.includes("delete $scope.searchParams.proximity.unit") &&
    controller.includes('if (!$scope.hasLocationSearch)'),
  'Unavailable distance values must be removed without clearing ordinary location fields.'
);
assert.ok(
  !app.includes('clearResult();') &&
    app.includes('Replace the visible rows only after a successful response') &&
    controller.includes("ts('Search not completed')"),
  'A failed geocode must preserve the previous results and present an error.'
);
assert.ok(
  utilBao.includes("isEnabled('org.wikimedia.geocoder')") &&
    utilBao.includes("getUsableClassName() === 'CRM_Utils_Geocode_Geocoder'"),
  'The public capability must require the enabled, configured Geocoder extension.'
);
assert.ok(
  projectBao.includes('Address::getCoordinates(FALSE)') &&
    projectBao.includes('CRM_Contact_BAO_ProximityQuery::where') &&
    projectBao.includes('LOWER(civicrm_address.city) = LOWER(@city)') &&
    projectBao.includes('civicrm_address.postal_code LIKE @postal_code'),
  'Project retrieval must reuse core geocoding/proximity code and keep ordinary address matching.'
);

console.log('Volunteer opportunity location-filter source checks passed.');
