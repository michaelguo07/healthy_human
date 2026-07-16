/**
 * Summary — template-based plain-language growth summaries.
 *
 * NO AI / NO LLM — uses deterministic templates filled with real data.
 * All percentiles and trends come from GrowthCalc.
 */
window.Summary = (function () {
  'use strict';

  function ordinal(n) {
    n = Math.round(n);
    if (n <= 0) return '<1st';
    if (n > 99) return '>99th';
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function heightOrLength(ageMonths) {
    return ageMonths != null && ageMonths >= 24 ? 'height' : 'length';
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

  function getSource(ageMonths) {
    return ageMonths != null && ageMonths < 24
      ? 'WHO Child Growth Standards, 2006'
      : 'CDC Growth Charts, 2000';
  }

  function trendWord(current, previous) {
    if (current == null || previous == null) return null;
    var diff = Math.abs(current - previous);
    if (diff < 5) return null; // stable
    return {
      direction: current > previous ? 'up' : 'down',
      magnitude: diff >= 20 ? 'notable' : 'modest',
      previousPct: previous,
      currentPct: current
    };
  }

  // ─────────────────── main generator ───────────────────

  function generateGrowthSummary(childName, latestMeasurement, child, previousMeasurement) {
    if (!latestMeasurement || !child) {
      return '<p class="summary-text">Add measurements to see a growth summary for ' +
             (childName || 'your child') + '.</p>';
    }

    var name = childName || child.name || 'your child';
    var dob = child.dob;
    var sex = child.sex || 'female';
    var ageM = ageInMonths(dob, latestMeasurement.date);

    var hMetric = ageM != null && ageM >= 24 ? 'stature_for_age' : 'length_for_age';
    var lengthWord = heightOrLength(ageM);

    // Calculate percentiles
    var wPct = getPercentile('weight_for_age', sex, ageM, latestMeasurement.weight_kg);
    var hPct = getPercentile(hMetric, sex, ageM, latestMeasurement.height_cm);
    var cPct = getPercentile('head_for_age', sex, ageM, latestMeasurement.head_cm);

    // Previous percentiles
    var prevWPct = null, prevHPct = null;
    if (previousMeasurement) {
      var prevAgeM = ageInMonths(dob, previousMeasurement.date);
      prevWPct = getPercentile('weight_for_age', sex, prevAgeM, previousMeasurement.weight_kg);
      prevHPct = getPercentile(hMetric, sex, prevAgeM, previousMeasurement.height_cm);
    }

    var lines = [];
    var hasConcern = false;

    // ── Template selection ──

    if (!previousMeasurement) {
      // Template 4: First measurement
      lines.push(
        '<p class="summary-text">First measurement logged for <strong>' + name +
        '</strong>! We\'ll track trends as you add more data points over time.</p>'
      );
    } else {
      var wTrend = trendWord(wPct, prevWPct);
      var hTrend = trendWord(hPct, prevHPct);

      if (!wTrend && !hTrend) {
        // Template 1: Normal tracking, stable
        var parts = [];
        if (wPct != null) parts.push(ordinal(wPct) + ' percentile for weight');
        if (hPct != null) parts.push(ordinal(hPct) + ' percentile for ' + lengthWord);
        lines.push(
          '<p class="summary-text"><strong>' + name + '</strong> is tracking steadily — ' +
          (parts.length > 0 ? parts.join(' and ') + '. ' : '') +
          'Looking good!</p>'
        );
      } else {
        // Template 2: Trend shift
        if (wTrend && wPct != null) {
          lines.push(
            '<p class="summary-text"><strong>' + name + '</strong> is at the ' +
            ordinal(wPct) + ' percentile for weight, ' +
            wTrend.direction + ' from the ' + ordinal(wTrend.previousPct) +
            ' at the last check. This is a ' + wTrend.magnitude +
            ' shift worth monitoring.</p>'
          );
        }
        if (hTrend && hPct != null) {
          lines.push(
            '<p class="summary-text"><strong>' + name + '</strong> is at the ' +
            ordinal(hPct) + ' percentile for ' + lengthWord + ', ' +
            hTrend.direction + ' from the ' + ordinal(hTrend.previousPct) +
            ' at the last check. This is a ' + hTrend.magnitude +
            ' shift worth monitoring.</p>'
          );
        }
        // Stable metrics
        if (!wTrend && wPct != null) {
          lines.push('<p class="summary-text">Weight is stable at the ' + ordinal(wPct) + ' percentile.</p>');
        }
        if (!hTrend && hPct != null) {
          lines.push('<p class="summary-text">' + (lengthWord.charAt(0).toUpperCase() + lengthWord.slice(1)) +
                     ' is stable at the ' + ordinal(hPct) + ' percentile.</p>');
        }
      }
    }

    // Template 3: Extreme percentile warnings
    var extremes = [];
    if (wPct != null && wPct < 3) extremes.push({ metric: 'Weight', pct: wPct, direction: 'below the 3rd' });
    if (wPct != null && wPct > 97) extremes.push({ metric: 'Weight', pct: wPct, direction: 'above the 97th' });
    if (hPct != null && hPct < 3) extremes.push({ metric: lengthWord.charAt(0).toUpperCase() + lengthWord.slice(1), pct: hPct, direction: 'below the 3rd' });
    if (hPct != null && hPct > 97) extremes.push({ metric: lengthWord.charAt(0).toUpperCase() + lengthWord.slice(1), pct: hPct, direction: 'above the 97th' });
    if (cPct != null && cPct < 3) extremes.push({ metric: 'Head circumference', pct: cPct, direction: 'below the 3rd' });
    if (cPct != null && cPct > 97) extremes.push({ metric: 'Head circumference', pct: cPct, direction: 'above the 97th' });

    extremes.forEach(function (e) {
      hasConcern = true;
      lines.push(
        '<p class="summary-note"><strong>Note:</strong> ' + e.metric + ' is at the ' +
        ordinal(e.pct) + ' percentile, which is ' + e.direction +
        ' percentile band. This may be perfectly normal for ' + name +
        ', but it\'s worth mentioning at your next pediatrician visit.</p>'
      );
    });

    // Template 5: Advisory footer
    if (hasConcern) {
      lines.push(
        '<p class="summary-advisory">This tool tracks and compares data — always loop in your pediatrician for guidance specific to ' +
        name + '.</p>'
      );
    }

    // Template 6: Source citation
    var source = getSource(ageM);
    lines.push('<p class="summary-source">Source: ' + source + '</p>');

    return '<div class="growth-summary-content">' + lines.join('') + '</div>';
  }

  return {
    generateGrowthSummary: generateGrowthSummary
  };
})();
