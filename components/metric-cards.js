/**
 * MetricCards — renders the 3 metric summary cards (Weight, Length, Head Circ.)
 *
 * All data arrives in metric (kg, cm). Display converts based on unit setting.
 */
window.MetricCards = (function () {
  'use strict';

  var KG_TO_LB = 2.20462;
  var CM_TO_IN = 1 / 2.54;

  function ordinal(n) {
    n = Math.round(n);
    if (n <= 0) return '<1st';
    if (n > 99) return '>99th';
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getTrend(current, previous) {
    if (current == null || previous == null) return null;
    var diff = current - previous;
    var pctChange = Math.abs(diff / previous) * 100;
    if (pctChange < 5) return { cls: 'trend-stable', arrow: '→', text: 'Stable vs. last check' };
    if (diff > 0 && pctChange >= 15) return { cls: 'trend-sharp', arrow: '↗', text: 'Notable increase since last check' };
    if (diff < 0 && pctChange >= 15) return { cls: 'trend-sharp', arrow: '↘', text: 'Notable decrease since last check' };
    if (diff > 0) return { cls: 'trend-up', arrow: '↗', text: 'Up since last check' };
    return { cls: 'trend-down', arrow: '↘', text: 'Down since last check' };
  }

  function buildCard(label, value, unit, percentile, trend, date, isAlert) {
    var alertCls = isAlert ? ' metric-card--alert' : '';
    var pctStr = percentile != null ? ordinal(percentile) + ' percentile' : '—';
    var trendHtml = '';
    if (trend) {
      trendHtml =
        '<div class="metric-trend ' + trend.cls + '">' +
          '<span class="trend-arrow">' + trend.arrow + '</span>' +
          '<span class="trend-text">' + trend.text + '</span>' +
        '</div>';
    }
    return (
      '<div class="metric-card' + alertCls + '">' +
        '<div class="metric-label">' + label.toUpperCase() + '</div>' +
        '<div class="metric-value">' +
          (value != null ? value : '—') +
          (value != null ? ' <span class="metric-unit">' + unit + '</span>' : '') +
        '</div>' +
        '<div class="metric-percentile">' + pctStr + '</div>' +
        trendHtml +
        '<div class="metric-updated">Updated ' + formatDate(date) + '</div>' +
      '</div>'
    );
  }

  function getPercentile(metric, sex, ageMonths, value) {
    if (value == null || ageMonths == null) return null;
    try {
      var lms = GrowthCalc.lookupLMS(metric, sex, ageMonths);
      if (!lms) return null;
      var z = GrowthCalc.calculateZScore(value, lms.L, lms.M, lms.S);
      if (z == null || !isFinite(z)) return null;
      return GrowthCalc.zScoreToPercentile(z);
    } catch (e) {
      return null;
    }
  }

  function ageInMonths(dob, date) {
    if (!dob || !date) return null;
    var d1 = new Date(dob + 'T00:00:00');
    var d2 = new Date(date + 'T00:00:00');
    return (d2.getFullYear() - d1.getFullYear()) * 12 +
           (d2.getMonth() - d1.getMonth()) +
           (d2.getDate() - d1.getDate()) / 30.44;
  }

  // ─────────────────── public ───────────────────

  function render(container, childData, units, child) {
    if (!container) return;

    var measurements = childData.measurements || [];
    var latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
    var previous = measurements.length > 1 ? measurements[measurements.length - 2] : null;
    var sex = child ? child.sex : 'female';
    var dob = child ? child.dob : null;

    var isImperial = units === 'imperial';

    // Weight card
    var wVal = null, wUnit = isImperial ? 'lb' : 'kg', wPct = null, wTrend = null, wDate = null, wAlert = false;
    if (latest && latest.weight_kg != null) {
      var ageM = ageInMonths(dob, latest.date);
      wVal = isImperial ? (latest.weight_kg * KG_TO_LB).toFixed(1) : latest.weight_kg.toFixed(1);
      wPct = getPercentile('weight_for_age', sex, ageM, latest.weight_kg);
      wDate = latest.date;
      wAlert = wPct != null && (wPct < 3 || wPct > 97);
      if (previous && previous.weight_kg != null) {
        var prevAgeM = ageInMonths(dob, previous.date);
        var prevPct = getPercentile('weight_for_age', sex, prevAgeM, previous.weight_kg);
        if (wPct != null && prevPct != null) {
          wTrend = getTrend(wPct, prevPct);
        }
      }
    }

    // Length/Height card
    var hMetric = 'length_for_age';
    var hLabel = 'LENGTH';
    if (latest) {
      var am = ageInMonths(dob, latest.date);
      if (am != null && am >= 24) {
        hMetric = 'stature_for_age';
        hLabel = 'HEIGHT';
      }
    }
    var hVal = null, hUnit = isImperial ? 'in' : 'cm', hPct = null, hTrend = null, hDate = null, hAlert = false;
    if (latest && latest.height_cm != null) {
      var ageM2 = ageInMonths(dob, latest.date);
      hVal = isImperial ? (latest.height_cm * CM_TO_IN).toFixed(1) : latest.height_cm.toFixed(1);
      hPct = getPercentile(hMetric, sex, ageM2, latest.height_cm);
      hDate = latest.date;
      hAlert = hPct != null && (hPct < 3 || hPct > 97);
      if (previous && previous.height_cm != null) {
        var prevAgeM2 = ageInMonths(dob, previous.date);
        var prevPct2 = getPercentile(hMetric, sex, prevAgeM2, previous.height_cm);
        if (hPct != null && prevPct2 != null) {
          hTrend = getTrend(hPct, prevPct2);
        }
      }
    }

    // Head circumference card
    var cVal = null, cUnit = isImperial ? 'in' : 'cm', cPct = null, cTrend = null, cDate = null, cAlert = false;
    if (latest && latest.head_cm != null) {
      var ageM3 = ageInMonths(dob, latest.date);
      cVal = isImperial ? (latest.head_cm * CM_TO_IN).toFixed(1) : latest.head_cm.toFixed(1);
      cPct = getPercentile('head_for_age', sex, ageM3, latest.head_cm);
      cDate = latest.date;
      cAlert = cPct != null && (cPct < 3 || cPct > 97);
      if (previous && previous.head_cm != null) {
        var prevAgeM3 = ageInMonths(dob, previous.date);
        var prevPct3 = getPercentile('head_for_age', sex, prevAgeM3, previous.head_cm);
        if (cPct != null && prevPct3 != null) {
          cTrend = getTrend(cPct, prevPct3);
        }
      }
    }

    container.innerHTML =
      buildCard('WEIGHT', wVal, wUnit, wPct, wTrend, wDate, wAlert) +
      buildCard(hLabel, hVal, hUnit, hPct, hTrend, hDate, hAlert) +
      buildCard('HEAD CIRC.', cVal, cUnit, cPct, cTrend, cDate, cAlert);
  }

  return { render: render };
})();
