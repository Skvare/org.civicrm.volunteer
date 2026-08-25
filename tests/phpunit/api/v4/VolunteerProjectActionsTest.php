<?php

require_once __DIR__ . '/../../VolunteerTestAbstract.php';

use Civi\Api4\VolunteerProject;

/**
 * Tests the custom API4 actions that replaced VolunteerProject's APIv3-only
 * actions: commit, search, getManageData, getLocationOptions, getLocation,
 * saveLocation and removeProfile.
 *
 * @group headless
 */
class api_v4_VolunteerProjectActionsTest extends VolunteerTestAbstract {

  /**
   * commit() is the aggregate write: contacts, profiles and location in one go.
   */
  public function testCommitWritesTheWholeAggregate(): void {
    $beneficiaryId = $this->individualCreate();
    $profileId = $this->createProfile('API4 commit profile');

    $project = VolunteerProject::commit(FALSE)
      ->setValues(array(
        'title' => 'Committed project',
        'is_active' => TRUE,
        'project_contacts' => array(
          'volunteer_owner' => array($this->getMockedContactId()),
          'volunteer_beneficiary' => array($beneficiaryId),
        ),
        'profiles' => array(
          array('uf_group_id' => $profileId, 'module_data' => array('audience' => 'primary')),
        ),
      ))
      ->execute()
      ->single();

    $projectId = (int) $project['id'];
    $this->assertSame('Committed project', $project['title']);
    // VOL-269: a flexible need is created alongside a new project.
    $this->assertNotNull(CRM_Volunteer_BAO_Project::getFlexibleNeedID($projectId));
    $this->assertSame(
      array($beneficiaryId),
      CRM_Volunteer_BAO_Project::getContactsByRelationship($projectId, 'volunteer_beneficiary')
    );

    $joins = \Civi\Api4\UFJoin::get(FALSE)
      ->addSelect('uf_group_id')
      ->addWhere('entity_table', '=', 'civicrm_volunteer_project')
      ->addWhere('entity_id', '=', $projectId)
      ->addWhere('module', '=', 'CiviVolunteer')
      ->execute()
      ->column('uf_group_id');
    $this->assertSame(array($profileId), array_map('intval', $joins));
  }

  /**
   * search() exposes the aggregate filters that the DAO-backed get cannot.
   */
  public function testSearchAppliesRelationshipFilters(): void {
    $ownerId = $this->individualCreate();
    $mine = $this->createProject(array(
      'title' => 'Searchable by owner',
      'project_contacts' => array('volunteer_owner' => array($ownerId)),
    ));
    $this->createProject(array(
      'title' => 'Owned by somebody else',
      'project_contacts' => array('volunteer_owner' => array($this->individualCreate())),
    ));

    $found = VolunteerProject::search(FALSE)
      ->setContext('edit')
      ->setFilters(array('project_contacts' => array('volunteer_owner' => array($ownerId))))
      ->execute()
      ->column('id');
    $this->assertSame(array((int) $mine['id']), array_map('intval', $found));
  }

  /**
   * A public search is limited to active projects and safe fields, and its
   * profile metadata keeps APIv3's JSON-string shape.
   */
  public function testPublicSearchTrimsFieldsAndKeepsModuleDataAsJson(): void {
    $profileId = $this->createProfile('API4 public search profile');
    $active = $this->createProject(array(
      'title' => 'Publicly searchable',
      'description' => '<p>Safe</p><script>bad()</script>',
      'is_active' => 1,
      'profiles' => array(
        array('uf_group_id' => $profileId, 'module_data' => array('audience' => 'both')),
      ),
    ));

    $row = VolunteerProject::search(FALSE)
      ->setFilters(array('id' => $active['id']))
      ->execute()
      ->single();

    $this->assertSame(
      array('id', 'title', 'description', 'is_active', 'loc_block_id', 'campaign_id', 'profiles'),
      array_keys($row)
    );
    $this->assertStringNotContainsString('<script', $row['description']);
    $this->assertCount(1, $row['profiles']);
    $profile = reset($row['profiles']);
    $this->assertSame($profileId, (int) $profile['uf_group_id']);
    // module_data keeps APIv3's JSON-string shape, not API4's deserialized
    // array, because every consumer of this read parses a string.
    $this->assertIsString($profile['module_data']);
    $this->assertSame(
      array('audience' => 'both'),
      json_decode($profile['module_data'], TRUE),
      'Stored module_data was ' . var_export(\Civi\Api4\UFJoin::get(FALSE)
        ->addSelect('module_data')
        ->addWhere('entity_id', '=', $active['id'])
        ->execute()
        ->column('module_data'), TRUE)
    );
  }

