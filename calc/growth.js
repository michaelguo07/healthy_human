/**
 * Healthy Human — Growth Calculation Engine
 *
 * Pure functions for pediatric growth chart calculations using
 * WHO (0–24 mo) and CDC (2–20 yr) LMS reference data.
 *
 * Depends on:
 *   - window.WHO_LMS  (data/who-lms.js)
 *   - window.CDC_LMS  (data/cdc-lms.js)
 *
 * All functions are pure — no side effects, no DOM access.
 */

(function () {
  'use strict';

  // ─── Normal Distribution Helpers ───────────────────────────────────

  /**
   * Standard normal cumulative distribution function (CDF).
   * Uses the Abramowitz & Stegun error-function approximation (formula 7.1.26).
   *
   * @param {number} x — z-score
   * @returns {number} P(Z ≤ x), a value in [0, 1]
   */
  function normalCDF(x) {
    var a1 = 0.254829592;
    var a2 = -0.284496736;
    var a3 = 1.421413741;
    var a4 = -1.453152027;
    var a5 = 1.061405429;
    var p  = 0.3275911;

    var sign = x < 0 ? -1 : 1;
    var absX = Math.abs(x) / Math.sqrt(2);
    var t = 1.0 / (1.0 + p * absX);
    var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Inverse standard normal CDF (quantile function).
   * Rational approximation from Peter Acklam.
   * Accurate to ~1.15e-9 in the full range (0, 1).
   *
   * @param {number} p — probability in (0, 1)
   * @returns {number} z-score such that Φ(z) ≈ p
   */
  function inverseNormalCDF(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;

    // Coefficients for the rational approximation
    var a = [
      -3.969683028665376e+01,  2.209460984245205e+02,
      -2.759285104469687e+02,  1.383577518672690e+02,
      -3.066479806614716e+01,  2.506628277459239e+00
    ];
    var b = [
      -5.447609879822406e+01,  1.615858368580409e+02,
      -1.556989798598866e+02,  6.680131188771972e+01,
      -1.328068155288572e+01
    ];
    var c = [
      -7.784894002430293e-03, -3.223964580411365e-01,
      -2.400758277161838e+00, -2.549732539343734e+00,
       4.374664141464968e+00,  2.938163982698783e+00
    ];
    var d = [
       7.784695709041462e-03,  3.224671290700398e-01,
       2.445134137142996e+00,  3.754408661907416e+00
    ];

    var pLow  = 0.02425;
    var pHigh = 1 - pLow;
    var q, r;

    if (p < pLow) {
      // Lower tail
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
             ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
    } else if (p <= pHigh) {
      // Central region
      q = p - 0.5;
      r = q * q;
      return (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) * q /
             (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1);
    } else {
      // Upper tail
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
              ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
    }
  }


  // ─── Metric Mapping ───────────────────────────────────────────────

  /**
   * Maps user-facing metric names to WHO/CDC data keys.
   * WHO keys: weight_for_age, length_for_age, head_circumference_for_age
   * CDC keys: weight_for_age, stature_for_age, bmi_for_age
   */
  var WHO_METRIC_MAP = {
    'weight':             'weight_for_age',
    'weight_for_age':     'weight_for_age',
    'length':             'length_for_age',
    'length_for_age':     'length_for_age',
    'height':             'length_for_age',
    'head':               'head_circumference_for_age',
    'head_for_age':       'head_circumference_for_age',
    'head_circumference': 'head_circumference_for_age',
    'head_circumference_for_age': 'head_circumference_for_age'
  };

  var CDC_METRIC_MAP = {
    'weight':             'weight_for_age',
    'weight_for_age':     'weight_for_age',
    'length':             'stature_for_age',
    'length_for_age':     'stature_for_age',
    'height':             'stature_for_age',
    'stature':            'stature_for_age',
    'stature_for_age':    'stature_for_age',
    'bmi':                'bmi_for_age',
    'bmi_for_age':        'bmi_for_age',
    'head':               null,               // CDC doesn't track HC after 36 mo
    'head_for_age':       null,
    'head_circumference': null,
    'head_circumference_for_age': null
  };


  // ─── Core LMS Functions ───────────────────────────────────────────

  /**
   * Linearly interpolate a single value between two points.
   * @param {number} x  — query position
   * @param {number} x0 — lower bound position
   * @param {number} x1 — upper bound position
   * @param {number} y0 — value at x0
   * @param {number} y1 — value at x1
   * @returns {number}
   */
  function lerp(x, x0, x1, y0, y1) {
    if (x1 === x0) return y0;
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }

  /**
   * Look up and linearly interpolate L, M, S values from a sorted data array.
   *
   * @param {Array<{month:number, L:number, M:number, S:number}>} data
   * @param {number} ageMonths — decimal age in months
   * @returns {{L:number, M:number, S:number}|null} interpolated LMS or null if out of range
   */
  function interpolateLMS(data, ageMonths) {
    if (!data || data.length === 0) return null;

    // Clamp to data range
    var first = data[0];
    var last  = data[data.length - 1];

    if (ageMonths <= first.month) return { L: first.L, M: first.M, S: first.S };
    if (ageMonths >= last.month)  return { L: last.L,  M: last.M,  S: last.S };

    // Find bracketing entries
    for (var i = 0; i < data.length - 1; i++) {
      if (data[i].month <= ageMonths && ageMonths <= data[i + 1].month) {
        var d0 = data[i];
        var d1 = data[i + 1];
        return {
          L: lerp(ageMonths, d0.month, d1.month, d0.L, d1.L),
          M: lerp(ageMonths, d0.month, d1.month, d0.M, d1.M),
          S: lerp(ageMonths, d0.month, d1.month, d0.S, d1.S)
        };
      }
    }
    return null;
  }


  // ─── Public API ────────────────────────────────────────────────────

  window.GrowthCalc = {

    /**
     * Calculate z-score from a measurement using the LMS method.
     *
     * When L ≠ 0: Z = [((X / M) ^ L) - 1] / (L × S)
     * When L = 0: Z = ln(X / M) / S
     *
     * @param {number} measurement — observed value (kg, cm, etc.)
     * @param {number} L — Box-Cox power
     * @param {number} M — median
     * @param {number} S — coefficient of variation
     * @returns {number} z-score
     */
    calculateZScore: function (measurement, L, M, S) {
      if (M <= 0 || S <= 0) {
        throw new Error('M and S must be positive');
      }
      if (measurement <= 0) {
        throw new Error('Measurement must be positive');
      }

      if (Math.abs(L) < 1e-10) {
        // L effectively zero — use log form
        return Math.log(measurement / M) / S;
      }
      return (Math.pow(measurement / M, L) - 1) / (L * S);
    },

    /**
     * Convert a z-score to a percentile (0–100).
     *
     * @param {number} z — z-score
     * @returns {number} percentile (e.g., 50 for median)
     */
    zToPercentile: function (z) {
      return normalCDF(z) * 100;
    },
    zScoreToPercentile: function (z) {
      return this.zToPercentile(z);
    },

    /**
     * Convert a percentile (0–100) to the corresponding z-score.
     *
     * @param {number} p — percentile (0–100)
     * @returns {number} z-score
     */
    percentileToZ: function (p) {
      return inverseNormalCDF(p / 100);
    },

    /**
     * Look up LMS values for a given metric, sex, and decimal age.
     * Automatically selects WHO or CDC data based on age.
     * Performs linear interpolation between data points.
     *
     * @param {string} metric — e.g., 'weight', 'length', 'height', 'head', 'bmi'
     * @param {string} sex — 'male' or 'female'
     * @param {number} ageMonths — decimal age in months
     * @returns {{L:number, M:number, S:number}|null} LMS values or null if unavailable
     */
    lookupLMS: function (metric, sex, ageMonths) {
      var source = this.selectDataSource(ageMonths);
      var normalizedSex = sex.toLowerCase();
      var lms = null;

      if (source === 'WHO') {
        var whoKey = WHO_METRIC_MAP[metric.toLowerCase()];
        if (!whoKey || !window.WHO_LMS || !window.WHO_LMS[whoKey]) return null;
        var whoData = window.WHO_LMS[whoKey][normalizedSex];
        if (!whoData) return null;
        lms = interpolateLMS(whoData, ageMonths);
      } else {
        var cdcKey = CDC_METRIC_MAP[metric.toLowerCase()];
        if (!cdcKey || !window.CDC_LMS || !window.CDC_LMS[cdcKey]) return null;
        var cdcData = window.CDC_LMS[cdcKey][normalizedSex];
        if (!cdcData) return null;
        lms = interpolateLMS(cdcData, ageMonths);
      }

      return lms;
    },

    /**
     * Calculate the age of a child in months and days.
     *
     * @param {Date|string} dob — date of birth
     * @param {Date|string} measurementDate — date of measurement
     * @returns {{months: number, days: number, totalMonths: number}}
     *   months: whole months; days: remaining days; totalMonths: decimal months
     */
    calculateAge: function (dob, measurementDate) {
      var d1 = new Date(dob);
      var d2 = new Date(measurementDate);

      // Calculate whole months
      var months = (d2.getFullYear() - d1.getFullYear()) * 12 +
                   (d2.getMonth() - d1.getMonth());

      // If the day-of-month hasn't been reached yet, subtract a month
      if (d2.getDate() < d1.getDate()) {
        months--;
      }

      // Remaining days after whole months
      var tempDate = new Date(d1);
      tempDate.setMonth(tempDate.getMonth() + months);
      var days = Math.floor((d2 - tempDate) / (1000 * 60 * 60 * 24));

      // Total decimal months  (use 30.4375 avg days/month)
      var totalDays = (d2 - d1) / (1000 * 60 * 60 * 24);
      var totalMonths = totalDays / 30.4375;

      return {
        months: months,
        days: days,
        totalMonths: Math.round(totalMonths * 10000) / 10000
      };
    },

    /**
     * Determine the growth trend from consecutive percentile readings.
     *
     * @param {number} currentPercentile — current percentile (0–100)
     * @param {number} previousPercentile — previous percentile (0–100)
     * @returns {'sharp_up'|'up'|'stable'|'down'|'sharp_down'}
     */
    calculateTrend: function (currentPercentile, previousPercentile) {
      var diff = currentPercentile - previousPercentile;

      if (diff > 25)       return 'sharp_up';
      if (diff > 5)        return 'up';
      if (diff < -25)      return 'sharp_down';
      if (diff < -5)       return 'down';
      return 'stable';
    },

    /**
     * Select the appropriate data source based on the child's age.
     * WHO standards are used for children under 24 months;
     * CDC reference data for 24 months and older.
     *
     * @param {number} ageMonths — decimal age in months
     * @returns {'WHO'|'CDC'}
     */
    selectDataSource: function (ageMonths) {
      return ageMonths < 24 ? 'WHO' : 'CDC';
    },

    /**
     * Generate percentile band curve data for chart rendering.
     *
     * Returns reference curves at the 3rd, 15th, 50th, 85th, and 97th
     * percentiles. Each curve is an array of {month, value} points.
     *
     * @param {string} metric — 'weight', 'length'/'height', 'head', 'bmi'
     * @param {string} sex — 'male' or 'female'
     * @param {number} startMonth — start of range (inclusive)
     * @param {number} endMonth — end of range (inclusive)
     * @param {number} [step=1] — month increment between points
     * @returns {{p3:Array, p15:Array, p50:Array, p85:Array, p97:Array}}
     */
    getPercentileBands: function (metric, sex, startMonth, endMonth, step) {
      step = step || 1;

      var zScores = {
        p3:  inverseNormalCDF(0.03),
        p15: inverseNormalCDF(0.15),
        p50: 0,
        p85: inverseNormalCDF(0.85),
        p97: inverseNormalCDF(0.97)
      };

      var bands = { p3: [], p15: [], p50: [], p85: [], p97: [] };
      var self = this;

      for (var m = startMonth; m <= endMonth; m += step) {
        var lms = self.lookupLMS(metric, sex, m);
        if (!lms) continue;

        var keys = ['p3', 'p15', 'p50', 'p85', 'p97'];
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k];
          var value = self.getMeasurementFromPercentile(metric, sex, m, zScores[key]);
          if (value !== null) {
            bands[key].push({ month: m, value: Math.round(value * 1000) / 1000 });
          }
        }
      }

      return bands;
    },

    /**
     * Convert a z-score back to a measurement value (inverse LMS).
     *
     * When L ≠ 0: X = M × (1 + L × S × Z) ^ (1/L)
     * When L = 0: X = M × exp(S × Z)
     *
     * @param {string} metric — metric name
     * @param {string} sex — 'male' or 'female'
     * @param {number} ageMonths — decimal age in months
     * @param {number} zScore — target z-score
     * @returns {number|null} measurement value, or null if LMS unavailable
     */
    getMeasurementFromPercentile: function (metric, sex, ageMonths, zScore) {
      var lms = this.lookupLMS(metric, sex, ageMonths);
      if (!lms) return null;

      var L = lms.L;
      var M = lms.M;
      var S = lms.S;

      if (Math.abs(L) < 1e-10) {
        return M * Math.exp(S * zScore);
      }

      var inner = 1 + L * S * zScore;
      if (inner <= 0) return null; // invalid — would require complex numbers
      return M * Math.pow(inner, 1 / L);
    }

  };

})();
