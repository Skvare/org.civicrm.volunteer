{*
+--------------------------------------------------------------------+
| Copyright CiviCRM LLC. Licensed under AGPLv3.                      |
+--------------------------------------------------------------------+
*}
{strip}
{* Contains JavaScript templates for the volunteer-assignment application. *}

<script type="text/template" id="crm-vol-assign-layout-tpl">
  <% if (projectTitle) { %>
    <div class="crm-vol-project-context"><span>{ts domain='org.civicrm.volunteer'}Volunteer project{/ts}</span><strong><%- projectTitle %></strong></div>
  <% } %>
  <div class="crm-vol-dialog-intro">
    <i aria-hidden="true" class="crm-i fa-save"></i>
    <div>
      <strong>{ts domain='org.civicrm.volunteer'}Assignments save automatically{/ts}</strong>
      <span>{ts domain='org.civicrm.volunteer'}Move available volunteers into a shift, or search for additional contacts.{/ts}</span>
    </div>
  </div>
  <div class="crm-vol-assign-workspace">
    <aside id="crm-vol-assign-flexible-region" aria-label="{ts escape='htmlattribute' domain='org.civicrm.volunteer'}Available volunteers{/ts}">
      <div class="crm-loading-element">{ts domain='org.civicrm.volunteer'}Loading&hellip;{/ts}</div>
    </aside>
    <main id="crm-vol-assign-scheduled-region">
      <div class="crm-loading-element">{ts domain='org.civicrm.volunteer'}Loading&hellip;{/ts}</div>
    </main>
  </div>
  <div id="crm-vol-assign-empty" class="messages status no-popup crm-vol-assign-empty">
    <i aria-hidden="true" class="crm-i fa-calendar-times-o"></i>
    <div>
      <strong>{ts domain='org.civicrm.volunteer'}No active scheduled opportunities{/ts}</strong>
      <p>{ts domain='org.civicrm.volunteer'}Define and enable an opportunity before assigning volunteers to a shift.{/ts}</p>
    </div>
  </div>
</script>

<script type="text/template" id="crm-vol-scheduled-assignment-tpl">
  <td class="crm-vol-name" data-label="{ts escape='htmlattribute' domain='org.civicrm.volunteer'}Volunteer{/ts}">
    <button type="button" class="crm-vol-drag" title="{ts escape='htmlattribute' domain='org.civicrm.volunteer'}Drag to move this volunteer{/ts}">
      <i aria-hidden="true" class="crm-i fa-arrows"></i>
      <span class="sr-only">{ts domain='org.civicrm.volunteer'}Move volunteer{/ts}</span>
    </button>
    <a class="crm-vol-assignee-name" target="_blank" rel="noopener" href="<%- contactUrl(contact_id) %>"><%- display_name %></a>
    {literal}<% if (details) { %>{/literal}
      <a href="#" class="crm-vol-info" title="{ts escape='htmlattribute' domain='org.civicrm.volunteer'}View volunteer notes{/ts}">
        <i aria-hidden="true" class="crm-i fa-info-circle"></i>
        <span class="sr-only">{ts domain='org.civicrm.volunteer'}View notes{/ts}</span>
      </a>
    {literal}<% } %>{/literal}
    <div class="crm-vol-menu">
      <a class="crm-vol-menu-button" href="#" aria-haspopup="true" aria-expanded="false" title="{ts escape='htmlattribute' domain='org.civicrm.volunteer'}Volunteer actions{/ts}">
        <i aria-hidden="true" class="crm-i fa-ellipsis-v"></i>
        <span class="sr-only">{ts domain='org.civicrm.volunteer'}Volunteer actions{/ts}</span>
      </a>
    </div>
  </td>
  <td data-label="{ts escape='htmlattribute' domain='org.civicrm.volunteer'}Email{/ts}"><%- email %></td>
  <td data-label="{ts escape='htmlattribute' domain='org.civicrm.volunteer'}Phone{/ts}"><%- phone %></td>
</script>

