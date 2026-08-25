<?php

namespace Civi\Api4\Action\VolunteerUtil;

use Civi\Api4\Generic\AbstractAction;
use Civi\Api4\Generic\Result;

class LoadBackbone extends AbstractAction {

  public function _run(Result $result) {
    $result[] = \CRM_Volunteer_BAO_VolunteerUtil::loadBackbone();
  }

}
