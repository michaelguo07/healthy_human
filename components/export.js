/**
 * ExportManager — CSV, PNG chart image, and JSON backup exports.
 *
 * Uses Blob + URL.createObjectURL + click trick for file downloads.
 */
window.ExportManager = (function () {
  'use strict';

  var KG_TO_LB = 2.20462;
  var CM_TO_IN = 1 / 2.54;

  function ordinal(n) {
    if (n == null) return '—';
    n = Math.round(n);
    if (n <= 0) return '<1st';
    if (n > 99) return '>99th';
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function todayISO() {
    return new Date().toISOString().split('T')[0];
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

  function csvEscape(val) {
    if (val == null) return '""';
    var s = String(val);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // ─────────────────── CSV ───────────────────

  function exportCSV(childData, child, units) {
    var isImperial = units === 'imperial';
    var measurements = childData.measurements || [];
    var vaccines = childData.vaccines || [];
    var sex = child.sex || 'female';
    var dob = child.dob;

    var wUnit = isImperial ? 'lb' : 'kg';
    var hUnit = isImperial ? 'in' : 'cm';

    var rows = [];
    rows.push(csvEscape('Healthy Human - Growth Data Export'));
    rows.push(csvEscape('Child') + ',' + csvEscape(child.name));
    rows.push(csvEscape('Date of Birth') + ',' + csvEscape(dob));
    rows.push(csvEscape('Sex') + ',' + csvEscape(sex.charAt(0).toUpperCase() + sex.slice(1)));
    rows.push(csvEscape('Export Date') + ',' + csvEscape(todayISO()));
    rows.push(csvEscape('Source') + ',' + csvEscape('WHO Child Growth Standards, 2006 / CDC Growth Charts, 2000'));
    rows.push('');

    // Measurements section
    rows.push(csvEscape('Measurements'));
    rows.push([
      csvEscape('Date'),
      csvEscape('Age'),
      csvEscape('Weight (' + wUnit + ')'),
      csvEscape('Weight Percentile'),
      csvEscape('Length (' + hUnit + ')'),
      csvEscape('Length Percentile'),
      csvEscape('Head Circ (' + hUnit + ')'),
      csvEscape('Head Circ Percentile')
    ].join(','));

    measurements.forEach(function (m) {
      var ageM = ageInMonths(dob, m.date);
      var hMetric = ageM != null && ageM >= 24 ? 'stature_for_age' : 'length_for_age';

      var weight = m.weight_kg != null
        ? (isImperial ? (m.weight_kg * KG_TO_LB).toFixed(1) : m.weight_kg.toFixed(1))
        : '';
      var height = m.height_cm != null
        ? (isImperial ? (m.height_cm * CM_TO_IN).toFixed(1) : m.height_cm.toFixed(1))
        : '';
      var head = m.head_cm != null
        ? (isImperial ? (m.head_cm * CM_TO_IN).toFixed(1) : m.head_cm.toFixed(1))
        : '';

      var wPct = getPercentile('weight_for_age', sex, ageM, m.weight_kg);
      var hPct = getPercentile(hMetric, sex, ageM, m.height_cm);
      var cPct = getPercentile('head_for_age', sex, ageM, m.head_cm);

      rows.push([
        csvEscape(m.date),
        csvEscape(formatAge(ageM)),
        csvEscape(weight),
        csvEscape(ordinal(wPct)),
        csvEscape(height),
        csvEscape(ordinal(hPct)),
        csvEscape(head),
        csvEscape(ordinal(cPct))
      ].join(','));
    });

    rows.push('');

    // Vaccines section
    rows.push(csvEscape('Vaccines'));
    rows.push([csvEscape('Vaccine'), csvEscape('Dose'), csvEscape('Date Given')].join(','));

    vaccines.forEach(function (v) {
      rows.push([
        csvEscape(v.vaccineName),
        csvEscape(v.doseNumber),
        csvEscape(v.dateGiven)
      ].join(','));
    });

    var csv = rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var filename = 'healthy_human_' + (child.name || 'export').replace(/\s+/g, '_').toLowerCase() + '_' + todayISO() + '.csv';
    downloadBlob(blob, filename);
  }

  // ─────────────────── Chart PDF ───────────────────

  function generateChartImage(childData, metric, sex, childDob, units) {
    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = 800;
    tempCanvas.height = 450;

    var config = GrowthChart.buildConfig(childData, metric, sex, childDob, units);
    config.options.responsive = false;
    config.options.animation = false;
    config.options.maintainAspectRatio = false;

    var tempChart = new Chart(tempCanvas, config);
    var dataUrl = tempChart.toBase64Image('image/png', 1);
    tempChart.destroy();
    return dataUrl;
  }

  function exportPDF(childData, child, units) {
    if (typeof window.jspdf === 'undefined') {
      console.error('jsPDF library not loaded.');
      alert('PDF generation library is still loading. Please try again in a moment.');
      return;
    }

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF('l', 'mm', 'a4'); // landscape A4: 297mm x 210mm

    var sex = child.sex || 'female';
    var dob = child.dob;
    var ageM = ageInMonths(dob, todayISO());
    var hMetric = ageM != null && ageM >= 24 ? 'stature_for_age' : 'length_for_age';

    var hasHeadCirc = (ageM != null && ageM < 36) || (childData.measurements && childData.measurements.some(function (m) { return m.head_cm != null; }));

    // Generate chart images in memory
    var weightImg = generateChartImage(childData, 'weight_for_age', sex, dob, units);
    var heightImg = generateChartImage(childData, hMetric, sex, dob, units);
    var headImg = hasHeadCirc ? generateChartImage(childData, 'head_circumference_for_age', sex, dob, units) : null;

    var details = 'Child: ' + child.name + '   |   DOB: ' + dob + '   |   Sex: ' + (sex.charAt(0).toUpperCase() + sex.slice(1)) + '   |   Age: ' + formatAge(ageM);

    // --- Page 1: Weight Chart ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(28, 43, 51);
    doc.text('Healthy Human — Pediatric Growth Report', 15, 18);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 110, 115);
    doc.text(details, 15, 25);

    doc.addImage(weightImg, 'PNG', 15, 30, 267, 160);

    // --- Page 2: Length/Height Chart ---
    doc.addPage('l', 'mm', 'a4');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(28, 43, 51);
    doc.text('Healthy Human — Pediatric Growth Report', 15, 18);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 110, 115);
    doc.text(details, 15, 25);

    doc.addImage(heightImg, 'PNG', 15, 30, 267, 160);

    // --- Page 3: Head Circumference Chart (if applicable) ---
    if (headImg) {
      doc.addPage('l', 'mm', 'a4');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(28, 43, 51);
      doc.text('Healthy Human — Pediatric Growth Report', 15, 18);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(100, 110, 115);
      doc.text(details, 15, 25);

      doc.addImage(headImg, 'PNG', 15, 30, 267, 160);
    }

    var filename = 'healthy_human_' + (child.name || 'report').replace(/\s+/g, '_').toLowerCase() + '_growth_report_' + todayISO() + '.pdf';
    doc.save(filename);
  }

  // ─────────────────── JSON Backup ───────────────────

  function exportJSON(childData, child) {
    var payload = {
      exportFormat: 'healthy_human_backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      child: child,
      measurements: childData.measurements || [],
      vaccines: childData.vaccines || [],
      checkups: childData.checkups || []
    };

    var json = JSON.stringify(payload, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var filename = 'healthy_human_' + (child.name || 'backup').replace(/\s+/g, '_').toLowerCase() + '_backup_' + todayISO() + '.json';
    downloadBlob(blob, filename);
  }

  return {
    exportCSV: exportCSV,
    exportPDF: exportPDF,
    exportJSON: exportJSON
  };
})();