<script type="text/template" id="crm-vol-flexible-assignment-tpl">
  <td class="crm-vol-name" data-label="{ts escape='htmlattribute' domain='org.civicrm.volunteer'}Volunteer{/ts}">
    <button type="button" class="crm-vol-drag" title="{ts escape='htmlattribute' domain='org.civicrm.volunteer'}Drag to assign this volunteer{/ts}">
      <i aria-hidden="true" class="crm-i fa-arrows"></i>
      <span class="sr-only">{ts domain='org.civicrm.volunteer'}Assign volunteer{/ts}</span>
    </button>
    <a class="crm-vol-assignee-name" target="_blank" rel="noopener" href="<%- contactUrl(contact_id) %>"><%- display_name %></a>
    {literal}<% if (details) { %>{/literal}
      <a href="#" class="crm-vol-info" title="{ts escape='htmlattribute' domain='org.civicrm.volunteer'}View volunteer notes{/ts}">
        <i aria-hidden="true" class="crm-i fa-info-circle"></i>
        <span class="sr-only">{ts domain='org.civicrm.volunteer'}View notes{/ts}</span>
      </a>
    {literal}<% } %>{/literal}
    <div class="crm-vol-menu">
      <a class="crm-vol-menu-button" href="#" aria-haspopup="true" aria-expanded="false" title="{ts escape='htmlattribute' domain='org.civicrm.volunteer'}Volunteer actions{/ts}">
        <i aria-hidden="true" class="crm-i fa-ellipsis-v"></i>
        <span class="sr-only">{ts domain='org.civicrm.volunteer'}Volunteer actions{/ts}</span>
      </a>
    </div>
  </td>
</script>

<script type="text/template" id="crm-vol-scheduled-tpl">
  <div class="panel-heading crm-vol-assign-shift-heading">
    <div>
      <h2 class="panel-title"><%- pseudoConstant.volunteer_role[role_id] %></h2>
      <p><%- display_time %></p>
    </div>
    <div class="crm-vol-capacity-summary" aria-live="polite">
      <span class="crm-vol-capacity"></span>
      <small class="crm-vol-capacity-detail"></small>
    </div>
  </div>
  <div class="panel-body">
    <div class="crm-vol-need-ctrls">
      <button type="button" class="crm-vol-search crm-hover-button">
        <i aria-hidden="true" class="crm-i fa-search"></i>
        {ts domain='org.civicrm.volunteer'}Search contacts{/ts}
      </button>
    </div>
    <table class="row-highlight crm-vol-assignment-table">
      <thead>
        <tr>
          <th scope="col">{ts domain='org.civicrm.volunteer'}Volunteer{/ts}</th>
          <th scope="col">{ts domain='org.civicrm.volunteer'}Email{/ts}</th>
          <th scope="col">{ts domain='org.civicrm.volunteer'}Phone{/ts}</th>
        </tr>
      </thead>
      <tbody class="crm-vol-assignment-list"></tbody>
    </table>
  </div>
</script>

<script type="text/template" id="crm-vol-flexible-tpl">
  <div class="panel-heading">
    <h2 class="panel-title">{ts domain='org.civicrm.volunteer'}Available volunteers{/ts}</h2>
    <p>{ts domain='org.civicrm.volunteer'}People who signed up without choosing a shift.{/ts}</p>
  </div>
  <div class="panel-body">
    <table class="row-highlight crm-vol-assignment-table crm-vol-available-table">
      <thead>
        <tr><th scope="col">{ts domain='org.civicrm.volunteer'}Volunteer{/ts}</th></tr>
      </thead>
      <tbody class="crm-vol-assignment-list"></tbody>
    </table>
    <div class="crm-vol-add-available">
      <label for="crm-vol-add-available-<%= id %>">{ts domain='org.civicrm.volunteer'}Add to available volunteers{/ts}</label>
      <input id="crm-vol-add-available-<%= id %>" name="add-volunteer" class="crm-form-text" placeholder="{ts escape='htmlattribute' domain='org.civicrm.volunteer' escape='js'}Search for a contact{/ts}" />
    </div>
  </div>
</script>

<script type="text/template" id="crm-vol-menu-tpl">
  <div class="crm-vol-menu-items">
    <ul class="crm-vol-menu-list">
      <li>
        <a href="#" class="crm-vol-menu-parent">{ts domain='org.civicrm.volunteer'}Move to{/ts}</a>
        <ul class="crm-vol-menu-move-to"></ul>
      </li>
      <li>
        <a href="#" class="crm-vol-menu-parent">{ts domain='org.civicrm.volunteer'}Copy to{/ts}</a>
        <ul class="crm-vol-menu-copy-to"></ul>
      </li>
      <li><a class="crm-vol-del" href="#"><i aria-hidden="true" class="crm-i fa-trash"></i> {ts domain='org.civicrm.volunteer'}Remove volunteer{/ts}</a></li>
    </ul>
  </div>
</script>

<script type="text/template" id="crm-vol-menu-item-tpl">
  <li class="crm-vol-menu-item"><a href="#<%= cid %>"><strong><%- title %></strong> <%- time %></a></li>
</script>
{/strip}
