<?php

namespace Civi\Api4\Action\VolunteerProject;

use Civi\Api4\Generic\AbstractAction;
use Civi\Api4\Generic\Result;

class GetManageData extends AbstractAction {

  /**
   * Filters to apply to the managed-projects listing.
   *
   * @var array
   */
  protected $filters = [];

  public function _run(Result $result) {
    foreach (\CRM_Volunteer_BAO_Project::getManageData($this->filters, $this->getCheckPermissions()) as $row) {
      $result[] = $row;
    }
  }

}
