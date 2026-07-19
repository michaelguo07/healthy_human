/**
 * VaccineTable — renders vaccine schedule status and logging UI.
 *
 * Uses VaccineCalc.calculateVaccineStatus() to determine status for each dose.
 */
window.VaccineTable = (function () {
  'use strict';

  var STATUS_ORDER = { overdue: 0, due: 1, upcoming: 2, 'up_to_date': 3, 'not_yet': 4 };

  var STATUS_LABELS = {
    'good':       'Up to date',
    'up_to_date': 'Up to date',
    'due':        'Due now',
    'overdue':    'Overdue',
    'upcoming':   'Upcoming',
    'not_yet':    'Not yet'
  };

  var currentSort = 'status';
  var sortDesc = false;
  var headersBound = false;

  function formatDate(d) {
    if (!d) return '';
    var date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function addMonthsToDate(dob, months) {
    var d = new Date(dob + 'T00:00:00');
    // Approximate fractional months
    var totalDays = Math.round(months * 30.4375);
    d.setDate(d.getDate() + totalDays);
    return d;
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

  function statusPill(status) {
    var label = STATUS_LABELS[status] || status;
    return '<span class="status-pill ' + status + '">' + label + '</span>';
  }

  function updateHeaderIcons(table) {
    var headers = table.querySelectorAll('th.sortable');
    headers.forEach(function (th) {
      var col = th.getAttribute('data-sort');
      var icon = th.querySelector('.sort-icon');
      if (icon) {
        if (col === currentSort) {
          icon.textContent = sortDesc ? ' ↓' : ' ↑';
          th.classList.add('sorted');
        } else {
          icon.textContent = ' ↕';
          th.classList.remove('sorted');
        }
      }
    });
  }

  // ─────────────────── public ───────────────────

  function render(tbody, childData, currentDate, child) {
    if (!tbody) return;

    var vaccines = childData.vaccines || [];
    var dob = child ? child.dob : null;

    // If no vaccine schedule data available, show empty state
    if (typeof window.VACCINE_SCHEDULE === 'undefined' || !window.VACCINE_SCHEDULE || !dob) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="empty-state">Add a child with a date of birth to see vaccine schedules.</td></tr>';
      return;
    }

    var table = tbody.closest('table');
    if (table) {
      updateHeaderIcons(table);
      if (!headersBound) {
        var headers = table.querySelectorAll('th.sortable');
        headers.forEach(function (th) {
          th.addEventListener('click', function () {
            var sortCol = this.getAttribute('data-sort');
            if (currentSort === sortCol) {
              sortDesc = !sortDesc;
            } else {
              currentSort = sortCol;
              sortDesc = false;
            }
            updateHeaderIcons(table);
            
            var activeChild = ChildManager.getActiveChild();
            if (activeChild) {
              var latestData = ChildManager.getChildData(activeChild.id);
              render(tbody, latestData, currentDate, activeChild);
            }
          });
        });
        headersBound = true;
      }
    }

    var statuses = [];
    try {
      statuses = VaccineCalc.calculateVaccineStatus(dob, vaccines, currentDate);
    } catch (e) {
      console.error('VaccineCalc.calculateVaccineStatus error:', e);
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Error calculating vaccine statuses.</td></tr>';
      return;
    }

    var rows = statuses.map(function (s) {
      var vax = window.VACCINE_SCHEDULE.find(function (v) { return v.id === s.vaccineId; });
      var dose = vax ? vax.doses.find(function (d) { return d.doseNumber === s.doseNumber; }) : null;

      var vaxLog = vaccines.find(function (v) {
        return (v.vaccineId === s.vaccineId || v.vaccineName === s.vaccineName) && Number(v.doseNumber) === Number(s.doseNumber);
      });
      var loggedId = vaxLog ? vaxLog.id : '';
      var rawDateGiven = s.dateGiven || (vaxLog ? vaxLog.dateGiven : '');

      var dateStr = '';
      var dateObj = null;
      if (s.status === 'up_to_date' && rawDateGiven) {
        dateStr = formatDate(rawDateGiven);
        dateObj = new Date(rawDateGiven + 'T00:00:00');
      } else if (s.status === 'overdue' && s.ageMaxMonths != null) {
        var dueBy = addMonthsToDate(dob, s.ageMaxMonths);
        dateStr = 'Was due ' + formatDate(dueBy);
        dateObj = dueBy;
      } else if (s.status === 'due' && s.ageIdealMonths != null) {
        var dueBy2 = addMonthsToDate(dob, s.ageIdealMonths);
        dateStr = 'Due by ' + formatDate(dueBy2);
        dateObj = dueBy2;
      } else if (dose && (dose.ageRange || dose.recommendedAge)) {
        dateStr = 'Recommended at ' + (dose.recommendedAge || dose.ageRange);
        if (s.ageIdealMonths != null) dateObj = addMonthsToDate(dob, s.ageIdealMonths);
      } else if (s.ageIdealMonths != null) {
        dateStr = 'Recommended at ' + formatAge(s.ageIdealMonths);
        dateObj = addMonthsToDate(dob, s.ageIdealMonths);
      }

      var doseLabel = (dose && dose.label) || ('Dose ' + s.doseNumber);
      if (s.vaccineId === 'Influenza') doseLabel = 'Annual';

      var shortName = s.shortName || (vax ? vax.shortName : '');

      return {
        vaccineId: s.vaccineId,
        doseNumber: s.doseNumber,
        name: s.vaccineName,
        shortName: shortName,
        doseLabel: doseLabel,
        status: s.status,
        dateStr: dateStr,
        dateObj: dateObj,
        rawDateGiven: rawDateGiven,
        loggedId: loggedId,
        sortKey: (STATUS_ORDER[s.status] != null ? STATUS_ORDER[s.status] : 9)
      };
    });

    // Sort according to selection
    rows.sort(function (a, b) {
      var comparison = 0;
      if (currentSort === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (currentSort === 'status') {
        comparison = a.sortKey - b.sortKey;
      } else if (currentSort === 'date') {
        var timeA = a.dateObj ? a.dateObj.getTime() : 0;
        var timeB = b.dateObj ? b.dateObj.getTime() : 0;
        comparison = timeA - timeB;
      }

      // Secondary sort alphabetically
      if (comparison === 0 && currentSort !== 'name') {
        comparison = a.name.localeCompare(b.name);
      }

      return sortDesc ? -comparison : comparison;
    });

    if (rows.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="empty-state">No vaccine schedule entries found.</td></tr>';
      return;
    }

    var html = rows.map(function (r) {
      var statusClass = r.status;
      if (r.status === 'up_to_date') statusClass = 'good'; // matches styles.css classes
      if (r.status === 'not_yet') statusClass = 'upcoming';

      var nameHtml = '<strong>' + r.name + '</strong>';
      if (r.shortName) {
        nameHtml += ' <span class="vax-abbrev">' + r.shortName + '</span>';
      }

      return (
        '<tr class="vaccine-row vaccine-row--' + r.status + ' clickable-vax-row" ' +
          'data-vaccine-id="' + r.vaccineId + '" ' +
          'data-dose-number="' + r.doseNumber + '" ' +
          'data-vaccine-name="' + r.name + '" ' +
          'data-short-name="' + r.shortName + '" ' +
          'data-dose-label="' + r.doseLabel + '" ' +
          'data-status="' + r.status + '" ' +
          'data-date-str="' + r.dateStr + '" ' +
          'data-raw-date="' + r.rawDateGiven + '" ' +
          'data-logged-id="' + r.loggedId + '" ' +
          'style="cursor: pointer;" title="Click to view details or log vaccine">' +
          '<td>' + nameHtml + '</td>' +
          '<td>' + r.doseLabel + '</td>' +
          '<td>' + statusPill(statusClass) + '</td>' +
          '<td>' + r.dateStr + '</td>' +
        '</tr>'
      );
    }).join('');

    tbody.innerHTML = html;

    // Bind row clicks
    tbody.querySelectorAll('.clickable-vax-row').forEach(function (tr) {
      tr.addEventListener('click', function () {
        if (typeof window.openVaccineModal === 'function') {
          window.openVaccineModal({
            vaccineId: this.getAttribute('data-vaccine-id'),
            doseNumber: this.getAttribute('data-dose-number'),
            vaccineName: this.getAttribute('data-vaccine-name'),
            shortName: this.getAttribute('data-short-name'),
            doseLabel: this.getAttribute('data-dose-label'),
            status: this.getAttribute('data-status'),
            dateStr: this.getAttribute('data-date-str'),
            rawDate: this.getAttribute('data-raw-date'),
            loggedId: this.getAttribute('data-logged-id')
          });
        }
      });
    });
  }

  function populateVaccineSelect(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">Select vaccine…</option>';

    if (typeof window.VACCINE_SCHEDULE === 'undefined' || !window.VACCINE_SCHEDULE) return;

    window.VACCINE_SCHEDULE.forEach(function (vax) {
      var name = vax.name || vax.vaccine;
      var shortName = vax.shortName;
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = shortName && shortName !== name ? name + ' (' + shortName + ')' : name;
      selectEl.appendChild(opt);
    });
  }

  function populateDoseSelect(selectEl, vaccineName, loggedVaccines) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">Select dose…</option>';

    if (!vaccineName || typeof window.VACCINE_SCHEDULE === 'undefined') return;

    var vax = window.VACCINE_SCHEDULE.find(function (v) {
      return (v.name || v.vaccine) === vaccineName;
    });
    if (!vax || !vax.doses) return;

    var logged = (loggedVaccines || []).filter(function (v) {
      return v.vaccineName === vaccineName;
    });

    vax.doses.forEach(function (dose, idx) {
      var doseNum = idx + 1;
      var alreadyLogged = logged.some(function (v) { return v.doseNumber === doseNum; });
      if (alreadyLogged) return; // skip doses already administered

      var opt = document.createElement('option');
      opt.value = doseNum;
      opt.textContent = dose.label || ('Dose ' + doseNum);
      selectEl.appendChild(opt);
    });
  }

  return {
    render: render,
    populateVaccineSelect: populateVaccineSelect,
    populateDoseSelect: populateDoseSelect
  };
})();
