/**
 * GrowthChart — Chart.js powered hero growth curve for Healthy Human.
 *
 * Renders WHO/CDC percentile bands with the child's data overlaid.
 * The chart is responsive and animates a left-to-right draw on first load.
 */
window.GrowthChart = (function () {
  'use strict';

  var chart = null;
  var canvasId = null;
  var onEditCallback = null;
  var onDeleteCallback = null;
  var hideTimeout = null;
  var mouseInTooltip = false;

  function hideTooltip() {
    var tooltipEl = document.getElementById('chartjs-tooltip');
    if (tooltipEl) {
      tooltipEl.style.opacity = 0;
      tooltipEl.style.pointerEvents = 'none';
      mouseInTooltip = false;
    }
  }

  // Percentile z-scores
  var PERCENTILE_Z = {
    3:  -1.88,
    15: -1.04,
    50:  0,
    85:  1.04,
    97:  1.88
  };

  var BAND_COLORS = {
    outer: 'rgba(78,139,124,0.06)',
    inner: 'rgba(78,139,124,0.10)'
  };

  var LINE_COLORS = {
    p50:    'rgba(78,139,124,0.4)',
    p3_97:  'rgba(78,139,124,0.25)',
    p15_85: 'rgba(78,139,124,0.15)',
    baby:   '#4E8B7C'
  };

  // ───────────────────── helpers ─────────────────────

  var KG_TO_LB = 2.20462262;
  var CM_TO_IN = 0.39370079;

  function generatePercentileData(metric, sex, percentile, maxMonth, units) {
    var z = PERCENTILE_Z[percentile];
    var points = [];
    var isImperial = units === 'imperial';
    for (var m = 0; m <= maxMonth; m += 0.5) {
      try {
        var val = GrowthCalc.getMeasurementFromPercentile(metric, sex, m, z);
        if (val != null && isFinite(val)) {
          if (isImperial) {
            if (metric.indexOf('weight') !== -1) {
              val = val * KG_TO_LB;
            } else {
              val = val * CM_TO_IN;
            }
          }
          points.push({ x: m, y: Math.round(val * 10) / 10 });
        }
      } catch (e) {
        // skip months outside LMS data range
      }
    }
    return points;
  }

  function getMaxMonth(childDob) {
    if (!childDob) return 24;
    var dob = new Date(childDob + 'T00:00:00');
    var now = new Date();
    var ageMonths = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
    if (ageMonths < 24) return 24; // Always show full 0-2 years WHO curve
    if (ageMonths <= 36) return 48; // Show up to 4 years
    return Math.min(Math.ceil(ageMonths / 12) * 12 + 12, 240); // Scale dynamically up to 20 years
  }

  function metricLabel(metric, units) {
    var isImperial = units === 'imperial';
    switch (metric) {
      case 'weight_for_age': return 'Weight (' + (isImperial ? 'lb' : 'kg') + ')';
      case 'length_for_age':
      case 'height_for_age':
      case 'stature_for_age': return 'Length/Height (' + (isImperial ? 'in' : 'cm') + ')';
      case 'head_for_age':
      case 'head_circumference_for_age': return 'Head Circ. (' + (isImperial ? 'in' : 'cm') + ')';
      default: return 'Value';
    }
  }

  function formatAge(months) {
    if (months < 1) return Math.round(months * 30) + 'd';
    if (months < 24) return Math.round(months) + 'mo';
    var y = Math.floor(months / 12);
    var m = Math.round(months % 12);
    return y + 'y' + (m > 0 ? ' ' + m + 'mo' : '');
  }

  function ordinal(n) {
    n = Math.round(n);
    if (n <= 0) return '<1st';
    if (n > 99) return '>99th';
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ───────────────── percentile label plugin ─────────────────

  var percentileLabelPlugin = {
    id: 'percentileLabels',
    afterDraw: function (chart) {
      var ctx = chart.ctx;
      var meta = chart._percentileLabels;
      if (!meta || !meta.length) return;

      ctx.save();
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      meta.forEach(function (item) {
        var ds = chart.data.datasets[item.dsIndex];
        if (!ds || !ds.data || ds.data.length === 0) return;
        var lastPt = ds.data[ds.data.length - 1];
        var yPixel = chart.scales.y.getPixelForValue(lastPt.y);
        var xPixel = chart.scales.x.getPixelForValue(lastPt.x);
        if (yPixel == null || xPixel == null) return;
        ctx.fillStyle = 'rgba(78,139,124,0.55)';
        ctx.fillText(item.label, xPixel + 4, yPixel);
      });
      ctx.restore();
    }
  };

  // ───────────────── build chart config ─────────────────

  function buildConfig(childData, metric, sex, childDob, units) {
    var maxMonth = getMaxMonth(childDob);
    var measurements = childData.measurements || [];
    var isImperial = units === 'imperial';

    // Determine metric key for measurement extraction
    var valueKey;
    switch (metric) {
      case 'weight_for_age': valueKey = 'weight_kg'; break;
      case 'length_for_age':
      case 'height_for_age':
      case 'stature_for_age': valueKey = 'height_cm'; break;
      case 'head_for_age': valueKey = 'head_cm'; break;
      default: valueKey = 'weight_kg';
    }

    // Build baby data points
    var dob = childDob ? new Date(childDob + 'T00:00:00') : null;
    var babyData = [];
    if (dob) {
      measurements.forEach(function (m) {
        var val = m[valueKey];
        if (val == null) return;
        var mDate = new Date(m.date + 'T00:00:00');
        var ageMonths = (mDate.getFullYear() - dob.getFullYear()) * 12 +
                        (mDate.getMonth() - dob.getMonth()) +
                        (mDate.getDate() - dob.getDate()) / 30.44;
        if (ageMonths < 0) ageMonths = 0;

        if (isImperial) {
          if (valueKey === 'weight_kg') {
            val = val * KG_TO_LB;
          } else {
            val = val * CM_TO_IN;
          }
        }

        babyData.push({
          id: m.id,
          x: Math.round(ageMonths * 100) / 100,
          y: Math.round(val * 100) / 100,
          date: m.date
        });
      });
      babyData.sort(function (a, b) { return a.x - b.x; });
    }

    // Generate percentile curves
    var p3  = generatePercentileData(metric, sex, 3, maxMonth, units);
    var p15 = generatePercentileData(metric, sex, 15, maxMonth, units);
    var p50 = generatePercentileData(metric, sex, 50, maxMonth, units);
    var p85 = generatePercentileData(metric, sex, 85, maxMonth, units);
    var p97 = generatePercentileData(metric, sex, 97, maxMonth, units);

    // Datasets: bands are achieved via fill between adjacent datasets
    // Order from bottom: p3, p15, p50, p85, p97
    var datasets = [
      {
        // 0 — 3rd percentile line
        label: '3rd',
        data: p3,
        borderColor: LINE_COLORS.p3_97,
        borderWidth: 1,
        borderDash: [2, 3],
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        order: 5
      },
      {
        // 1 — 15th percentile line (fill down to 3rd)
        label: '15th',
        data: p15,
        borderColor: LINE_COLORS.p15_85,
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: { target: 0, above: BAND_COLORS.outer },
        tension: 0.3,
        order: 5
      },
      {
        // 2 — 50th percentile line (fill down to 15th)
        label: '50th',
        data: p50,
        borderColor: LINE_COLORS.p50,
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: { target: 1, above: BAND_COLORS.inner },
        tension: 0.3,
        order: 5
      },
      {
        // 3 — 85th percentile line (fill down to 50th)
        label: '85th',
        data: p85,
        borderColor: LINE_COLORS.p15_85,
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: { target: 2, above: BAND_COLORS.inner },
        tension: 0.3,
        order: 5
      },
      {
        // 4 — 97th percentile line (fill down to 85th)
        label: '97th',
        data: p97,
        borderColor: LINE_COLORS.p3_97,
        borderWidth: 1,
        borderDash: [2, 3],
        pointRadius: 0,
        fill: { target: 3, above: BAND_COLORS.outer },
        tension: 0.3,
        order: 5
      },
      {
        // 5 — Baby's data
        label: 'Baby',
        data: babyData,
        borderColor: LINE_COLORS.baby,
        backgroundColor: LINE_COLORS.baby,
        borderWidth: 2.5,
        pointRadius: 4,
        pointHitRadius: 10,
        pointBackgroundColor: '#fff',
        pointBorderColor: LINE_COLORS.baby,
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        pointHoverBorderWidth: 3,
        pointShadowOffsetX: 0,
        pointShadowOffsetY: 2,
        pointShadowBlur: 4,
        pointShadowColor: 'rgba(78,139,124,0.3)',
        fill: false,
        tension: 0.25,
        order: 1
      }
    ];

    // Percentile labels to render on right side
    var percentileLabels = [
      { dsIndex: 0, label: '3rd' },
      { dsIndex: 1, label: '15th' },
      { dsIndex: 2, label: '50th' },
      { dsIndex: 3, label: '85th' },
      { dsIndex: 4, label: '97th' }
    ];

    var reducedMotion = prefersReducedMotion();

    return {
      type: 'line',
      data: { datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 38, top: 8, bottom: 4 } },
        animation: reducedMotion ? false : {
          duration: 1200,
          easing: 'easeOutQuart',
          x: {
            type: 'number',
            duration: 1200,
            from: NaN,
            delay: function (ctx) {
              if (ctx.type !== 'data' || ctx.datasetIndex !== 5) return 0;
              return ctx.dataIndex * 100;
            }
          },
          y: {
            type: 'number',
            duration: 800,
            from: NaN,
            delay: function (ctx) {
              if (ctx.type !== 'data' || ctx.datasetIndex !== 5) return 0;
              return ctx.dataIndex * 100;
            }
          }
        },
        interaction: {
          mode: 'nearest',
          intersect: true
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: function (context) {
              var tooltipEl = document.getElementById('chartjs-tooltip');

              if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.id = 'chartjs-tooltip';
                tooltipEl.className = 'custom-chart-tooltip';
                document.body.appendChild(tooltipEl);
                
                tooltipEl.addEventListener('mouseenter', function () {
                  mouseInTooltip = true;
                  clearTimeout(hideTimeout);
                });
                tooltipEl.addEventListener('mouseleave', function () {
                  mouseInTooltip = false;
                  hideTooltip();
                });
              }

              var tooltipModel = context.tooltip;
              var dataPoints = tooltipModel.dataPoints || [];
              var babyPoint = dataPoints.find(function (dp) { return dp.datasetIndex === 5; });

              if (!babyPoint || tooltipModel.opacity === 0) {
                if (mouseInTooltip) {
                  return; // Stay open!
                }
                clearTimeout(hideTimeout);
                hideTimeout = setTimeout(function () {
                  hideTooltip();
                }, 150);
                return;
              }
              
              clearTimeout(hideTimeout);

              if (tooltipModel.body) {
                var titleLines = tooltipModel.title || [];
                var raw = babyPoint.raw;
                var measurementId = raw ? raw.id : null;

                var html = '';
                if (titleLines.length > 0) {
                  html += '<div class="tooltip-title">' + titleLines[0] + '</div>';
                }
                
                var ageStr = formatAge(raw.x);
                var unitStr = metric.indexOf('weight') !== -1 ? (isImperial ? 'lb' : 'kg') : (isImperial ? 'in' : 'cm');
                var metricName = metricLabel(metric, units).split('(')[0].trim();
                var valStr = raw.y + ' ' + unitStr;
                
                var pctStr = '—';
                try {
                  var rawY = raw.y;
                  if (isImperial) {
                    if (metric.indexOf('weight') !== -1) {
                      rawY = raw.y / KG_TO_LB;
                    } else {
                      rawY = raw.y / CM_TO_IN;
                    }
                  }
                  var lms = GrowthCalc.lookupLMS(metric, sex, raw.x);
                  if (lms) {
                    var z = GrowthCalc.calculateZScore(rawY, lms.L, lms.M, lms.S);
                    var pct = GrowthCalc.zScoreToPercentile(z);
                    pctStr = ordinal(pct);
                  }
                } catch(e) {}

                html += '<div class="tooltip-body">';
                html += '<div><span class="tooltip-label">Age:</span> ' + ageStr + '</div>';
                html += '<div><span class="tooltip-label">' + metricName + ':</span> ' + valStr + '</div>';
                html += '<div><span class="tooltip-label">Percentile:</span> ' + pctStr + '</div>';
                html += '</div>';

                if (measurementId) {
                  html += '<div class="tooltip-actions">';
                  html += '<button type="button" class="tooltip-btn tooltip-btn--edit" data-id="' + measurementId + '">';
                  html += '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Edit</button>';
                  html += '<button type="button" class="tooltip-btn tooltip-btn--delete" data-id="' + measurementId + '">';
                  html += '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Delete</button>';
                  html += '</div>';
                }
                
                tooltipEl.innerHTML = html;

                var editBtn = tooltipEl.querySelector('.tooltip-btn--edit');
                if (editBtn) {
                  editBtn.addEventListener('click', function () {
                    var mid = this.getAttribute('data-id');
                    hideTooltip();
                    if (onEditCallback) onEditCallback(mid);
                  });
                }
                var deleteBtn = tooltipEl.querySelector('.tooltip-btn--delete');
                if (deleteBtn) {
                  deleteBtn.addEventListener('click', function () {
                    var mid = this.getAttribute('data-id');
                    hideTooltip();
                    if (onDeleteCallback) onDeleteCallback(mid);
                  });
                }
              }

              var position = context.chart.canvas.getBoundingClientRect();
              tooltipEl.style.opacity = 1;
              tooltipEl.style.position = 'absolute';
              
              var leftPos = window.pageXOffset + position.left + tooltipModel.caretX;
              var topPos = window.pageYOffset + position.top + tooltipModel.caretY;
              
              tooltipEl.style.left = (leftPos - 85) + 'px';
              tooltipEl.style.top = (topPos - tooltipEl.offsetHeight - 6) + 'px';
              tooltipEl.style.pointerEvents = 'auto';
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: maxMonth,
            title: {
              display: true,
              text: 'Age (months)',
              font: { family: 'Inter, sans-serif', size: 12, weight: '500' },
              color: '#6b8882'
            },
            ticks: {
              stepSize: maxMonth <= 24 ? 2 : maxMonth <= 48 ? 6 : 12,
              font: { family: 'IBM Plex Mono, monospace', size: 11 },
              color: '#8fa9a3',
              callback: function (v) { return v; }
            },
            grid: {
              color: 'rgba(78,139,124,0.07)',
              drawTicks: false
            },
            border: { color: 'rgba(78,139,124,0.12)' }
          },
          y: {
            title: {
              display: true,
              text: metricLabel(metric, units),
              font: { family: 'Inter, sans-serif', size: 12, weight: '500' },
              color: '#6b8882'
            },
            ticks: {
              font: { family: 'IBM Plex Mono, monospace', size: 11 },
              color: '#8fa9a3'
            },
            grid: {
              color: 'rgba(78,139,124,0.07)',
              drawTicks: false
            },
            border: { color: 'rgba(78,139,124,0.12)' }
          }
        }
      },
      plugins: [percentileLabelPlugin],
      _percentileLabels: percentileLabels
    };
  }

  // ───────────── shadow plugin for baby data points ─────────────

  var pointShadowPlugin = {
    id: 'pointShadow',
    beforeDatasetDraw: function (chart, args) {
      if (args.index !== 5) return; // only baby dataset
      var ctx = chart.ctx;
      var meta = chart.getDatasetMeta(5);
      if (!meta || !meta.data) return;
      ctx.save();
      ctx.shadowColor = 'rgba(78,139,124,0.25)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    },
    afterDatasetDraw: function (chart, args) {
      if (args.index !== 5) return;
      chart.ctx.restore();
    }
  };

  // ───────────────────── public API ─────────────────────

  function init(id, options) {
    canvasId = id;
    if (options) {
      onEditCallback = options.onEdit;
      onDeleteCallback = options.onDelete;
    }
    var canvas = document.getElementById(id);
    if (!canvas) {
      console.error('GrowthChart.init: canvas #' + id + ' not found');
      return null;
    }
    // Register plugins globally once
    if (!Chart.registry.plugins.get('pointShadow')) {
      Chart.register(pointShadowPlugin);
    }
    if (!Chart.registry.plugins.get('percentileLabels')) {
      Chart.register(percentileLabelPlugin);
    }
    return true;
  }

  function update(childData, metric, sex, childDob, units) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;

    var config = buildConfig(childData, metric || 'weight_for_age', sex || 'female', childDob, units);

    if (chart) {
      chart.data = config.data;
      chart.options = config.options;
      chart._percentileLabels = config._percentileLabels;
      chart.update('none'); // instant update; animation runs on first creation
    } else {
      chart = new Chart(canvas, config);
      chart._percentileLabels = config._percentileLabels;
    }
  }

  function getChartImage() {
    if (!chart) return null;
    return chart.toBase64Image('image/png', 1);
  }

  function destroy() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  }

  return {
    init: init,
    update: update,
    getChartImage: getChartImage,
    buildConfig: buildConfig,
    destroy: destroy
  };
})();