  /**
   * getManageData() adds the beneficiary and location payloads the Angular
   * manage listing renders on top of the search result.
   */
  public function testGetManageDataReturnsEverythingTheListingRenders(): void {
    $beneficiaryId = $this->individualCreate();
    $project = $this->createProject(array(
      'title' => 'Manage listing project',
      'project_contacts' => array(
        'volunteer_owner' => array($this->getMockedContactId()),
        'volunteer_beneficiary' => array($beneficiaryId),
      ),
      'location' => $this->locationValues(),
    ));

    $rows = VolunteerProject::getManageData(FALSE)
      ->setFilters(array('id' => $project['id'], 'context' => 'edit'))
      ->execute();
    $row = $rows->single();

    foreach (array('id', 'title', 'is_active', 'profiles', 'beneficiaries', 'location', 'entity_attributes') as $key) {
      $this->assertArrayHasKey($key, $row, "getManageData omitted $key.");
    }
    $this->assertSame(array($beneficiaryId), array_map('intval', $row['beneficiaries']));
    $this->assertSame('Volunteer HQ', $row['location']['address']['name']);
    $this->assertSame('Springfield', $row['location']['address']['city']);
  }

  /**
   * The location actions round-trip a location block.
   */
  public function testLocationActionsRoundTrip(): void {
    $project = $this->createProject(array(
      'title' => 'Location round trip',
      'project_contacts' => array('volunteer_owner' => array($this->getMockedContactId())),
      'location' => $this->locationValues(),
    ));
    $projectId = (int) $project['id'];
    $locBlockId = (int) $project['loc_block_id'];
    $this->assertGreaterThan(0, $locBlockId);

    $options = VolunteerProject::getLocationOptions(FALSE)
      ->setProjectId($projectId)
      ->execute();
    $this->assertContains($locBlockId, array_map('intval', $options->column('id')));
    $this->assertStringContainsString('Volunteer HQ', $options->first()['title']);

    $loaded = VolunteerProject::getLocation(FALSE)
      ->setId($locBlockId)
      ->setProjectId($projectId)
      ->execute()
      ->single();
    $this->assertSame($locBlockId, (int) $loaded['id']);
    $this->assertSame('Volunteer HQ', $loaded['address']['name']);
    $this->assertSame('hq@example.org', $loaded['email']['email']);
    $this->assertSame('555-0100', $loaded['phone']['phone']);

    $saved = VolunteerProject::saveLocation(FALSE)
      ->setProjectId($projectId)
      ->setValues($this->locationValues(array('name' => 'Second site', 'city' => 'Shelbyville')))
      ->execute()
      ->single();
    $this->assertGreaterThan(0, (int) $saved['id']);
    $this->assertNotSame($locBlockId, (int) $saved['id']);
  }

  /**
   * A location that belongs to neither the project nor the site default is
   * refused, so a caller cannot read arbitrary loc blocks.
   */
  public function testGetLocationRejectsForeignLocationBlocks(): void {
    $mine = $this->createProject(array(
      'title' => 'Owns a location',
      'location' => $this->locationValues(),
    ));
    $theirs = $this->createProject(array(
      'title' => 'Owns another location',
      'location' => $this->locationValues(array('name' => 'Not yours')),
    ));

    $this->expectException(CRM_Core_Exception::class);
    $this->expectExceptionMessage('does not belong');
    VolunteerProject::getLocation(FALSE)
      ->setId($theirs['loc_block_id'])
      ->setProjectId($mine['id'])
      ->execute();
  }

