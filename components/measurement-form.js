/**
 * MeasurementForm — handles the measurement input form.
 *
 * Accepts imperial or metric inputs, always converts to metric (kg, cm) for storage.
 */
window.MeasurementForm = (function () {
  'use strict';

  var LB_TO_KG = 1 / 2.20462;
  var IN_TO_CM = 2.54;

  var formEl = null;
  var onSubmitCb = null;
  var currentUnits = 'imperial';

  function todayISO() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function init(formId, onSubmit) {
    formEl = typeof formId === 'string' ? document.getElementById(formId) : formId;
    onSubmitCb = onSubmit;
    if (!formEl) {
      console.warn('MeasurementForm.init: form not found:', formId);
      return;
    }

    // Default date
    var dateInput = formEl.querySelector('[name="date"], #measure-date, #measurement-date');
    if (dateInput) dateInput.value = todayISO();

    formEl.addEventListener('submit', handleSubmit);
    updateUnits(currentUnits);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!formEl || !onSubmitCb) return;

    var dateInput = formEl.querySelector('[name="date"], #measure-date, #measurement-date');
    var weightInput = formEl.querySelector('[name="weight"], #measure-weight, #measurement-weight');
    var heightInput = formEl.querySelector('[name="height"], #measure-height, #measurement-height');
    var headInput = formEl.querySelector('[name="head"], #measure-head, #measurement-head');

    var date = dateInput ? dateInput.value : todayISO();
    var weightRaw = weightInput ? parseFloat(weightInput.value) : NaN;
    var heightRaw = heightInput ? parseFloat(heightInput.value) : NaN;
    var headRaw = headInput ? parseFloat(headInput.value) : NaN;

    // Validate — at least one measurement must be present
    if (isNaN(weightRaw) && isNaN(heightRaw) && isNaN(headRaw)) {
      // Try to show validation message
      var msg = formEl.querySelector('.form-error');
      if (msg) {
        msg.textContent = 'Please enter at least one measurement.';
        msg.hidden = false;
      }
      return;
    }

    // Convert to metric if imperial
    var weight_kg = null;
    var height_cm = null;
    var head_cm = null;

    if (!isNaN(weightRaw)) {
      weight_kg = currentUnits === 'imperial' ? weightRaw * LB_TO_KG : weightRaw;
    }
    if (!isNaN(heightRaw)) {
      height_cm = currentUnits === 'imperial' ? heightRaw * IN_TO_CM : heightRaw;
    }
    if (!isNaN(headRaw)) {
      head_cm = currentUnits === 'imperial' ? headRaw * IN_TO_CM : headRaw;
    }

    // Hide any previous error
    var msg2 = formEl.querySelector('.form-error');
    if (msg2) msg2.hidden = true;

    onSubmitCb({
      date: date,
      weight_kg: weight_kg,
      height_cm: height_cm,
      head_cm: head_cm
    });
  }

  function reset() {
    if (formEl) {
      formEl.reset();
      var dateInput = formEl.querySelector('[name="date"], #measure-date, #measurement-date');
      if (dateInput) dateInput.value = todayISO();
      var msg = formEl.querySelector('.form-error');
      if (msg) msg.hidden = true;
    }
  }

  function setDate(date) {
    if (!formEl) return;
    var dateInput = formEl.querySelector('[name="date"], #measure-date, #measurement-date');
    if (dateInput) dateInput.value = date;
  }

  function updateUnits(units) {
    currentUnits = units;
    if (!formEl) return;

    // Update unit labels (supporting sibling selectors)
    var weightLabel = formEl.querySelector('.weight-unit, [data-unit="weight"], #measure-weight ~ .unit-label, #measurement-weight ~ .unit-label');
    var heightLabel = formEl.querySelector('.height-unit, [data-unit="height"], #measure-height ~ .unit-label, #measurement-height ~ .unit-label');
    var headLabel = formEl.querySelector('.head-unit, [data-unit="head"], #measure-head ~ .unit-label, #measurement-head ~ .unit-label');

    var wUnit = units === 'imperial' ? 'lb' : 'kg';
    var hUnit = units === 'imperial' ? 'in' : 'cm';

    if (weightLabel) weightLabel.textContent = wUnit;
    if (heightLabel) heightLabel.textContent = hUnit;
    if (headLabel) headLabel.textContent = hUnit;

    // Update placeholders
    var weightInput = formEl.querySelector('[name="weight"], #measure-weight, #measurement-weight');
    var heightInput = formEl.querySelector('[name="height"], #measure-height, #measurement-height');
    var headInput = formEl.querySelector('[name="head"], #measure-head, #measurement-head');

    if (weightInput) weightInput.placeholder = units === 'imperial' ? 'e.g. 15.9' : 'e.g. 7.2';
    if (heightInput) heightInput.placeholder = units === 'imperial' ? 'e.g. 27.0' : 'e.g. 68.5';
    if (headInput) headInput.placeholder = units === 'imperial' ? 'e.g. 17.0' : 'e.g. 43.2';
  }

  return {
    init: init,
    reset: reset,
    setDate: setDate,
    updateUnits: updateUnits
  };
})();
