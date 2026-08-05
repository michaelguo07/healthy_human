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

    checkIncomingSharePayload();
  }

  // ─────────────────── Settings ───────────────────

  function loadSettings() {
    var settings = ChildManager.getSettings();
    units = settings.units || 'imperial';
    applyUnitToggleUI();
  }

  var pendingOnboardingChild = null;

  function resetOnboardingSteps() {
    pendingOnboardingChild = null;
    var step1 = document.getElementById('onboard-step-1');
    var step2 = document.getElementById('onboard-step-2');
    if (step1) { step1.hidden = false; step1.classList.add('active'); }
    if (step2) { step2.hidden = true; step2.classList.remove('active'); }

    var form1 = document.getElementById('onboarding-form');
    var form2 = document.getElementById('onboard-measurements-form');
    if (form1) form1.reset();
    if (form2) form2.reset();
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

    document.querySelectorAll('.unit-label').forEach(function (label) {
      var imp = label.getAttribute('data-imperial');
      var met = label.getAttribute('data-metric');
      if (imp && met) {
        label.textContent = units === 'imperial' ? imp : met;
      }
    });
  }

  // ─────────────────── Onboarding ───────────────────

  function showOnboarding() {
    resetOnboardingSteps();
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
    resetOnboardingSteps();
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
      case 'summary':
        renderSummaryTab(child);
        break;
      case 'reviews':
        renderReviewsTab();
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

    if (tabName === 'reviews') {
      renderReviewsTab();
    }
    renderCurrentTab();
  }

  function renderReviewsTab() {
    var container = document.getElementById('reviews-container');
    if (container && window.ReviewManager) {
      ReviewManager.renderReviewsContainer(container);
    }
  }

  function renderSummaryTab(child) {
    var container = document.getElementById('summary-content');
    if (!container || !child) return;
    var data = ChildManager.getChildData(child.id);
    var measurements = data.measurements || [];
    var latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
    var previous = measurements.length > 1 ? measurements[measurements.length - 2] : null;

    if (window.Summary) {
      container.innerHTML = Summary.generateGrowthSummary(child.name, latest, child, previous);
    }
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
    var badgeEl = document.getElementById('active-source-badge');
    if (!badgeEl) return;
    if (!child) {
      badgeEl.textContent = '';
      return;
    }

    var ageM = ageInMonths(child.dob, new Date().toISOString().split('T')[0]);
    var source = ageM != null && ageM < 24
      ? 'Active reference for ' + (child.name || 'child') + ': WHO Child Growth Standards (0–24 months)'
      : 'Active reference for ' + (child.name || 'child') + ': CDC Growth Charts (ages 2–20 years)';
    badgeEl.textContent = source;
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
    // Step 1: Onboarding form submit -> Go to Step 2
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

        pendingOnboardingChild = {
          name: nameInput.value.trim(),
          sex: sexInput.value,
          dob: dobInput.value
        };

        var nameDisplay = document.getElementById('onboard-child-name-display');
        if (nameDisplay) nameDisplay.textContent = pendingOnboardingChild.name;

        var mDateInput = document.getElementById('onboard-measure-date');
        if (mDateInput) mDateInput.value = pendingOnboardingChild.dob || todayISO();

        var step1 = document.getElementById('onboard-step-1');
        var step2 = document.getElementById('onboard-step-2');
        if (step1) { step1.hidden = true; step1.classList.remove('active'); }
        if (step2) { step2.hidden = false; step2.classList.add('active'); }
      });
    }

    // Step 2: Back button
    var onboardBackBtn = document.getElementById('onboard-back-btn');
    if (onboardBackBtn) {
      onboardBackBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var step1 = document.getElementById('onboard-step-1');
        var step2 = document.getElementById('onboard-step-2');
        if (step1) { step1.hidden = false; step1.classList.add('active'); }
        if (step2) { step2.hidden = true; step2.classList.remove('active'); }
      });
    }

    // Step 2: Measurements form submit
    var onboardMeasurementsForm = document.getElementById('onboard-measurements-form');
    if (onboardMeasurementsForm) {
      onboardMeasurementsForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!pendingOnboardingChild) return;

        var newChild = ChildManager.addChild(pendingOnboardingChild);
        ChildManager.setActiveChild(newChild.id);

        var dateInput = document.getElementById('onboard-measure-date');
        var weightInput = document.getElementById('onboard-weight');
        var heightInput = document.getElementById('onboard-height');
        var headInput = document.getElementById('onboard-head');

        var weightRaw = weightInput ? parseFloat(weightInput.value) : NaN;
        var heightRaw = heightInput ? parseFloat(heightInput.value) : NaN;
        var headRaw = headInput ? parseFloat(headInput.value) : NaN;

        var LB_TO_KG = 1 / 2.20462;
        var IN_TO_CM = 2.54;

        if (!isNaN(weightRaw) || !isNaN(heightRaw) || !isNaN(headRaw)) {
          var weight_kg = !isNaN(weightRaw) ? (units === 'imperial' ? weightRaw * LB_TO_KG : weightRaw) : null;
          var height_cm = !isNaN(heightRaw) ? (units === 'imperial' ? heightRaw * IN_TO_CM : heightRaw) : null;
          var head_cm = !isNaN(headRaw) ? (units === 'imperial' ? headRaw * IN_TO_CM : headRaw) : null;

          ChildManager.saveMeasurement(newChild.id, {
            date: dateInput && dateInput.value ? dateInput.value : (newChild.dob || todayISO()),
            weight_kg: weight_kg,
            height_cm: height_cm,
            head_cm: head_cm
          });
        }

        hideOnboarding();
        renderApp();
        showToast(newChild.name + ' added!');
      });
    }

    // Step 2: "i dont have measurements yet" button
    var onboardSkipBtn = document.getElementById('onboard-skip-measurements');
    if (onboardSkipBtn) {
      onboardSkipBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (!pendingOnboardingChild) return;

        var newChild = ChildManager.addChild(pendingOnboardingChild);
        ChildManager.setActiveChild(newChild.id);

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

    var shortName = details.shortName || '';
    var displayTitle = details.vaccineName + (shortName ? ' (' + shortName + ')' : '');
    titleEl.textContent = displayTitle + ' — ' + details.doseLabel;

    var statusLabel = details.status === 'up_to_date' ? 'Up to date' : details.status === 'due' ? 'Due now' : details.status === 'overdue' ? 'Overdue' : 'Upcoming';
    var pillClass = details.status === 'up_to_date' ? 'good' : details.status === 'not_yet' ? 'upcoming' : details.status;

    var infoHtml = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
      '<div><strong>' + details.vaccineName + '</strong>' + (shortName ? ' <span class="vax-abbrev">' + shortName + '</span>' : '') + '</div>' +
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

    // Share Profile Modal
    var shareBtn = document.getElementById('share-profile-btn');
    var shareModal = document.getElementById('share-modal');
    var closeShare = document.getElementById('close-share-modal');
    var cancelShare = document.getElementById('cancel-share-modal');
    var copyBtn = document.getElementById('copy-share-url-btn');

    if (shareBtn && shareModal) {
      shareBtn.addEventListener('click', function () {
        var activeChild = ChildManager.getActiveChild();
        if (!activeChild) {
          showToast('Please add a child profile first.');
          return;
        }
        var shareUrl = ShareManager.generateShareUrl(activeChild.id);
        if (shareUrl) {
          var urlInput = document.getElementById('share-url-input');
          var childNameEl = document.getElementById('share-child-name');
          if (urlInput) urlInput.value = shareUrl;
          if (childNameEl) childNameEl.textContent = activeChild.name;
          var feedbackMsg = document.getElementById('copy-feedback-msg');
          if (feedbackMsg) feedbackMsg.style.display = 'none';
          openModal(shareModal);
        }
      });
    }

    if (closeShare && shareModal) closeShare.addEventListener('click', function () { closeModal(shareModal); });
    if (cancelShare && shareModal) cancelShare.addEventListener('click', function () { closeModal(shareModal); });

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var urlInput = document.getElementById('share-url-input');
        if (urlInput && urlInput.value) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(urlInput.value).then(function () {
              var feedbackMsg = document.getElementById('copy-feedback-msg');
              if (feedbackMsg) feedbackMsg.style.display = 'block';
              showToast('Link copied to clipboard!');
            }).catch(function () {
              fallbackCopy(urlInput);
            });
          } else {
            fallbackCopy(urlInput);
          }
        }
      });
    }

    function fallbackCopy(inputEl) {
      inputEl.select();
      document.execCommand('copy');
      var feedbackMsg = document.getElementById('copy-feedback-msg');
      if (feedbackMsg) feedbackMsg.style.display = 'block';
      showToast('Link copied!');
    }

    // Leave a Review Modal
    var reviewModal = document.getElementById('review-modal');
    var reviewForm = document.getElementById('review-form');
    var closeReview = document.getElementById('close-review-modal');
    var cancelReview = document.getElementById('cancel-review-modal');

    if (closeReview && reviewModal) closeReview.addEventListener('click', function () { closeModal(reviewModal); });
    if (cancelReview && reviewModal) cancelReview.addEventListener('click', function () { closeModal(reviewModal); });

    var starContainer = document.getElementById('star-rating-select');
    if (starContainer) {
      starContainer.addEventListener('click', function (e) {
        var star = e.target.closest('span[data-star]');
        if (!star) return;
        var val = parseInt(star.getAttribute('data-star'), 10);
        var inputVal = document.getElementById('review-rating-val');
        if (inputVal) inputVal.value = val;
        var stars = starContainer.querySelectorAll('span');
        stars.forEach(function (s, idx) {
          if (idx < val) s.classList.add('active');
          else s.classList.remove('active');
        });
      });
    }

    var anonCheckbox = document.getElementById('review-anonymous-checkbox');
    var nameInput = document.getElementById('review-name');

    if (anonCheckbox && nameInput) {
      anonCheckbox.addEventListener('change', function () {
        if (this.checked) {
          nameInput.setAttribute('data-saved-name', nameInput.value);
          nameInput.value = 'Anonymous Parent';
          nameInput.readOnly = true;
        } else {
          var saved = nameInput.getAttribute('data-saved-name') || '';
          nameInput.value = saved === 'Anonymous Parent' ? '' : saved;
          nameInput.readOnly = false;
          nameInput.focus();
        }
      });
    }

    if (reviewForm) {
      reviewForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var nameVal = document.getElementById('review-name').value;
        var roleVal = document.getElementById('review-role').value;
        var ratingVal = document.getElementById('review-rating-val').value;
        var commentVal = document.getElementById('review-comment').value;
        var isAnon = anonCheckbox && anonCheckbox.checked;

        var finalName = (isAnon || !nameVal.trim()) ? 'Anonymous Parent' : nameVal.trim();

        if (!commentVal.trim()) {
          showFormError(reviewForm, 'Please fill in your review comment.');
          return;
        }

        ReviewManager.addReview({
          name: finalName,
          role: roleVal,
          rating: ratingVal,
          comment: commentVal
        });

        reviewForm.reset();
        if (nameInput) nameInput.readOnly = false;
        closeModal(reviewModal);
        renderReviewsTab();
        showToast('Thank you for leaving a review!');
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

    // Backup & Data Protection Guide Modal
    var backupGuideModal = document.getElementById('backup-guide-modal');
    var backupGuideBtn = document.getElementById('backup-guide-btn');
    var footerGuideLink = document.getElementById('footer-guide-link');
    var cancelBackupGuide = document.getElementById('cancel-backup-guide');

    function openBackupGuide() {
      if (backupGuideModal) openModal(backupGuideModal);
    }

    if (backupGuideBtn) backupGuideBtn.addEventListener('click', openBackupGuide);
    if (footerGuideLink) footerGuideLink.addEventListener('click', openBackupGuide);
    if (cancelBackupGuide && backupGuideModal) {
      cancelBackupGuide.addEventListener('click', function () {
        closeModal(backupGuideModal);
      });
    }

    // About Creator Modal
    var aboutCreatorBtn = document.getElementById('about-creator-btn');
    var aboutCreatorModal = document.getElementById('about-creator-modal');
    var closeAboutCreator = document.getElementById('close-about-creator-modal');

    if (aboutCreatorBtn && aboutCreatorModal) {
      aboutCreatorBtn.addEventListener('click', function () {
        openModal(aboutCreatorModal);
      });
    }

    if (closeAboutCreator && aboutCreatorModal) {
      closeAboutCreator.addEventListener('click', function () {
        closeModal(aboutCreatorModal);
      });
    }

    // Private Feedback Modal
    var openFeedbackBtn = document.getElementById('open-feedback-btn');
    var feedbackModal = document.getElementById('feedback-modal');
    var closeFeedbackModal = document.getElementById('close-feedback-modal');
    var cancelFeedbackModal = document.getElementById('cancel-feedback-modal');
    var feedbackForm = document.getElementById('feedback-form');
    var feedbackStatusMsg = document.getElementById('feedback-status-msg');

    if (openFeedbackBtn && feedbackModal) {
      openFeedbackBtn.addEventListener('click', function () {
        if (feedbackStatusMsg) feedbackStatusMsg.style.display = 'none';
        openModal(feedbackModal);
      });
    }

    if (closeFeedbackModal && feedbackModal) {
      closeFeedbackModal.addEventListener('click', function () {
        closeModal(feedbackModal);
      });
    }

    if (cancelFeedbackModal && feedbackModal) {
      cancelFeedbackModal.addEventListener('click', function () {
        closeModal(feedbackModal);
      });
    }

    if (feedbackForm) {
      feedbackForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var category = document.getElementById('feedback-category').value;
        var name = document.getElementById('feedback-name').value;
        var contact = document.getElementById('feedback-contact').value;
        var message = document.getElementById('feedback-message').value;

        if (!message || !message.trim()) return;

        var submitBtn = document.getElementById('submit-feedback-btn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Sending...';
        }

        FeedbackManager.sendFeedback({
          category: category,
          name: name,
          contact: contact,
          message: message
        }).then(function () {
          if (feedbackStatusMsg) {
            feedbackStatusMsg.style.display = 'block';
            feedbackStatusMsg.style.background = '#e6f4ea';
            feedbackStatusMsg.style.color = '#137333';
            feedbackStatusMsg.style.border = '1px solid #ceead6';
            feedbackStatusMsg.textContent = 'Thank you! Your feedback has been sent directly to Michael Guo.';
          }
          showToast('Feedback sent directly to creator!');
          feedbackForm.reset();
          setTimeout(function () {
            closeModal(feedbackModal);
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Send Private Feedback';
            }
          }, 1500);
        }).catch(function (err) {
          console.error('Feedback submission error:', err);
          if (feedbackStatusMsg) {
            feedbackStatusMsg.style.display = 'block';
            feedbackStatusMsg.style.background = '#fce8e6';
            feedbackStatusMsg.style.color = '#c5221f';
            feedbackStatusMsg.style.border = '1px solid #fad2cf';
            feedbackStatusMsg.textContent = 'Could not send feedback. Please try again.';
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Private Feedback';
          }
        });
      });
    }

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

  function triggerJSONExport() {
    var child = ChildManager.getActiveChild();
    if (!child) {
      showToast('Please create or select a child profile first.');
      return;
    }
    try {
      var data = ChildManager.getChildData(child.id);
      ExportManager.exportJSON(data, child);
      showToast('JSON backup file downloaded!');
    } catch (e) {
      console.error('Export JSON error:', e);
      showToast('Failed to export JSON backup.');
    }
  }

  function bindExportEvents() {
    function ensureActiveChild() {
      var child = ChildManager.getActiveChild();
      if (!child) {
        showToast('Please create or select a child profile first.');
        return null;
      }
      return child;
    }

    var btnCSV = document.getElementById('export-csv');
    var btnPNG = document.getElementById('export-chart');
    var btnJSON = document.getElementById('export-json');
    var quickBackupBtn = document.getElementById('quick-backup-btn');
    var headerBackupBtn = document.getElementById('header-backup-btn');
    var modalBackupJsonBtn = document.getElementById('modal-backup-json-btn');
    var btnEHR = document.getElementById('export-ehr');

    if (btnCSV) {
      btnCSV.addEventListener('click', function () {
        var child = ensureActiveChild();
        if (!child) return;
        try {
          var data = ChildManager.getChildData(child.id);
          ExportManager.exportCSV(data, child, units);
          showToast('CSV downloaded!');
        } catch (e) {
          console.error('Export CSV error:', e);
          showToast('Failed to export CSV file.');
        }
      });
    }

    if (btnPNG) {
      btnPNG.addEventListener('click', function () {
        var child = ensureActiveChild();
        if (!child) return;
        try {
          var data = ChildManager.getChildData(child.id);
          ExportManager.exportPDF(data, child, units);
          showToast('PDF downloaded!');
        } catch (e) {
          console.error('Export PDF error:', e);
          showToast('Failed to export PDF report.');
        }
      });
    }

    if (btnJSON) btnJSON.addEventListener('click', triggerJSONExport);
    if (quickBackupBtn) quickBackupBtn.addEventListener('click', triggerJSONExport);
    if (headerBackupBtn) headerBackupBtn.addEventListener('click', triggerJSONExport);
    if (modalBackupJsonBtn) modalBackupJsonBtn.addEventListener('click', triggerJSONExport);

    if (btnEHR) {
      btnEHR.addEventListener('click', function () {
        var child = ensureActiveChild();
        if (!child) return;
        try {
          var data = ChildManager.getChildData(child.id);
          ExportManager.exportEHR(data, child);
          showToast('FHIR R4 EHR clinical record downloaded!');
        } catch (e) {
          console.error('Export EHR error:', e);
          showToast('Failed to export EHR record.');
        }
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

  function checkIncomingSharePayload() {
    if (!window.ShareManager) return;
    var payload = ShareManager.getIncomingPayload();
    if (!payload) return;

    var importModal = document.getElementById('import-share-modal');
    var childNameEl = document.getElementById('import-share-child-name');
    var confirmBtn = document.getElementById('confirm-import-share-btn');
    var cancelBtn = document.getElementById('cancel-import-share-btn');
    var closeBtn = document.getElementById('close-import-share-modal');

    if (childNameEl && payload.child && payload.child.name) {
      childNameEl.textContent = payload.child.name;
    }

    if (importModal) {
      openModal(importModal);
    }

    function cleanup() {
      closeModal(importModal);
      ShareManager.clearShareUrlParam();
    }

    if (cancelBtn) cancelBtn.onclick = cleanup;
    if (closeBtn) closeBtn.onclick = cleanup;

    if (confirmBtn) {
      confirmBtn.onclick = function () {
        try {
          var importedChild = ShareManager.importPayload(payload);
          cleanup();
          hideOnboarding();
          renderApp();
          showToast(importedChild.name + '\'s profile imported successfully!');
        } catch (e) {
          alert('Could not import profile: ' + e.message);
        }
      };
    }
  }

})();
