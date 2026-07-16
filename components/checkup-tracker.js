/**
 * CheckupTracker — well-child visit tracking component.
 *
 * Renders the next-checkup highlight box and full visit history table.
 * Uses window.WELL_CHILD_VISITS for the AAP schedule.
 */
window.CheckupTracker = (function () {
  'use strict';

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function ageInMonths(dob) {
    var d1 = new Date(dob + 'T00:00:00');
    var now = new Date();
    return (now.getFullYear() - d1.getFullYear()) * 12 +
           (now.getMonth() - d1.getMonth()) +
           (now.getDate() - d1.getDate()) / 30.44;
  }

  function formatAge(months) {
    if (months < 1) return 'Newborn';
    if (months < 24) {
      var m = Math.round(months);
      return m + ' month' + (m !== 1 ? 's' : '');
    }
    var y = Math.floor(months / 12);
    var mo = Math.round(months % 12);
    var str = y + ' year' + (y !== 1 ? 's' : '');
    if (mo > 0) str += ', ' + mo + ' month' + (mo !== 1 ? 's' : '');
    return str;
  }

  function addMonthsToDate(dob, months) {
    var d = new Date(dob + 'T00:00:00');
    d.setMonth(d.getMonth() + months);
    return d;
  }

  function dateToISO(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  // ─────────────────── public ───────────────────

  function render(container, checkupTbody, childData, currentDate, child) {
    var checkups = childData.checkups || [];
    var dob = child ? child.dob : null;

    // If no well-child visit data, show message
    if (typeof window.WELL_CHILD_VISITS === 'undefined' || !window.WELL_CHILD_VISITS || !dob) {
      if (container) {
        container.innerHTML =
          '<div class="next-checkup-box">' +
            '<p class="empty-state">Add a child with a date of birth to see checkup recommendations.</p>' +
          '</div>';
      }
      if (checkupTbody) checkupTbody.innerHTML = '';
      return;
    }

    var currentAgeMonths = ageInMonths(dob);
    var visits = window.WELL_CHILD_VISITS;

    // Build visit rows with status
    var rows = visits.map(function (visit) {
      var ageMonth = visit.ageMonths != null ? visit.ageMonths : visit.age;
      var label = visit.label || visit.visitLabel || formatAge(ageMonth);
      var windowStart = visit.windowStart || ageMonth;
      var windowEnd = visit.windowEnd || ageMonth + 1;

      // Check if logged
      var logged = checkups.find(function (c) { return c.visitLabel === label; });

      var status;
      if (logged) {
        status = 'completed';
      } else if (currentAgeMonths >= windowEnd + 1) {
        status = 'missed';
      } else if (currentAgeMonths >= windowStart && currentAgeMonths <= windowEnd + 1) {
        status = 'due';
      } else {
        status = 'upcoming';
      }

      var targetDate = addMonthsToDate(dob, ageMonth);

      return {
        label: label,
        ageMonths: ageMonth,
        targetDate: targetDate,
        targetDateISO: dateToISO(targetDate),
        status: status,
        logged: logged,
        windowStart: windowStart,
        windowEnd: windowEnd
      };
    });

    // Find next upcoming / due visit for the hero box
    var nextVisit = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].status === 'due' || rows[i].status === 'upcoming') {
        nextVisit = rows[i];
        break;
      }
    }

    // Render next-checkup box
    if (container) {
      if (nextVisit) {
        var statusLabel = nextVisit.status === 'due' ? 'Due Now' : 'Coming Up';
        var statusClass = nextVisit.status === 'due' ? 'checkup-due' : 'checkup-upcoming';
        var pillClass = nextVisit.status;
        if (nextVisit.status === 'completed') pillClass = 'good';
        container.innerHTML =
          '<div class="next-checkup-box ' + statusClass + '">' +
            '<div class="next-checkup-label">Next Well-Child Visit</div>' +
            '<div class="next-checkup-visit">' + nextVisit.label + '</div>' +
            '<div class="next-checkup-date">' +
              'Around ' + formatDate(nextVisit.targetDateISO) +
            '</div>' +
            '<span class="status-pill ' + pillClass + '">' + statusLabel + '</span>' +
          '</div>';
      } else {
        container.innerHTML =
          '<div class="next-checkup-box">' +
            '<div class="next-checkup-label">Well-Child Visits</div>' +
            '<p>All scheduled visits are complete! 🎉</p>' +
          '</div>';
      }
    }

    // Render checkup table
    if (checkupTbody) {
      if (rows.length === 0) {
        checkupTbody.innerHTML =
          '<tr><td colspan="4" class="empty-state">No well-child visits found.</td></tr>';
        return;
      }

      var html = rows.map(function (r) {
        var pillClass = r.status;
        var pillLabel = r.status;
        switch (r.status) {
          case 'completed':
            pillClass = 'good';
            pillLabel = 'Completed';
            break;
          case 'missed':
            pillClass = 'overdue';
            pillLabel = 'Missed';
            break;
          case 'due':
            pillClass = 'due';
            pillLabel = 'Due now';
            break;
          default:
            pillClass = 'upcoming';
            pillLabel = 'Upcoming';
        }
        var statusPill = '<span class="status-pill ' + pillClass + '">' + pillLabel + '</span>';

        var dateCol = r.logged
          ? formatDate(r.logged.date)
          : 'Around ' + formatDate(r.targetDateISO);

        var notesCol = r.logged && r.logged.notes ? r.logged.notes : '—';

        return (
          '<tr class="checkup-row checkup-row--' + r.status + '">' +
            '<td>' + r.label + '</td>' +
            '<td>' + statusPill + '</td>' +
            '<td>' + dateCol + '</td>' +
            '<td>' + notesCol + '</td>' +
          '</tr>'
        );
      }).join('');

      checkupTbody.innerHTML = html;
    }
  }

  function populateCheckupSelect(selectEl, childDob, loggedCheckups) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">Select visit…</option>';

    if (!childDob || typeof window.WELL_CHILD_VISITS === 'undefined' || !window.WELL_CHILD_VISITS) return;

    var logged = loggedCheckups || [];
    var loggedLabels = logged.map(function (c) { return c.visitLabel; });

    window.WELL_CHILD_VISITS.forEach(function (visit) {
      var label = visit.label || visit.visitLabel || formatAge(visit.ageMonths || visit.age);
      // Skip already logged
      if (loggedLabels.indexOf(label) !== -1) return;

      var opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      selectEl.appendChild(opt);
    });
  }

  return {
    render: render,
    populateCheckupSelect: populateCheckupSelect
  };
})();
