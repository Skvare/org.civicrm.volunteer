{*
+--------------------------------------------------------------------+
| Copyright CiviCRM LLC. Licensed under AGPLv3.                      |
+--------------------------------------------------------------------+
*}
{strip}
{* Contains JavaScript templates for the volunteer-needs application. *}

<script type="text/template" id="crm-vol-define-layout-tpl">
  <% if (projectTitle) { %>
    <div class="crm-vol-project-context"><span>{ts domain='org.civicrm.volunteer'}Volunteer project{/ts}</span><strong><%- projectTitle %></strong></div>
  <% } %>
  <div class="crm-vol-dialog-intro">
    <i aria-hidden="true" class="crm-i fa-save"></i>
    <div>
      <strong>{ts domain='org.civicrm.volunteer'}Changes save automatically{/ts}</strong>
      <span>{ts domain='org.civicrm.volunteer'}Define how many volunteers are needed for each role and when they are needed.{/ts}</span>
    </div>
    {help id="volunteer-define" file="CRM/Volunteer/Page/Backbone/Define.hlp" isModulePermissionSupported="$isModulePermissionSupported"}
  </div>
  <form class="crm-block crm-form-block crm-event-manage-volunteer-form-block crm-vol-dialog-form">
    <section class="crm-vol-dialog-section">
      <header class="crm-vol-section-heading">
        <div>
          <h2>{ts domain='org.civicrm.volunteer'}Scheduled opportunities{/ts}</h2>
          <p>{ts domain='org.civicrm.volunteer'}Create a separate opportunity for each role and schedule.{/ts}</p>
        </div>
      </header>
      <div id="crm-vol-define-scheduled-needs-region">
        <div class="crm-loading-element">{ts domain='org.civicrm.volunteer'}Loading&hellip;{/ts}</div>
      </div>
    </section>
    <div id="crm-vol-define-flexible-needs-region"></div>
  </form>
</script>

<script type="text/template" id="crm-vol-define-table-tpl">
  <div class="crm-vol-define-toolbar panel panel-default">
    <div>
      <label for="crm-vol-define-add-need">{ts domain='org.civicrm.volunteer'}Add an opportunity{/ts}</label>
      <p>{ts domain='org.civicrm.volunteer'}Choose the volunteer role to create and configure another opportunity.{/ts}</p>
    </div>
    <select class="crm-form-select crm-action-menu action-icon-plus" id="crm-vol-define-add-need">
      <option value="">{ts domain='org.civicrm.volunteer'}Select a role{/ts}</option>
      {crmAPI var='result' entity='VolunteerNeed' action='getoptions' field='role_id' sequential=0}
      {foreach from=$result.values item=VolunteerNeed key=id}
        <option value="{$id}">{$VolunteerNeed}</option>
      {/foreach}
    </select>
  </div>
  <div class="messages status no-popup crm-vol-define-empty">
    <i aria-hidden="true" class="crm-i fa-calendar-plus-o"></i>
    <div>
      <strong>{ts domain='org.civicrm.volunteer'}No scheduled opportunities{/ts}</strong>
      <p>{ts domain='org.civicrm.volunteer'}Choose a role above to define the first volunteer opportunity.{/ts}</p>
    </div>
  </div>
  <div class="crm-vol-define-needs-list"></div>
</script>

