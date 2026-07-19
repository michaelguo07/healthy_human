/**
 * app.js — Main application controller for Healthy Human.
 *
 * Wires together all components: ChildManager, GrowthChart, MetricCards,
 * MeasurementForm, VaccineTable, CheckupTracker, Summary, ExportManager.
 *
 * Default: imperial units (lb/in). All storage is metric (kg/cm).
 */
(function () {
  'use strict';

  // ─────────────────── State ───────────────────
  var currentTab = 'growth';
  var currentMetric = 'weight_for_age';
  var units = 'imperial';
  var chartInitialized = false;

  var KG_TO_LB = 2.20462;
  var CM_TO_IN = 1 / 2.54;

  // ─────────────────── Boot ───────────────────

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    loadSettings();

    var children = ChildManager.getChildren();
    if (children.length === 0) {
      showOnboarding();
    } else {
      hideOnboarding();
      renderApp();
    }

    bindTabEvents();
    bindFormEvents();
    bindModalEvents();
    bindUnitToggle();
    bindExportEvents();
    bindImportEvents();
    bindChildSelector();
    bindChartControls();
  }

  // ─────────────────── Settings ───────────────────

  function loadSettings() {
    var settings = ChildManager.getSettings();
    units = settings.units || 'imperial';
    applyUnitToggleUI();
  }

  function applyUnitToggleUI() {
    var toggle = document.getElementById('unit-toggle');
    if (toggle) {
      var btns = toggle.querySelectorAll('.unit-btn');
      btns.forEach(function (btn) {
        var isCurrent = btn.getAttribute('data-unit') === units;
        btn.classList.toggle('active', isCurrent);
      });
    }
  }

  // ─────────────────── Onboarding ───────────────────

  function showOnboarding() {
    var overlay = document.getElementById('onboarding-overlay');
    var appContent = document.getElementById('app-content');
    if (overlay) overlay.hidden = false;
    if (appContent) appContent.classList.add('blurred');
  }

  function hideOnboarding() {
    var overlay = document.getElementById('onboarding-overlay');
    var appContent = document.getElementById('app-content');
    if (overlay) overlay.hidden = true;
    if (appContent) appContent.classList.remove('blurred');
  }

  // ─────────────────── Full Render ───────────────────

  function renderApp() {
    var child = ChildManager.getActiveChild();
    if (!child) return;

    renderChildSelector();
    renderCurrentTab(child);
  }

  function renderCurrentTab(child) {
    if (!child) child = ChildManager.getActiveChild();
    if (!child) return;

    switch (currentTab) {
      case 'growth':
        renderGrowthTab(child);
        break;
      case 'vaccines':
        renderVaccineTab(child);
        renderCheckupTab(child);
        break;
      case 'checkups':
        renderCheckupTab(child);
        break;
    }
  }

  // ─────────────────── Child Selector ───────────────────

  function renderChildSelector() {
    var select = document.getElementById('child-selector');
    if (!select) return;

    var children = ChildManager.getChildren();
    var active = ChildManager.getActiveChild();

    select.innerHTML = '';
    children.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      if (active && c.id === active.id) opt.selected = true;
      select.appendChild(opt);
    });

    // Update child name display
    var nameEl = document.getElementById('active-child-name');
    if (nameEl && active) {
      nameEl.textContent = active.name;
    }
  }

  function bindChildSelector() {
    var select = document.getElementById('child-selector');
    if (select) {
      select.addEventListener('change', function () {
        ChildManager.setActiveChild(this.value);
        renderApp();
      });
    }
  }

  // ─────────────────── Tab Switching ───────────────────

  function bindTabEvents() {
    var tabs = document.querySelectorAll('[data-tab]');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function (e) {
        e.preventDefault();
        var target = this.getAttribute('data-tab');
        switchTab(target);
      });
    });
  }

  function switchTab(tabName) {
    currentTab = tabName;

    // Update tab button states
    var tabs = document.querySelectorAll('[data-tab]');
    tabs.forEach(function (tab) {
      var isActive = tab.getAttribute('data-tab') === tabName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Show/hide panels
    var panels = document.querySelectorAll('[data-panel]');
    panels.forEach(function (panel) {
      var isActive = panel.getAttribute('data-panel') === tabName;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });

    renderCurrentTab();
  }

  // ─────────────────── Growth Tab ───────────────────

  function renderGrowthTab(child) {
    var data = ChildManager.getChildData(child.id);
    var measurements = data.measurements || [];

    // Chart
    var chartContainer = document.getElementById('growth-chart-container');
    var emptyMsg = document.getElementById('growth-chart-empty');
    var chartCanvas = document.getElementById('growth-chart');

    if (measurements.length === 0) {
      // Show empty state
      if (chartCanvas) chartCanvas.style.display = 'none';
      if (emptyMsg) {
        emptyMsg.hidden = false;
        emptyMsg.innerHTML =
          '<div class="empty-chart-message">' +
            '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #4E8B7C; opacity: 0.5; margin-bottom: 12px;">' +
              '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>' +
            '</svg>' +
            '<p>No measurements yet — log your first checkup to see ' + child.name + '\'s growth curve.</p>' +
          '</div>';
      }
    } else {
      if (chartCanvas) chartCanvas.style.display = '';
      if (emptyMsg) emptyMsg.hidden = true;

      // Initialize chart if needed
      if (!chartInitialized) {
        GrowthChart.init('growth-chart', {
          onEdit: function (mid) {
            var btn = document.querySelector('.btn-edit-measurement[data-measurement-id="' + mid + '"]');
            if (btn) btn.click();
          },
          onDelete: function (mid) {
            var btn = document.querySelector('.btn-delete-measurement[data-measurement-id="' + mid + '"]');
            if (btn) btn.click();
          }
        });
        chartInitialized = true;
      }
      GrowthChart.update(data, currentMetric, child.sex, child.dob, units);
    }

    // Metric cards
    var cardsEl = document.getElementById('metric-cards');
    if (cardsEl) {
      MetricCards.render(cardsEl, data, units, child);
    }

    // Summary
    renderGrowthSummary(child, data);

    // Measurement history table
    renderMeasurementHistory(measurements, child);

    // Source footer
    renderSourceFooter(child);

    // Update chart metric button states
    updateChartMetricButtons();
  }

  function renderGrowthSummary(child, data) {
    var summaryEl = document.getElementById('growth-summary');
    if (!summaryEl) return;

    var measurements = data.measurements || [];
    if (measurements.length === 0) {
      summaryEl.hidden = true;
      return;
    }

    var latest = measurements[measurements.length - 1];
    var previous = measurements.length > 1 ? measurements[measurements.length - 2] : null;

    var html = Summary.generateGrowthSummary(child.name, latest, child, previous);
    summaryEl.innerHTML = html;
    summaryEl.hidden = false;
  }

  function renderMeasurementHistory(measurements, child) {
    var tbody = document.getElementById('history-tbody');
    if (!tbody) return;

    if (!measurements || measurements.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="empty-state">No measurements recorded yet.</td></tr>';
      return;
    }

    var isImperial = units === 'imperial';
    var dob = child.dob;
    var sex = child.sex || 'female';

    // Reverse to show most recent first
    var sorted = measurements.slice().reverse();

    var html = sorted.map(function (m) {
      var ageM = ageInMonths(dob, m.date);
      var ageStr = formatAge(ageM);
      var dateStr = formatDateShort(m.date);

      var weight = '—';
      if (m.weight_kg != null) {
        weight = isImperial
          ? (m.weight_kg * KG_TO_LB).toFixed(1) + ' lb'
          : m.weight_kg.toFixed(1) + ' kg';
      }

      var height = '—';
      if (m.height_cm != null) {
        height = isImperial
          ? (m.height_cm * CM_TO_IN).toFixed(1) + ' in'
          : m.height_cm.toFixed(1) + ' cm';
      }

      var head = '—';
      if (m.head_cm != null) {
        head = isImperial
          ? (m.head_cm * CM_TO_IN).toFixed(1) + ' in'
          : m.head_cm.toFixed(1) + ' cm';
      }

      return (
        '<tr>' +
          '<td>' + dateStr + '</td>' +
          '<td>' + ageStr + '</td>' +
          '<td>' + weight + '</td>' +
          '<td>' + height + '</td>' +
          '<td>' + head + '</td>' +
          '<td>' +
            '<button class="btn-icon btn-edit-measurement" data-measurement-id="' + m.id + '" title="Edit measurement" aria-label="Edit measurement" style="margin-right: 4px;">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M12 20h9"></path>' +
                '<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>' +
              '</svg>' +
            '</button>' +
            '<button class="btn-icon btn-delete-measurement" data-measurement-id="' + m.id + '" title="Delete measurement" aria-label="Delete measurement">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<polyline points="3 6 5 6 21 6"></polyline>' +
                '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
              '</svg>' +
            '</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    tbody.innerHTML = html;

    // Bind edit buttons
    tbody.querySelectorAll('.btn-edit-measurement').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mid = this.getAttribute('data-measurement-id');
        var match = measurements.find(function (x) { return x.id === mid; });
        if (match) {
          var formEl = document.getElementById('measurement-form');
          if (formEl) {
            formEl.setAttribute('data-edit-id', mid);

            var dateInput = formEl.querySelector('#measure-date, #measurement-date');
            var weightInput = formEl.querySelector('#measure-weight, #measurement-weight');
            var heightInput = formEl.querySelector('#measure-height, #measurement-height');
            var headInput = formEl.querySelector('#measure-head, #measurement-head');

            if (dateInput) dateInput.value = match.date;

            var isImperial = units === 'imperial';

            if (weightInput) {
              weightInput.value = match.weight_kg != null
                ? (isImperial ? (match.weight_kg * KG_TO_LB).toFixed(2) : match.weight_kg.toFixed(2))
                : '';
            }
            if (heightInput) {
              heightInput.value = match.height_cm != null
                ? (isImperial ? (match.height_cm * CM_TO_IN).toFixed(2) : match.height_cm.toFixed(2))
                : '';
            }
            if (headInput) {
              headInput.value = match.head_cm != null
                ? (isImperial ? (match.head_cm * CM_TO_IN).toFixed(2) : match.head_cm.toFixed(2))
                : '';
            }

            var submitBtn = formEl.querySelector('button[type="submit"]');
            if (submitBtn) {
              submitBtn.textContent = 'Update Log';
            }

            var cancelBtn = formEl.querySelector('.btn-cancel-edit');
            if (!cancelBtn && submitBtn) {
              cancelBtn = document.createElement('button');
              cancelBtn.type = 'button';
              cancelBtn.className = 'btn-secondary btn-cancel-edit';
              cancelBtn.style.marginLeft = '8px';
              cancelBtn.textContent = 'Cancel';
              cancelBtn.addEventListener('click', function () {
                exitEditMode(formEl);
              });
              submitBtn.parentNode.appendChild(cancelBtn);
            }

            formEl.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });

    // Bind delete buttons
    tbody.querySelectorAll('.btn-delete-measurement').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mid = this.getAttribute('data-measurement-id');
        if (confirm('Delete this measurement?')) {
          ChildManager.deleteMeasurement(child.id, mid);
          var formEl = document.getElementById('measurement-form');
          if (formEl && formEl.getAttribute('data-edit-id') === mid) {
            exitEditMode(formEl);
          }
          renderApp();
        }
      });
    });
  }

  function exitEditMode(formEl) {
    if (!formEl) return;
    formEl.removeAttribute('data-edit-id');
    var submitBtn = formEl.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = 'Log Measurement';
    }
    var cancelBtn = formEl.querySelector('.btn-cancel-edit');
    if (cancelBtn) {
      cancelBtn.parentNode.removeChild(cancelBtn);
    }
    MeasurementForm.reset();
  }

  function renderSourceFooter(child) {
    var footerEl = document.getElementById('growth-source-footer');
    if (!footerEl) return;

    var ageM = ageInMonths(child.dob, new Date().toISOString().split('T')[0]);
    var source = ageM != null && ageM < 24
      ? 'WHO Child Growth Standards, 2006'
      : 'CDC Growth Charts, 2000';
    footerEl.textContent = 'Growth data: ' + source;
  }

  // ─────────────────── Chart Metric Switching ───────────────────

  function bindChartControls() {
    var buttons = document.querySelectorAll('[data-metric]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentMetric = this.getAttribute('data-metric');
        updateChartMetricButtons();
        var child = ChildManager.getActiveChild();
        if (child) {
          var data = ChildManager.getChildData(child.id);
          if (data.measurements && data.measurements.length > 0) {
            GrowthChart.update(data, currentMetric, child.sex, child.dob, units);
          }
        }
      });
    });
  }

  function updateChartMetricButtons() {
    var buttons = document.querySelectorAll('[data-metric]');
    buttons.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-metric') === currentMetric);
    });
  }

  // ─────────────────── Vaccine Tab ───────────────────

  function renderVaccineTab(child) {
    var data = ChildManager.getChildData(child.id);
    var today = new Date().toISOString().split('T')[0];

    // Render vaccine status table
    var tbody = document.getElementById('vaccine-tbody');
    if (tbody) {
      VaccineTable.render(tbody, data, today, child);
    }

    // Populate vaccine form selects
    var vaccineSelect = document.getElementById('vaccine-select');
    if (vaccineSelect) {
      VaccineTable.populateVaccineSelect(vaccineSelect);
    }
  }

  // ─────────────────── Checkup Tab ───────────────────

  function renderCheckupTab(child) {
    var data = ChildManager.getChildData(child.id);
    var today = new Date().toISOString().split('T')[0];

    var nextCheckupBox = document.getElementById('next-checkup');
    var checkupTbody = document.getElementById('checkup-tbody');

    CheckupTracker.render(nextCheckupBox, checkupTbody, data, today, child);

    // Populate checkup form select
    var checkupSelect = document.getElementById('checkup-type');
    if (checkupSelect) {
      CheckupTracker.populateCheckupSelect(checkupSelect, child.dob, data.checkups);
    }
  }

  // ─────────────────── Form Events ───────────────────

  function bindFormEvents() {
    // Onboarding form submit
    var onboardingForm = document.getElementById('onboarding-form');
    if (onboardingForm) {
      onboardingForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var nameInput = document.getElementById('onboard-name');
        var sexInput = document.getElementById('onboard-sex');
        var dobInput = document.getElementById('onboard-dob');

        if (!nameInput || !nameInput.value.trim() || !sexInput || !sexInput.value || !dobInput || !dobInput.value) {
          return;
        }

        var newChild = ChildManager.addChild({
          name: nameInput.value.trim(),
          sex: sexInput.value,
          dob: dobInput.value
        });

        ChildManager.setActiveChild(newChild.id);
        onboardingForm.reset();
        hideOnboarding();
        renderApp();
        showToast(newChild.name + ' added!');
      });
    }

    // Measurement form
    MeasurementForm.init('measurement-form', function (measurement) {
      var child = ChildManager.getActiveChild();
      if (!child) return;

      var formEl = document.getElementById('measurement-form');
      var editId = formEl ? formEl.getAttribute('data-edit-id') : null;

      if (editId) {
        ChildManager.updateMeasurement(child.id, editId, measurement);
        exitEditMode(formEl);
        showToast('Measurement updated!');
      } else {
        ChildManager.saveMeasurement(child.id, measurement);
        showToast('Measurement saved!');
      }

      MeasurementForm.reset();
      hideOnboarding();
      renderApp();
    });
    MeasurementForm.updateUnits(units);

    // Vaccine form
    var vaccineForm = document.getElementById('vaccine-form');
    if (vaccineForm) {
      // Vaccine name change → populate dose select
      var vaccineSelect = document.getElementById('vaccine-select');
      var doseSelect = document.getElementById('vaccine-dose');
      if (vaccineSelect && doseSelect) {
        vaccineSelect.addEventListener('change', function () {
          var child = ChildManager.getActiveChild();
          var vaccines = child ? ChildManager.getChildData(child.id).vaccines : [];
          VaccineTable.populateDoseSelect(doseSelect, this.value, vaccines);
        });
      }

      vaccineForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var child = ChildManager.getActiveChild();
        if (!child) return;

        var name = document.getElementById('vaccine-select');
        var dose = document.getElementById('vaccine-dose');
        var date = document.getElementById('vaccine-date');

        if (!name || !name.value || !dose || !dose.value || !date || !date.value) {
          showFormError(vaccineForm, 'Please fill in all fields.');
          return;
        }

        ChildManager.saveVaccine(child.id, {
          vaccineName: name.value,
          doseNumber: parseInt(dose.value, 10),
          dateGiven: date.value
        });

        vaccineForm.reset();
        // Re-set date to today
        if (date) date.value = todayISO();
        renderApp();
        showToast('Vaccine recorded!');
      });

      // Default vaccine date
      var vDateInput = document.getElementById('vaccine-date');
      if (vDateInput && !vDateInput.value) vDateInput.value = todayISO();
    }

    // Checkup form
    var checkupForm = document.getElementById('checkup-form');
    if (checkupForm) {
      checkupForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var child = ChildManager.getActiveChild();
        if (!child) return;

        var visitSelect = document.getElementById('checkup-type');
        var dateInput = document.getElementById('checkup-date');
        var notesInput = document.getElementById('checkup-notes');

        if (!visitSelect || !visitSelect.value || !dateInput || !dateInput.value) {
          showFormError(checkupForm, 'Please select a visit and date.');
          return;
        }

        ChildManager.saveCheckup(child.id, {
          visitLabel: visitSelect.value,
          date: dateInput.value,
          notes: notesInput ? notesInput.value : ''
        });

        checkupForm.reset();
        if (dateInput) dateInput.value = todayISO();
        renderApp();
        showToast('Checkup recorded!');
      });

      // Default checkup date
      var cDateInput = document.getElementById('checkup-date');
      if (cDateInput && !cDateInput.value) cDateInput.value = todayISO();
    }
  }

  function showFormError(form, message) {
    var errEl = form.querySelector('.form-error');
    if (errEl) {
      errEl.textContent = message;
      errEl.hidden = false;
    }
  }

  // ─────────────────── Modal Events ───────────────────

  window.openVaccineModal = function (details) {
    var modal = document.getElementById('vaccine-modal');
    if (!modal) return;

    var titleEl = document.getElementById('vax-modal-title');
    var infoEl = document.getElementById('vax-modal-info');
    var nameInput = document.getElementById('vax-modal-name');
    var doseInput = document.getElementById('vax-modal-dose');
    var logIdInput = document.getElementById('vax-modal-log-id');
    var dateInput = document.getElementById('vax-modal-date');
    var deleteBtn = document.getElementById('delete-vax-log');
    var saveBtn = document.getElementById('save-vax-log');

    if (!titleEl || !infoEl) return;

    nameInput.value = details.vaccineId || details.vaccineName;
    doseInput.value = details.doseNumber;
    logIdInput.value = details.loggedId || '';

    titleEl.textContent = details.vaccineName + ' — ' + details.doseLabel;

    var statusLabel = details.status === 'up_to_date' ? 'Up to date' : details.status === 'due' ? 'Due now' : details.status === 'overdue' ? 'Overdue' : 'Upcoming';
    var pillClass = details.status === 'up_to_date' ? 'good' : details.status === 'not_yet' ? 'upcoming' : details.status;

    var infoHtml = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
      '<strong>' + details.vaccineName + '</strong>' +
      '<span class="status-pill ' + pillClass + '">' + statusLabel + '</span>' +
      '</div>';

    infoHtml += '<div style="margin-bottom:4px;"><strong>Dose Progress:</strong> ' + details.doseLabel + '</div>';
    infoHtml += '<div style="margin-bottom:4px;"><strong>Schedule Status:</strong> ' + details.dateStr + '</div>';

    if (details.loggedId && details.rawDate) {
      infoHtml += '<div><strong>Recorded Given Date:</strong> ' + formatDateShort(details.rawDate) + '</div>';
      dateInput.value = details.rawDate;
      if (deleteBtn) deleteBtn.style.display = 'inline-block';
      if (saveBtn) saveBtn.textContent = 'Update Log';
    } else {
      dateInput.value = todayISO();
      if (deleteBtn) deleteBtn.style.display = 'none';
      if (saveBtn) saveBtn.textContent = 'Save Log';
    }

    infoEl.innerHTML = infoHtml;
    openModal(modal);
  };

  function bindModalEvents() {
    // Add child modal
    var addChildBtn = document.getElementById('add-child-btn');
    var addChildModal = document.getElementById('add-child-modal');
    var addChildForm = document.getElementById('add-child-form');

    if (addChildBtn && addChildModal) {
      addChildBtn.addEventListener('click', function () {
        openModal(addChildModal);
      });
    }

    if (addChildForm) {
      addChildForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var nameInput = document.getElementById('new-child-name');
        var sexInput = document.getElementById('new-child-sex');
        var dobInput = document.getElementById('new-child-dob');

        if (!nameInput || !nameInput.value.trim()) {
          showFormError(addChildForm, 'Please enter a name.');
          return;
        }
        if (!sexInput || !sexInput.value) {
          showFormError(addChildForm, 'Please select sex.');
          return;
        }
        if (!dobInput || !dobInput.value) {
          showFormError(addChildForm, 'Please enter date of birth.');
          return;
        }

        var newChild = ChildManager.addChild({
          name: nameInput.value.trim(),
          sex: sexInput.value,
          dob: dobInput.value
        });

        ChildManager.setActiveChild(newChild.id);
        addChildForm.reset();
        closeModal(addChildModal);
        hideOnboarding();
        renderApp();
        showToast(newChild.name + ' added!');
      });
    }

    // Export modal
    var exportBtn = document.getElementById('export-btn');
    var exportModal = document.getElementById('export-modal');
    if (exportBtn && exportModal) {
      exportBtn.addEventListener('click', function () {
        openModal(exportModal);
      });
    }

    // Close buttons for all modals
    var cancelAddChild = document.getElementById('cancel-add-child');
    if (cancelAddChild && addChildModal) {
      cancelAddChild.addEventListener('click', function () {
        closeModal(addChildModal);
      });
    }

    var cancelExport = document.getElementById('cancel-export');
    if (cancelExport && exportModal) {
      cancelExport.addEventListener('click', function () {
        closeModal(exportModal);
      });
    }

    // Vaccine modal
    var vaxModal = document.getElementById('vaccine-modal');
    var cancelVax = document.getElementById('cancel-vax-modal');
    var vaxForm = document.getElementById('vax-modal-form');
    var deleteVaxBtn = document.getElementById('delete-vax-log');

    if (cancelVax && vaxModal) {
      cancelVax.addEventListener('click', function () {
        closeModal(vaxModal);
      });
    }

    if (vaxForm) {
      vaxForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var child = ChildManager.getActiveChild();
        if (!child) return;

        var vaxName = document.getElementById('vax-modal-name').value;
        var doseNum = document.getElementById('vax-modal-dose').value;
        var dateGiven = document.getElementById('vax-modal-date').value;
        var loggedId = document.getElementById('vax-modal-log-id').value;

        if (!vaxName || !doseNum || !dateGiven) return;

        if (loggedId) {
          ChildManager.deleteVaccine(child.id, loggedId);
        }

        ChildManager.saveVaccine(child.id, {
          vaccineId: vaxName,
          vaccineName: vaxName,
          doseNumber: Number(doseNum),
          dateGiven: dateGiven
        });

        closeModal(vaxModal);
        showToast('Vaccine log saved!');
        renderApp();
      });
    }

    if (deleteVaxBtn) {
      deleteVaxBtn.addEventListener('click', function () {
        var child = ChildManager.getActiveChild();
        var loggedId = document.getElementById('vax-modal-log-id').value;
        if (!child || !loggedId) return;

        if (confirm('Remove this recorded vaccine log?')) {
          ChildManager.deleteVaccine(child.id, loggedId);
          closeModal(vaxModal);
          showToast('Vaccine log removed!');
          renderApp();
        }
      });
    }

    // Click outside modal backdrop to close
    document.querySelectorAll('.modal-backdrop').forEach(function (backdrop) {
      backdrop.addEventListener('click', function () {
        var modal = this.closest('.modal');
        if (modal) closeModal(modal);
      });
    });

    // Escape key closes modals
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal:not([hidden])').forEach(function (modal) {
          closeModal(modal);
        });
      }
    });

    // Delete child button
    var deleteChildBtn = document.getElementById('delete-child-btn');
    if (deleteChildBtn) {
      deleteChildBtn.addEventListener('click', function () {
        var child = ChildManager.getActiveChild();
        if (!child) return;
        if (confirm('Remove ' + child.name + ' and all their data? This cannot be undone.')) {
          ChildManager.removeChild(child.id);
          var remaining = ChildManager.getChildren();
          if (remaining.length === 0) {
            showOnboarding();
            // Clear display areas
            clearDisplay();
          } else {
            renderApp();
          }
          showToast('Child removed.');
        }
      });
    }
  }

  function openModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    // Focus first input
    var firstInput = modal.querySelector('input, select, textarea');
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 100);
    document.body.classList.add('modal-open');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    // Clear errors
    var err = modal.querySelector('.form-error');
    if (err) err.hidden = true;
  }

  function clearDisplay() {
    var areas = ['metric-cards', 'growth-summary', 'measurement-history-tbody', 'vaccine-tbody', 'checkup-tbody'];
    areas.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    GrowthChart.destroy();
    chartInitialized = false;
  }

  // ─────────────────── Unit Toggle ───────────────────

  function bindUnitToggle() {
    var toggle = document.getElementById('unit-toggle');
    if (toggle) {
      toggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.unit-btn');
        var targetUnit;
        if (btn) {
          targetUnit = btn.getAttribute('data-unit');
        } else {
          targetUnit = units === 'imperial' ? 'metric' : 'imperial';
        }

        if (targetUnit !== units) {
          units = targetUnit;
          ChildManager.saveSettings({ units: units });
          applyUnitToggleUI();
          MeasurementForm.updateUnits(units);
          renderApp();
        }
      });
    }
  }

  // ─────────────────── Export Events ───────────────────

  function bindExportEvents() {
    var btnCSV = document.getElementById('export-csv');
    var btnPNG = document.getElementById('export-chart');
    var btnJSON = document.getElementById('export-json');

    if (btnCSV) {
      btnCSV.addEventListener('click', function () {
        var child = ChildManager.getActiveChild();
        if (!child) return;
        var data = ChildManager.getChildData(child.id);
        ExportManager.exportCSV(data, child, units);
        showToast('CSV downloaded!');
      });
    }

    if (btnPNG) {
      btnPNG.addEventListener('click', function () {
        var child = ChildManager.getActiveChild();
        if (!child) return;
        var data = ChildManager.getChildData(child.id);
        ExportManager.exportPDF(data, child, units);
        showToast('PDF downloaded!');
      });
    }

    if (btnJSON) {
      btnJSON.addEventListener('click', function () {
        var child = ChildManager.getActiveChild();
        if (!child) return;
        var data = ChildManager.getChildData(child.id);
        ExportManager.exportJSON(data, child);
        showToast('JSON backup downloaded!');
      });
    }
  }

  // ─────────────────── Import Events ───────────────────

  function bindImportEvents() {
    var globalInput = document.getElementById('global-import-input');
    var onboardBtn = document.getElementById('onboard-import-btn');
    var headerBtn = document.getElementById('import-profile-btn');

    if (onboardBtn && globalInput) {
      onboardBtn.addEventListener('click', function () {
        globalInput.click();
      });
    }

    if (headerBtn && globalInput) {
      headerBtn.addEventListener('click', function () {
        globalInput.click();
      });
    }

    if (globalInput) {
      globalInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function (evt) {
          try {
            var payload = JSON.parse(evt.target.result);
            var child = ChildManager.importChildData(payload);
            
            globalInput.value = '';
            showToast('Imported ' + child.name + '\'s profile successfully!');
            hideOnboarding();
            
            // Re-render
            renderApp();
          } catch (err) {
            console.error('Import error:', err);
            alert('Error importing profile: ' + err.message);
            globalInput.value = '';
          }
        };
        reader.readAsText(file);
      });
    }
  }

  // ─────────────────── Utilities ───────────────────

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function ageInMonths(dob, date) {
    if (!dob || !date) return null;
    var d1 = new Date(dob + 'T00:00:00');
    var d2 = new Date(date + 'T00:00:00');
    return (d2.getFullYear() - d1.getFullYear()) * 12 +
           (d2.getMonth() - d1.getMonth()) +
           (d2.getDate() - d1.getDate()) / 30.44;
  }

  function formatAge(months) {
    if (months == null) return '—';
    if (months < 0) months = 0;
    if (months < 1) {
      var days = Math.round(months * 30.44);
      return days + ' day' + (days !== 1 ? 's' : '');
    }
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

  function formatDateShort(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ─────────────────── Toast Notifications ───────────────────

  function showToast(message) {
    // Create or reuse toast container
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(function () {
      toast.classList.add('toast--visible');
    });

    // Auto-dismiss
    setTimeout(function () {
      toast.classList.remove('toast--visible');
      toast.classList.add('toast--hiding');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2500);
  }

})();