  /**
   * removeProfile() detaches a profile, and refuses a cross-project join.
   */
  public function testRemoveProfileDetachesOnlyItsOwnProjectsJoin(): void {
    $profileId = $this->createProfile('API4 removable profile');
    $mine = $this->createProject(array(
      'title' => 'Profile owner',
      'project_contacts' => array('volunteer_owner' => array($this->getMockedContactId())),
      'profiles' => array(array('uf_group_id' => $profileId)),
    ));
    $theirs = $this->createProject(array(
      'title' => 'Other profile owner',
      'profiles' => array(array('uf_group_id' => $profileId)),
    ));

    $joinIds = array();
    foreach (array($mine, $theirs) as $project) {
      $joinIds[(int) $project['id']] = (int) \Civi\Api4\UFJoin::get(FALSE)
        ->addSelect('id')
        ->addWhere('entity_table', '=', 'civicrm_volunteer_project')
        ->addWhere('entity_id', '=', $project['id'])
        ->addWhere('module', '=', 'CiviVolunteer')
        ->execute()
        ->single()['id'];
    }

    try {
      VolunteerProject::removeProfile(FALSE)
        ->setId($joinIds[(int) $theirs['id']])
        ->setProjectId($mine['id'])
        ->execute();
      $this->fail('A profile join was removed through an unrelated project.');
    }
    catch (CRM_Core_Exception $e) {
      $this->assertStringContainsString('does not belong', $e->getMessage());
    }

    VolunteerProject::removeProfile(FALSE)
      ->setId($joinIds[(int) $mine['id']])
      ->setProjectId($mine['id'])
      ->execute();

    $this->assertCount(
      0,
      \Civi\Api4\UFJoin::get(FALSE)->addWhere('id', '=', $joinIds[(int) $mine['id']])->execute()
    );
    $this->assertCount(
      1,
      \Civi\Api4\UFJoin::get(FALSE)->addWhere('id', '=', $joinIds[(int) $theirs['id']])->execute()
    );
  }

  /**
   * The custom actions enforce project permissions when asked to.
   */
  public function testCustomActionsRefuseUnprivilegedCallers(): void {
    $project = $this->createProject(array('title' => 'Guarded custom actions'));

    CRM_Core_Config::singleton()->userPermissionClass->permissions = array(
      'access CiviCRM',
      'register to volunteer',
    );

    foreach (array('getManageData', 'getManageOverview', 'getLocationOptions', 'commit') as $action) {
      try {
        $call = VolunteerProject::$action(TRUE);
        if ($action === 'commit') {
          $call->setValues(array('id' => $project['id'], 'title' => 'Renamed'));
        }
        if ($action === 'getManageData' || $action === 'getManageOverview') {
          $call->setFilters(array('id' => $project['id']));
        }
        if ($action === 'getLocationOptions') {
          $call->setProjectId($project['id']);
        }
        $call->execute();
        $this->fail("VolunteerProject.$action ran without project rights.");
      }
      catch (Throwable $e) {
        $this->addToAssertionCount(1);
      }
    }
  }

  /**
   * The management screen loads for a project editor, not just an administrator.
   *
   * getManageOverview is a custom action, so it needs its own entry in
   * VolunteerProject::permissions(). Without one, APIv4 falls back to the
   * 'default' permission — 'administer CiviCRM' — and the redesigned Manage
   * Projects page is rejected for exactly the users it is built for.
   */
  public function testManageOverviewRunsForProjectEditors(): void {
    $project = $this->createProject(array('title' => 'Editor visible project'));

    CRM_Core_Config::singleton()->userPermissionClass->permissions = array(
      'access CiviCRM',
      'edit own volunteer projects',
    );

    $overview = VolunteerProject::getManageOverview(TRUE)
      ->setFilters(array('id' => $project['id']))
      ->execute()
      ->single();

    $this->assertArrayHasKey('summary', $overview);
    $this->assertArrayHasKey('projects', $overview);
    $this->assertContains(
      (int) $project['id'],
      array_map('intval', array_column($overview['projects'], 'id'))
    );
  }


  /**
   * Nested location values for a project write.
   *
   * @param array $address
   * @return array
   */
  private function locationValues(array $address = array()): array {
    return array(
      'address' => $address + array(
        'name' => 'Volunteer HQ',
        'street_address' => '1 Main St',
        'city' => 'Springfield',
      ),
      'email' => array('email' => 'hq@example.org'),
      'phone' => array('phone' => '555-0100'),
    );
  }

  /**
   * @param string $title
   * @return int
   */
  private function createProfile(string $title): int {
    $group = \Civi\Api4\UFGroup::create(FALSE)
      ->addValue('title', $title)
      ->addValue('is_active', TRUE)
      ->execute()
      ->single();
    return (int) $group['id'];
  }

}