<script type="text/template" id="crm-vol-define-scheduled-need-tpl">
  <div class="panel-heading crm-vol-define-card-heading">
    <label class="crm-vol-field crm-vol-role-field">
      <span>{ts domain='org.civicrm.volunteer'}Volunteer role{/ts}</span>
      {literal}
        <%= RenderUtil.select({
        apiEntity: 'volunteer_need',
        apiField: 'role_id',
        name: 'role_id',
        optionEditPath: 'civicrm/admin/options/volunteer_role',
        options: pseudoConstant.volunteer_role,
        selected: role_id
        }) %>
      {/literal}
    </label>
    <div class="crm-vol-card-state-actions">
      <span class="crm-vol-save-state" data-state="saved" aria-live="polite">
        <span data-save-state="saving"><i aria-hidden="true" class="crm-i fa-spinner fa-spin"></i> {ts domain='org.civicrm.volunteer'}Saving{/ts}</span>
        <span data-save-state="saved"><i aria-hidden="true" class="crm-i fa-check"></i> {ts domain='org.civicrm.volunteer'}Saved{/ts}</span>
        <span data-save-state="error"><i aria-hidden="true" class="crm-i fa-exclamation-triangle"></i> {ts domain='org.civicrm.volunteer'}Not saved{/ts}</span>
      </span>
      <a href="#" class="crm-vol-del crm-hover-button action-item crm-vol-destructive-action" title="{ts escape='htmlattribute' domain='org.civicrm.volunteer'}Delete this opportunity{/ts}">
        <i aria-hidden="true" class="crm-i fa-trash"></i>
        {ts domain='org.civicrm.volunteer'}Delete{/ts}
      </a>
    </div>
  </div>
  <div class="panel-body">
    <div class="crm-vol-define-primary-fields">
      <label class="crm-vol-field">
        <span>{ts domain='org.civicrm.volunteer'}Volunteers needed{/ts}</span>
        <input type="number" min="0" step="1" class="crm-form-text" name="quantity" value="<%= quantity %>" inputmode="numeric">
      </label>
      <label class="crm-vol-field crm-vol-schedule-type">
        <span>{ts domain='org.civicrm.volunteer'}Schedule type{/ts}</span>
        <span class="crm-vol-control-with-help">
          <select name="schedule_type">
            <option value="">{ts domain='org.civicrm.volunteer'}Select one{/ts}</option>
            <option value="shift">{ts domain='org.civicrm.volunteer'}Set shift{/ts}</option>
            <option value="flexible">{ts domain='org.civicrm.volunteer'}Flexible timeframe{/ts}</option>
            <option value="open">{ts domain='org.civicrm.volunteer'}Open-ended{/ts}</option>
          </select>
          {help id="volunteer-define-schedule_type" file="CRM/Volunteer/Page/Backbone/Define.hlp"}
        </span>
      </label>
    </div>

    <fieldset class="time_components crm-vol-schedule-fields">
      <legend>{ts domain='org.civicrm.volunteer'}Schedule{/ts}</legend>
      <label class="start_datetime crm-vol-field">
        <span>{ts domain='org.civicrm.volunteer'}Start date and time{/ts}</span>
        <span class="crm-vol-date-time-fields">
          <input type="text" class="crm-form-text dateplugin" name="display_start_date" value="<%= display_start_date %>" size="12">
          <input type="text" class="crm-form-text" name="display_start_time" size="8">
        </span>
      </label>
      <label class="end_datetime crm-vol-field">
        <span>{ts domain='org.civicrm.volunteer'}End date and time{/ts}</span>
        <span class="crm-vol-date-time-fields">
          <input type="text" class="crm-form-text dateplugin" name="display_end_date" value="<%= display_end_date %>" size="12">
          <input type="text" class="crm-form-text" name="display_end_time" size="8">
        </span>
      </label>
      <label class="duration crm-vol-field">
        <span>{ts domain='org.civicrm.volunteer'}Duration{/ts}</span>
        <span class="crm-vol-input-suffix">
          <input type="number" min="0" step="1" class="crm-form-text" name="duration" value="<%= duration %>" inputmode="numeric">
          <span>{ts domain='org.civicrm.volunteer'}minutes{/ts}</span>
        </span>
      </label>
    </fieldset>

    <div class="crm-vol-toggle-group">
      <label class="crm-vol-toggle-field">
        <input type="checkbox" name="visibility_id" value="<%= visibilityValue %>">
        <span>
          <strong>{ts domain='org.civicrm.volunteer'}Visible on public signup{/ts}</strong>
          <small>{ts domain='org.civicrm.volunteer'}Allow visitors to select this opportunity.{/ts}</small>
        </span>
      </label>
      <label class="crm-vol-toggle-field">
        <input type="checkbox" name="is_active" value="1">
        <span>
          <strong>{ts domain='org.civicrm.volunteer'}Opportunity is active{/ts}</strong>
          <small>{ts domain='org.civicrm.volunteer'}Inactive opportunities are retained but unavailable for assignment.{/ts}</small>
        </span>
      </label>
    </div>
  </div>
</script>

<script type="text/template" id="crm-vol-define-flexible-need-tpl">
  <section class="panel panel-default crm-vol-flexible-signup-panel">
    <div class="panel-heading">
      <div class="crm-vol-flexible-heading">
        <h2 class="panel-title">{ts domain='org.civicrm.volunteer'}General availability{/ts}</h2>
        <span class="crm-vol-save-state" data-state="saved" aria-live="polite">
          <span data-save-state="saving"><i aria-hidden="true" class="crm-i fa-spinner fa-spin"></i> {ts domain='org.civicrm.volunteer'}Saving{/ts}</span>
          <span data-save-state="saved"><i aria-hidden="true" class="crm-i fa-check"></i> {ts domain='org.civicrm.volunteer'}Saved{/ts}</span>
          <span data-save-state="error"><i aria-hidden="true" class="crm-i fa-exclamation-triangle"></i> {ts domain='org.civicrm.volunteer'}Not saved{/ts}</span>
        </span>
      </div>
    </div>
    <div class="panel-body">
      <label class="crm-vol-toggle-field">
        <input type="checkbox" name="visibility_id" value="<%= visibilityValue %>">
        <span>
          <strong>{ts domain='org.civicrm.volunteer'}Allow signup without selecting a shift{/ts}</strong>
          <small>{ts domain='org.civicrm.volunteer'}These volunteers appear in the available pool for later assignment.{/ts}</small>
        </span>
      </label>
    </div>
  </section>
</script>
{/strip}
