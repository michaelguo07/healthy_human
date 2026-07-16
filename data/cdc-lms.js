/**
 * CDC Growth Charts — LMS Parameters (2–20 years / 24–240 months)
 *
 * Source: Centers for Disease Control and Prevention,
 *   "2000 CDC Growth Charts for the United States: Methods and Development."
 *   Vital and Health Statistics, Series 11, Number 246, May 2002.
 *   https://www.cdc.gov/growthcharts/
 *
 * Key data points are official CDC values at the ages specified in the
 * CDC expanded data tables. Intermediate monthly values have been derived
 * via linear interpolation between adjacent key points.
 *
 * Units:
 *   weight_for_age: kg
 *   stature_for_age: cm
 *   bmi_for_age: kg/m²
 */

(function () {
  'use strict';

  /**
   * Linearly interpolate all whole-month entries between provided key points.
   * Key points MUST be sorted by month ascending.
   *
   * @param {Array<{month:number, L:number, M:number, S:number}>} keyPoints
   * @returns {Array<{month:number, L:number, M:number, S:number}>}
   */
  function expandKeyPoints(keyPoints) {
    if (!keyPoints || keyPoints.length === 0) return [];

    var result = [];
    var startMonth = Math.ceil(keyPoints[0].month);
    var endMonth   = Math.floor(keyPoints[keyPoints.length - 1].month);

    // Build index for fast bracket lookup
    var ki = 0;

    for (var m = startMonth; m <= endMonth; m++) {
      // Advance bracket pointer
      while (ki < keyPoints.length - 2 && keyPoints[ki + 1].month < m) {
        ki++;
      }

      var p0 = keyPoints[ki];
      var p1 = keyPoints[ki + 1];

      // If this month matches a key point exactly, use its values
      var matchExact = false;
      for (var j = 0; j < keyPoints.length; j++) {
        if (Math.abs(keyPoints[j].month - m) < 0.01) {
          result.push({
            month: m,
            L: keyPoints[j].L,
            M: keyPoints[j].M,
            S: keyPoints[j].S
          });
          matchExact = true;
          break;
        }
      }
      if (matchExact) continue;

      // Interpolate between p0 and p1
      if (p1.month === p0.month) {
        result.push({ month: m, L: p0.L, M: p0.M, S: p0.S });
        continue;
      }

      var frac = (m - p0.month) / (p1.month - p0.month);
      result.push({
        month: m,
        L: Math.round((p0.L + frac * (p1.L - p0.L)) * 100000) / 100000,
        M: Math.round((p0.M + frac * (p1.M - p0.M)) * 10000) / 10000,
        S: Math.round((p0.S + frac * (p1.S - p0.S)) * 100000) / 100000
      });
    }

    return result;
  }


  // ─── Key Data Points (official CDC values at Agemos) ──────────────
  // The .5 month values are the CDC table convention (mid-month).
  // We map them to whole months by rounding to nearest integer for
  // the expanded table, keeping the original .5 values as key anchors.

  var weightMaleKeys = [
    { month: 24.5, L: -0.2459,  M: 12.6939, S: 0.11565 },
    { month: 30.5, L: -0.3299,  M: 13.8937, S: 0.11184 },
    { month: 36.5, L: -0.3833,  M: 14.9959, S: 0.11009 },
    { month: 42.5, L: -0.4111,  M: 16.0479, S: 0.11039 },
    { month: 48.5, L: -0.4176,  M: 17.0770, S: 0.11219 },
    { month: 54.5, L: -0.4126,  M: 18.1180, S: 0.11506 },
    { month: 60.5, L: -0.3982,  M: 19.2010, S: 0.11829 },
    { month: 72.5, L: -0.3521,  M: 21.5885, S: 0.12449 },
    { month: 84.5, L: -0.2891,  M: 24.3484, S: 0.12996 },
    { month: 96.5, L: -0.2108,  M: 27.6070, S: 0.13449 },
    { month: 108.5, L: -0.1180, M: 31.4637, S: 0.13827 },
    { month: 120.5, L: -0.0078, M: 35.9367, S: 0.14170 },
    { month: 132.5, L: 0.1225,  M: 41.0075, S: 0.14516 },
    { month: 144.5, L: 0.2713,  M: 46.5621, S: 0.14857 },
    { month: 156.5, L: 0.4058,  M: 52.3286, S: 0.15077 },
    { month: 168.5, L: 0.4768,  M: 57.8629, S: 0.15048 },
    { month: 180.5, L: 0.4440,  M: 62.5391, S: 0.14775 },
    { month: 192.5, L: 0.3437,  M: 66.1742, S: 0.14433 },
    { month: 204.5, L: 0.2474,  M: 68.8879, S: 0.14178 },
    { month: 216.5, L: 0.1831,  M: 70.7659, S: 0.14047 },
    { month: 228.5, L: 0.1458,  M: 72.0476, S: 0.14014 },
    { month: 240.5, L: 0.1308,  M: 72.7752, S: 0.14035 }
  ];

  var weightFemaleKeys = [
    { month: 24.5, L: -0.5765,  M: 12.1294, S: 0.11608 },
    { month: 30.5, L: -0.6881,  M: 13.2630, S: 0.11418 },
    { month: 36.5, L: -0.7556,  M: 14.3242, S: 0.11440 },
    { month: 42.5, L: -0.7846,  M: 15.3647, S: 0.11624 },
    { month: 48.5, L: -0.7855,  M: 16.4326, S: 0.11907 },
    { month: 54.5, L: -0.7662,  M: 17.5597, S: 0.12242 },
    { month: 60.5, L: -0.7333,  M: 18.7695, S: 0.12576 },
    { month: 72.5, L: -0.6375,  M: 21.4352, S: 0.13218 },
    { month: 84.5, L: -0.5121,  M: 24.5179, S: 0.13785 },
    { month: 96.5, L: -0.3632,  M: 28.0783, S: 0.14261 },
    { month: 108.5, L: -0.1956, M: 32.1429, S: 0.14648 },
    { month: 120.5, L: -0.0107, M: 36.7261, S: 0.14970 },
    { month: 132.5, L: 0.1910,  M: 41.7983, S: 0.15240 },
    { month: 144.5, L: 0.3838,  M: 47.1027, S: 0.15401 },
    { month: 156.5, L: 0.5093,  M: 51.7508, S: 0.15371 },
    { month: 168.5, L: 0.5062,  M: 55.2780, S: 0.15161 },
    { month: 180.5, L: 0.3968,  M: 57.6800, S: 0.14887 },
    { month: 192.5, L: 0.2604,  M: 59.1529, S: 0.14662 },
    { month: 204.5, L: 0.1503,  M: 60.0168, S: 0.14537 },
    { month: 216.5, L: 0.0775,  M: 60.5448, S: 0.14498 },
    { month: 228.5, L: 0.0375,  M: 60.8707, S: 0.14521 },
    { month: 240.5, L: 0.0233,  M: 61.0488, S: 0.14570 }
  ];

  var statureMaleKeys = [
    { month: 24.5, L: 1, M: 87.0662,  S: 0.03810 },
    { month: 30.5, L: 1, M: 91.9728,  S: 0.03780 },
    { month: 36.5, L: 1, M: 96.0851,  S: 0.03810 },
    { month: 42.5, L: 1, M: 99.7037,  S: 0.03858 },
    { month: 48.5, L: 1, M: 103.0422, S: 0.03908 },
    { month: 54.5, L: 1, M: 106.2107, S: 0.03957 },
    { month: 60.5, L: 1, M: 109.2496, S: 0.04003 },
    { month: 72.5, L: 1, M: 115.0152, S: 0.04093 },
    { month: 84.5, L: 1, M: 120.5306, S: 0.04180 },
    { month: 96.5, L: 1, M: 125.8837, S: 0.04262 },
    { month: 108.5, L: 1, M: 131.1068, S: 0.04338 },
    { month: 120.5, L: 1, M: 136.2396, S: 0.04414 },
    { month: 132.5, L: 1, M: 141.3918, S: 0.04522 },
    { month: 144.5, L: 1, M: 147.0084, S: 0.04718 },
    { month: 156.5, L: 1, M: 153.4023, S: 0.04984 },
    { month: 168.5, L: 1, M: 160.2553, S: 0.05178 },
    { month: 180.5, L: 1, M: 166.4788, S: 0.05152 },
    { month: 192.5, L: 1, M: 170.8427, S: 0.04900 },
    { month: 204.5, L: 1, M: 173.3370, S: 0.04614 },
    { month: 216.5, L: 1, M: 174.6055, S: 0.04409 },
    { month: 228.5, L: 1, M: 175.2379, S: 0.04297 },
    { month: 240.5, L: 1, M: 175.5884, S: 0.04252 }
  ];

  var statureFemaleKeys = [
    { month: 24.5, L: 1, M: 85.7153,  S: 0.03976 },
    { month: 30.5, L: 1, M: 90.7960,  S: 0.03906 },
    { month: 36.5, L: 1, M: 95.0655,  S: 0.03893 },
    { month: 42.5, L: 1, M: 98.8584,  S: 0.03893 },
    { month: 48.5, L: 1, M: 102.3872, S: 0.03893 },
    { month: 54.5, L: 1, M: 105.7539, S: 0.03897 },
    { month: 60.5, L: 1, M: 108.9890, S: 0.03907 },
    { month: 72.5, L: 1, M: 115.1551, S: 0.03946 },
    { month: 84.5, L: 1, M: 120.9671, S: 0.04002 },
    { month: 96.5, L: 1, M: 126.5983, S: 0.04079 },
    { month: 108.5, L: 1, M: 132.1523, S: 0.04194 },
    { month: 120.5, L: 1, M: 137.7963, S: 0.04378 },
    { month: 132.5, L: 1, M: 143.8225, S: 0.04653 },
    { month: 144.5, L: 1, M: 150.0485, S: 0.04916 },
    { month: 156.5, L: 1, M: 155.3279, S: 0.04965 },
    { month: 168.5, L: 1, M: 158.7384, S: 0.04811 },
    { month: 180.5, L: 1, M: 160.4641, S: 0.04612 },
    { month: 192.5, L: 1, M: 161.2436, S: 0.04488 },
    { month: 204.5, L: 1, M: 161.6201, S: 0.04430 },
    { month: 216.5, L: 1, M: 161.8129, S: 0.04406 },
    { month: 228.5, L: 1, M: 161.9049, S: 0.04397 },
    { month: 240.5, L: 1, M: 161.9535, S: 0.04393 }
  ];

  var bmiMaleKeys = [
    { month: 24.5, L: -2.5779, M: 16.8009, S: 0.07891 },
    { month: 30.5, L: -2.1107, M: 16.3951, S: 0.07062 },
    { month: 36.5, L: -1.7477, M: 16.1022, S: 0.06740 },
    { month: 42.5, L: -1.4601, M: 15.9095, S: 0.06684 },
    { month: 48.5, L: -1.2279, M: 15.7827, S: 0.06762 },
    { month: 54.5, L: -1.0378, M: 15.6989, S: 0.06921 },
    { month: 60.5, L: -0.8785, M: 15.6469, S: 0.07124 },
    { month: 72.5, L: -0.6209, M: 15.6157, S: 0.07620 },
    { month: 84.5, L: -0.4191, M: 15.6955, S: 0.08170 },
    { month: 96.5, L: -0.2534, M: 16.0090, S: 0.08762 },
    { month: 108.5, L: -0.1066, M: 16.5695, S: 0.09402 },
    { month: 120.5, L: 0.0387,  M: 17.3381, S: 0.10074 },
    { month: 132.5, L: 0.1928,  M: 18.2598, S: 0.10733 },
    { month: 144.5, L: 0.3506,  M: 19.2574, S: 0.10302 },
    { month: 156.5, L: 0.4791,  M: 20.2239, S: 0.11686 },
    { month: 168.5, L: 0.5273,  M: 21.0736, S: 0.11823 },
    { month: 180.5, L: 0.4676,  M: 21.7908, S: 0.11742 },
    { month: 192.5, L: 0.3346,  M: 22.3937, S: 0.11566 },
    { month: 204.5, L: 0.1835,  M: 22.8847, S: 0.11413 },
    { month: 216.5, L: 0.0584,  M: 23.2660, S: 0.11336 },
    { month: 228.5, L: -0.0200, M: 23.5499, S: 0.11328 },
    { month: 240.5, L: -0.0527, M: 23.7382, S: 0.11356 }
  ];

  var bmiFemaleKeys = [
    { month: 24.5, L: -1.9928, M: 16.4019, S: 0.08147 },
    { month: 30.5, L: -1.6318, M: 16.0499, S: 0.07490 },
    { month: 36.5, L: -1.3854, M: 15.7926, S: 0.07225 },
    { month: 42.5, L: -1.2101, M: 15.6286, S: 0.07166 },
    { month: 48.5, L: -1.0815, M: 15.5169, S: 0.07208 },
    { month: 54.5, L: -0.9850, M: 15.4385, S: 0.07321 },
    { month: 60.5, L: -0.9118, M: 15.3862, S: 0.07481 },
    { month: 72.5, L: -0.8124, M: 15.3500, S: 0.07912 },
    { month: 84.5, L: -0.7441, M: 15.4806, S: 0.08455 },
    { month: 96.5, L: -0.6934, M: 15.8270, S: 0.09094 },
    { month: 108.5, L: -0.6491, M: 16.3770, S: 0.09803 },
    { month: 120.5, L: -0.5988, M: 17.1180, S: 0.10535 },
    { month: 132.5, L: -0.5305, M: 18.0001, S: 0.11197 },
    { month: 144.5, L: -0.4384, M: 18.9391, S: 0.11693 },
    { month: 156.5, L: -0.3305, M: 19.8190, S: 0.11975 },
    { month: 168.5, L: -0.2215, M: 20.5296, S: 0.12068 },
    { month: 180.5, L: -0.1254, M: 21.0465, S: 0.12044 },
    { month: 192.5, L: -0.0492, M: 21.3914, S: 0.11967 },
    { month: 204.5, L: 0.0060,  M: 21.6063, S: 0.11892 },
    { month: 216.5, L: 0.0437,  M: 21.7362, S: 0.11847 },
    { month: 228.5, L: 0.0670,  M: 21.8124, S: 0.11830 },
    { month: 240.5, L: 0.0787,  M: 21.8531, S: 0.11830 }
  ];


  // ─── Build the expanded tables ────────────────────────────────────

  window.CDC_LMS = {

    weight_for_age: {
      male:   expandKeyPoints(weightMaleKeys),
      female: expandKeyPoints(weightFemaleKeys)
    },

    stature_for_age: {
      male:   expandKeyPoints(statureMaleKeys),
      female: expandKeyPoints(statureFemaleKeys)
    },

    bmi_for_age: {
      male:   expandKeyPoints(bmiMaleKeys),
      female: expandKeyPoints(bmiFemaleKeys)
    }

  };

})();
