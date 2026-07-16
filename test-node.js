// Node.js test runner for Healthy Human data & calc files
// Simulates browser globals (window) so the files can be loaded.

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var window = {};
var context = vm.createContext({ window: window, Math: Math, console: console, Date: Date, Array: Array, Infinity: Infinity, Error: Error });

var base = __dirname;
var files = [
  'data/who-lms.js',
  'data/cdc-lms.js',
  'data/vaccines.js',
  'calc/growth.js',
  'calc/vaccines.js'
];

// Load all files
for (var i = 0; i < files.length; i++) {
  var fp = path.join(base, files[i]);
  var code = fs.readFileSync(fp, 'utf8');
  try {
    vm.runInContext(code, context, { filename: files[i] });
    console.log('Loaded: ' + files[i]);
  } catch (e) {
    console.error('ERROR loading ' + files[i] + ': ' + e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

console.log('');

var pass = 0, fail = 0;
function assert(label, cond) {
  if (cond) { pass++; console.log('  OK: ' + label); }
  else      { fail++; console.log('  FAIL: ' + label); }
}
function approx(a, b, tol) { return Math.abs(a - b) < (tol || 0.01); }

var WHO = window.WHO_LMS;
var CDC = window.CDC_LMS;
var GC  = window.GrowthCalc;
var VC  = window.VaccineCalc;
var VS  = window.VACCINE_SCHEDULE;
var WCV = window.WELL_CHILD_VISITS;

// === WHO ===
console.log('\n=== WHO LMS ===');
assert('WHO exists', !!WHO);
assert('weight male 25 entries', WHO.weight_for_age.male.length === 25);
assert('length female 25 entries', WHO.length_for_age.female.length === 25);
assert('HC male 25 entries', WHO.head_circumference_for_age.male.length === 25);
assert('Boy weight m0 M=3.3464', approx(WHO.weight_for_age.male[0].M, 3.3464));
assert('Girl weight m24 M=11.4775', approx(WHO.weight_for_age.female[24].M, 11.4775));
assert('Boy length m12 M=75.7488', approx(WHO.length_for_age.male[12].M, 75.7488));

// === CDC ===
console.log('\n=== CDC LMS ===');
assert('CDC exists', !!CDC);
var cdcWM = CDC.weight_for_age.male;
assert('CDC weight male >200 entries', cdcWM.length > 200);
console.log('  CDC weight male entries: ' + cdcWM.length);
console.log('  CDC weight male range: month ' + cdcWM[0].month + ' to ' + cdcWM[cdcWM.length-1].month);
assert('CDC starts at month 25', cdcWM[0].month === 25);
assert('CDC ends at month 240', cdcWM[cdcWM.length-1].month === 240);

// === Growth Calc ===
console.log('\n=== GrowthCalc ===');
assert('GrowthCalc exists', !!GC);

// Z-score at median = 0
var z = GC.calculateZScore(3.3464, 0.3487, 3.3464, 0.14602);
assert('z-score at median = 0', approx(z, 0, 0.001));

// Z-score for L=1 case (length)
var zLen = GC.calculateZScore(49.8842, 1, 49.8842, 0.03795);
assert('z-score length at median = 0', approx(zLen, 0, 0.001));

// Percentile conversions
assert('percentile(z=0) = 50', approx(GC.zToPercentile(0), 50, 0.1));
assert('percentile(z=1) ≈ 84.13', approx(GC.zToPercentile(1), 84.13, 0.5));
assert('percentile(z=-2) ≈ 2.28', approx(GC.zToPercentile(-2), 2.28, 0.5));

assert('percentileToZ(50) ≈ 0', approx(GC.percentileToZ(50), 0, 0.01));
assert('percentileToZ(84.13) ≈ 1', approx(GC.percentileToZ(84.13), 1, 0.05));

// LMS lookup
var lms0 = GC.lookupLMS('weight', 'male', 0);
assert('lookupLMS weight male 0: M=3.3464', lms0 && approx(lms0.M, 3.3464));

var lms12 = GC.lookupLMS('length', 'female', 12);
assert('lookupLMS length female 12: M=74.0153', lms12 && approx(lms12.M, 74.0153));

// Interpolation test
var lms6_5 = GC.lookupLMS('weight', 'male', 6.5);
assert('lookupLMS weight male 6.5 interpolated', lms6_5 && lms6_5.M > 7.93 && lms6_5.M < 8.30);

// CDC range lookup
var lms120 = GC.lookupLMS('weight', 'male', 120);
assert('lookupLMS weight male 120 (CDC): has result', !!lms120);
if (lms120) console.log('  CDC weight male 120mo: M=' + lms120.M.toFixed(2));

// Age calculation
var age = GC.calculateAge('2025-01-15', '2026-07-15');
assert('Age months = 18', age.months === 18);

// Trends
assert('Trend stable', GC.calculateTrend(52, 50) === 'stable');
assert('Trend up', GC.calculateTrend(60, 50) === 'up');
assert('Trend sharp_up', GC.calculateTrend(80, 50) === 'sharp_up');
assert('Trend down', GC.calculateTrend(40, 50) === 'down');
assert('Trend sharp_down', GC.calculateTrend(20, 50) === 'sharp_down');

// selectDataSource
assert('source <24 = WHO', GC.selectDataSource(12) === 'WHO');
assert('source >=24 = CDC', GC.selectDataSource(24) === 'CDC');

// getMeasurementFromPercentile round-trip
var mFromZ = GC.getMeasurementFromPercentile('weight', 'male', 0, 0);
assert('Measurement at z=0 m0 ≈ 3.3464', approx(mFromZ, 3.3464, 0.01));

// Percentile bands
var bands = GC.getPercentileBands('weight', 'male', 0, 24, 6);
assert('Bands p50 has entries', bands.p50.length > 0);
assert('p3 < p50 < p97', bands.p3[0].value < bands.p50[0].value && bands.p50[0].value < bands.p97[0].value);

// === Vaccine Schedule ===
console.log('\n=== Vaccine Schedule ===');
assert('VACCINE_SCHEDULE exists', !!VS);
assert('14 vaccines', VS.length === 14);
assert('WELL_CHILD_VISITS exists', !!WCV);
assert('30 visits', WCV.length === 30);

// === VaccineCalc ===
console.log('\n=== VaccineCalc ===');
assert('VaccineCalc exists', !!VC);

var statuses = VC.calculateVaccineStatus('2026-01-15', [], '2026-07-15');
assert('Status is array', Array.isArray(statuses));
assert('Has entries', statuses.length > 0);

var hb1 = statuses.find(function(s){ return s.vaccineId === 'HepB' && s.doseNumber === 1; });
assert('HepB1 overdue at 6mo', hb1 && hb1.status === 'overdue');

var overdue = VC.getOverdueVaccines('2026-01-15', [], '2026-07-15');
assert('Overdue count > 0', overdue.overdueCount > 0);
console.log('  Overdue: ' + overdue.overdueCount + ', Due: ' + overdue.dueCount + ', Upcoming: ' + overdue.upcomingCount);

var next = VC.getNextCheckup('2026-01-15', [], '2026-07-15');
assert('Next checkup exists', !!next);
console.log('  Next checkup: ' + (next ? next.label : 'none'));

// === Summary ===
console.log('\n════════════════════════════');
console.log('TOTAL: ' + pass + ' passed, ' + fail + ' failed');
console.log('════════════════════════════');

process.exit(fail > 0 ? 1 : 0);
