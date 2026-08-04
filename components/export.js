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

  // ─────────────────── Chart PDF ───────────────────

  function generateChartImage(childData, metric, sex, childDob, units) {
    try {
      var tempCanvas = document.createElement('canvas');
      tempCanvas.width = 800;
      tempCanvas.height = 450;
      tempCanvas.style.position = 'absolute';
      tempCanvas.style.left = '-9999px';
      tempCanvas.style.top = '-9999px';
      document.body.appendChild(tempCanvas);

      var config = GrowthChart.buildConfig(childData, metric, sex, childDob, units);
      config.options.responsive = false;
      config.options.animation = false;
      config.options.maintainAspectRatio = false;

      var tempChart = new Chart(tempCanvas, config);
      var dataUrl = tempChart.toBase64Image('image/png', 1);
      tempChart.destroy();
      if (tempCanvas.parentNode) {
        tempCanvas.parentNode.removeChild(tempCanvas);
      }
      return dataUrl;
    } catch (e) {
      console.warn('generateChartImage failed for metric:', metric, e);
      return null;
    }
  }

  function exportPDF(childData, child, units) {
    var jsPDFConstructor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || (window.jspdf && window.jspdf.default ? window.jspdf.default.jsPDF : null);

    if (!jsPDFConstructor) {
      console.error('jsPDF library not loaded.');
      alert('PDF generation library is still loading or blocked. Please refresh the page and try again.');
      return;
    }

    var doc = new jsPDFConstructor('l', 'mm', 'a4'); // landscape A4: 297mm x 210mm

    var sex = child.sex || 'female';
    var dob = child.dob || todayISO();
    var ageM = ageInMonths(dob, todayISO()) || 0;
    var hMetric = ageM >= 24 ? 'stature_for_age' : 'length_for_age';

    var hasHeadCirc = ageM < 36 || (childData.measurements && childData.measurements.some(function (m) { return m.head_cm != null; }));

    // Generate chart images in memory safely
    var weightImg = generateChartImage(childData, 'weight_for_age', sex, dob, units);
    var heightImg = generateChartImage(childData, hMetric, sex, dob, units);
    var headImg = hasHeadCirc ? generateChartImage(childData, 'head_circumference_for_age', sex, dob, units) : null;

    var details = 'Child: ' + (child.name || 'Child') + '   |   DOB: ' + dob + '   |   Sex: ' + (sex.charAt(0).toUpperCase() + sex.slice(1)) + '   |   Age: ' + formatAge(ageM);

    // --- Page 1: Weight Chart ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(28, 43, 51);
    doc.text('Healthy Human — Pediatric Growth Report (Weight)', 15, 18);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 110, 115);
    doc.text(details, 15, 25);

    if (weightImg) {
      try {
        doc.addImage(weightImg, 'PNG', 15, 30, 267, 160);
      } catch (e) {
        doc.text('Weight Growth Data Summary: ' + (childData.measurements ? childData.measurements.length : 0) + ' recorded checkups.', 15, 45);
      }
    } else {
      doc.text('Weight Growth Data Summary: ' + (childData.measurements ? childData.measurements.length : 0) + ' recorded checkups.', 15, 45);
    }

    // --- Page 2: Length/Height Chart ---
    doc.addPage('l', 'mm', 'a4');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(28, 43, 51);
    doc.text('Healthy Human — Pediatric Growth Report (Height)', 15, 18);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 110, 115);
    doc.text(details, 15, 25);

    if (heightImg) {
      try {
        doc.addImage(heightImg, 'PNG', 15, 30, 267, 160);
      } catch (e) {
        doc.text('Length/Height Growth Data Summary', 15, 45);
      }
    } else {
      doc.text('Length/Height Growth Data Summary', 15, 45);
    }

    // --- Page 3: Head Circumference Chart (if applicable) ---
    if (headImg) {
      doc.addPage('l', 'mm', 'a4');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(28, 43, 51);
      doc.text('Healthy Human — Pediatric Growth Report (Head Circ.)', 15, 18);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(100, 110, 115);
      doc.text(details, 15, 25);

      try {
        doc.addImage(headImg, 'PNG', 15, 30, 267, 160);
      } catch (e) {
        doc.text('Head Circumference Data Summary', 15, 45);
      }
    }

    var filename = 'healthy_human_' + (child.name || 'report').replace(/\s+/g, '_').toLowerCase() + '_growth_report_' + todayISO() + '.pdf';
    doc.save(filename);
  }

  // ─────────────────── EHR Clinical Record (FHIR R4) ───────────────────

  function exportEHR(childData, child) {
    var sex = (child.sex || 'female').toLowerCase();
    var fhirGender = sex === 'male' ? 'male' : sex === 'female' ? 'female' : 'unknown';
    var patientRef = 'Patient/' + (child.id || 'patient-1');

    var entries = [];

    // Patient Resource
    entries.push({
      fullUrl: 'urn:uuid:' + (child.id || 'patient-1'),
      resource: {
        resourceType: 'Patient',
        id: child.id || 'patient-1',
        active: true,
        name: [
          {
            use: 'official',
            text: child.name,
            given: [child.name]
          }
        ],
        gender: fhirGender,
        birthDate: child.dob
      }
    });

    // Measurements -> Observation Resources (LOINC coded)
    var measurements = childData.measurements || [];
    measurements.forEach(function (m, idx) {
      var obsId = 'obs-' + (m.id || idx);

      // Weight (LOINC 29463-7)
      if (m.weight_kg != null) {
        entries.push({
          fullUrl: 'urn:uuid:' + obsId + '-weight',
          resource: {
            resourceType: 'Observation',
            id: obsId + '-weight',
            status: 'final',
            category: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs'
              }]
            }],
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '29463-7',
                display: 'Body weight'
              }],
              text: 'Weight'
            },
            subject: { reference: patientRef, display: child.name },
            effectiveDateTime: m.date,
            valueQuantity: {
              value: Number(m.weight_kg.toFixed(2)),
              unit: 'kg',
              system: 'http://unitsofmeasure.org',
              code: 'kg'
            }
          }
        });
      }

      // Height / Length (LOINC 8302-2)
      if (m.height_cm != null) {
        entries.push({
          fullUrl: 'urn:uuid:' + obsId + '-height',
          resource: {
            resourceType: 'Observation',
            id: obsId + '-height',
            status: 'final',
            category: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs'
              }]
            }],
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8302-2',
                display: 'Body height'
              }],
              text: 'Body height / length'
            },
            subject: { reference: patientRef, display: child.name },
            effectiveDateTime: m.date,
            valueQuantity: {
              value: Number(m.height_cm.toFixed(1)),
              unit: 'cm',
              system: 'http://unitsofmeasure.org',
              code: 'cm'
            }
          }
        });
      }

      // Head Circumference (LOINC 8287-5)
      if (m.head_cm != null) {
        entries.push({
          fullUrl: 'urn:uuid:' + obsId + '-head',
          resource: {
            resourceType: 'Observation',
            id: obsId + '-head',
            status: 'final',
            category: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs'
              }]
            }],
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8287-5',
                display: 'Head Occipital-frontal circumference'
              }],
              text: 'Head Circumference'
            },
            subject: { reference: patientRef, display: child.name },
            effectiveDateTime: m.date,
            valueQuantity: {
              value: Number(m.head_cm.toFixed(1)),
              unit: 'cm',
              system: 'http://unitsofmeasure.org',
              code: 'cm'
            }
          }
        });
      }
    });

    // Vaccines -> Immunization Resources
    var vaccines = childData.vaccines || [];
    vaccines.forEach(function (v, idx) {
      entries.push({
        fullUrl: 'urn:uuid:imm-' + (v.id || idx),
        resource: {
          resourceType: 'Immunization',
          id: 'imm-' + (v.id || idx),
          status: 'completed',
          vaccineCode: {
            text: v.vaccineName + ' (Dose ' + v.doseNumber + ')'
          },
          patient: { reference: patientRef, display: child.name },
          occurrenceDateTime: v.dateGiven
        }
      });
    });

    var bundle = {
      resourceType: 'Bundle',
      id: 'healthy-human-fhir-' + (child.name || 'patient').toLowerCase().replace(/\s+/g, '-'),
      meta: {
        lastUpdated: new Date().toISOString(),
        source: 'Healthy Human Pediatric Health Tracker',
        profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
        ehrCompatibility: ['Epic Systems', 'Oracle Cerner', 'Meditech Expanse', 'HL7 FHIR R4 Standard']
      },
      type: 'collection',
      entry: entries
    };

    var jsonStr = JSON.stringify(bundle, null, 2);
    var blob = new Blob([jsonStr], { type: 'application/fhir+json;charset=utf-8;' });
    var filename = 'healthy_human_fhir_r4_' + (child.name || 'patient').replace(/\s+/g, '_').toLowerCase() + '_' + todayISO() + '.json';
    downloadBlob(blob, filename);
  }

  return {
    exportCSV: exportCSV,
    exportPDF: exportPDF,
    exportJSON: exportJSON,
    exportEHR: exportEHR
  };
})();
