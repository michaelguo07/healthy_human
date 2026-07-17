/**
 * ChildManager — localStorage-backed data layer for Healthy Human.
 *
 * All measurements are stored internally as metric (kg / cm).
 * Conversions to imperial happen only at the display layer.
 *
 * localStorage key: 'healthy_human_children'
 */
window.ChildManager = (function () {
  'use strict';

  var STORAGE_KEY = 'healthy_human_children';

  // ───────────────────────── helpers ─────────────────────────

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function now() {
    return new Date().toISOString();
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('ChildManager: could not parse localStorage', e);
    }
    return createEmptyStore();
  }

  function save(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      console.error('ChildManager: could not write localStorage', e);
    }
  }

  function createEmptyStore() {
    return {
      children: [],
      activeChildId: null,
      measurements: {},
      vaccines: {},
      checkups: {},
      settings: { units: 'imperial' }
    };
  }

  // ───────────────────────── public API ─────────────────────────

  function getChildren() {
    return load().children || [];
  }

  function getActiveChild() {
    var store = load();
    if (!store.activeChildId && store.children.length > 0) {
      store.activeChildId = store.children[0].id;
      save(store);
    }
    if (!store.activeChildId) return null;
    return store.children.find(function (c) { return c.id === store.activeChildId; }) || null;
  }

  function setActiveChild(childId) {
    var store = load();
    var exists = store.children.some(function (c) { return c.id === childId; });
    if (!exists) return;
    store.activeChildId = childId;
    save(store);
  }

  function addChild(opts) {
    if (!opts || !opts.name || !opts.sex || !opts.dob) {
      throw new Error('addChild requires name, sex, and dob');
    }
    var store = load();
    var child = {
      id: generateId(),
      name: opts.name.trim(),
      sex: opts.sex.toLowerCase() === 'male' ? 'male' : 'female',
      dob: opts.dob,
      createdAt: now()
    };
    store.children.push(child);
    store.measurements[child.id] = [];
    store.vaccines[child.id] = [];
    store.checkups[child.id] = [];
    // Auto-activate if first child
    if (store.children.length === 1) {
      store.activeChildId = child.id;
    }
    save(store);
    return child;
  }

  function removeChild(childId) {
    var store = load();
    store.children = store.children.filter(function (c) { return c.id !== childId; });
    delete store.measurements[childId];
    delete store.vaccines[childId];
    delete store.checkups[childId];
    if (store.activeChildId === childId) {
      store.activeChildId = store.children.length > 0 ? store.children[0].id : null;
    }
    save(store);
  }

  function updateChild(childId, updates) {
    var store = load();
    var child = store.children.find(function (c) { return c.id === childId; });
    if (!child) return null;
    if (updates.name !== undefined) child.name = updates.name.trim();
    if (updates.sex !== undefined) child.sex = updates.sex;
    if (updates.dob !== undefined) child.dob = updates.dob;
    save(store);
    return child;
  }

  function getChildData(childId) {
    var store = load();
    var measurements = (store.measurements[childId] || []).slice();
    // Sort measurements by date ascending
    measurements.sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
    return {
      measurements: measurements,
      vaccines: (store.vaccines[childId] || []).slice(),
      checkups: (store.checkups[childId] || []).slice()
    };
  }

  function saveMeasurement(childId, measurement) {
    var store = load();
    if (!store.measurements[childId]) store.measurements[childId] = [];
    var record = {
      id: generateId(),
      date: measurement.date,
      weight_kg: measurement.weight_kg != null ? Number(measurement.weight_kg) : null,
      height_cm: measurement.height_cm != null ? Number(measurement.height_cm) : null,
      head_cm: measurement.head_cm != null ? Number(measurement.head_cm) : null,
      createdAt: now()
    };
    store.measurements[childId].push(record);
    save(store);
    return record;
  }

  function deleteMeasurement(childId, measurementId) {
    var store = load();
    if (!store.measurements[childId]) return;
    store.measurements[childId] = store.measurements[childId].filter(function (m) {
      return m.id !== measurementId;
    });
    save(store);
  }

  function updateMeasurement(childId, measurementId, measurement) {
    var store = load();
    if (!store.measurements[childId]) return;
    var list = store.measurements[childId];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === measurementId) {
        list[i].date = measurement.date;
        list[i].weight_kg = measurement.weight_kg != null ? Number(measurement.weight_kg) : null;
        list[i].height_cm = measurement.height_cm != null ? Number(measurement.height_cm) : null;
        list[i].head_cm = measurement.head_cm != null ? Number(measurement.head_cm) : null;
        list[i].updatedAt = now();
        break;
      }
    }
    save(store);
  }

  function saveVaccine(childId, vaccine) {
    var store = load();
    if (!store.vaccines[childId]) store.vaccines[childId] = [];
    var record = {
      id: generateId(),
      vaccineName: vaccine.vaccineName,
      doseNumber: Number(vaccine.doseNumber),
      dateGiven: vaccine.dateGiven,
      createdAt: now()
    };
    store.vaccines[childId].push(record);
    save(store);
    return record;
  }

  function deleteVaccine(childId, vaccineId) {
    var store = load();
    if (!store.vaccines[childId]) return;
    store.vaccines[childId] = store.vaccines[childId].filter(function (v) {
      return v.id !== vaccineId;
    });
    save(store);
  }

  function saveCheckup(childId, checkup) {
    var store = load();
    if (!store.checkups[childId]) store.checkups[childId] = [];
    var record = {
      id: generateId(),
      visitLabel: checkup.visitLabel,
      date: checkup.date,
      notes: checkup.notes || '',
      createdAt: now()
    };
    store.checkups[childId].push(record);
    save(store);
    return record;
  }

  function deleteCheckup(childId, checkupId) {
    var store = load();
    if (!store.checkups[childId]) return;
    store.checkups[childId] = store.checkups[childId].filter(function (c) {
      return c.id !== checkupId;
    });
    save(store);
  }

  function exportAllData(childId) {
    var store = load();
    var child = store.children.find(function (c) { return c.id === childId; });
    if (!child) return null;
    return {
      child: Object.assign({}, child),
      measurements: (store.measurements[childId] || []).slice(),
      vaccines: (store.vaccines[childId] || []).slice(),
      checkups: (store.checkups[childId] || []).slice(),
      exportedAt: now()
    };
  }

  function importChildData(payload) {
    if (!payload || payload.exportFormat !== 'healthy_human_backup' || !payload.child) {
      throw new Error('Invalid backup file format.');
    }

    var store = load();
    var child = payload.child;
    var childId = child.id;

    if (!childId) {
      childId = generateId();
      child.id = childId;
    }

    var existingIndex = store.children.findIndex(function (c) { return c.id === childId; });
    if (existingIndex !== -1) {
      store.children[existingIndex] = child;
    } else {
      store.children.push(child);
    }

    store.measurements[childId] = payload.measurements || [];
    store.vaccines[childId] = payload.vaccines || [];
    store.checkups[childId] = payload.checkups || [];
    store.activeChildId = childId;

    save(store);
    return child;
  }

  // ───────────────── settings helpers ─────────────────

  function getSettings() {
    return load().settings || { units: 'imperial' };
  }

  function saveSettings(settings) {
    var store = load();
    store.settings = Object.assign(store.settings || {}, settings);
    save(store);
  }

  // ───────────────── expose ─────────────────

  return {
    getChildren: getChildren,
    getActiveChild: getActiveChild,
    setActiveChild: setActiveChild,
    addChild: addChild,
    removeChild: removeChild,
    updateChild: updateChild,
    getChildData: getChildData,
    saveMeasurement: saveMeasurement,
    deleteMeasurement: deleteMeasurement,
    updateMeasurement: updateMeasurement,
    saveVaccine: saveVaccine,
    deleteVaccine: deleteVaccine,
    saveCheckup: saveCheckup,
    deleteCheckup: deleteCheckup,
    exportAllData: exportAllData,
    importChildData: importChildData,
    getSettings: getSettings,
    saveSettings: saveSettings
  };
})();
