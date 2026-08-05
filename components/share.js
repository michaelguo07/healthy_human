/**
 * ShareManager — Zero-server profile sharing via URL parameters.
 *
 * Encodes child profile and records into a compact URL string (Base64).
 * Decodes incoming share URLs on load and imports them into local storage.
 */
window.ShareManager = (function () {
  'use strict';

  function encodeData(obj) {
    try {
      var jsonStr = JSON.stringify(obj);
      var utf8Bytes = encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, function (match, p1) {
        return String.fromCharCode('0x' + p1);
      });
      return btoa(utf8Bytes);
    } catch (e) {
      console.error('ShareManager: Error encoding data', e);
      return null;
    }
  }

  function decodeData(encodedStr) {
    try {
      var binaryStr = atob(encodedStr);
      var jsonStr = decodeURIComponent(Array.prototype.map.call(binaryStr, function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('ShareManager: Error decoding data', e);
      return null;
    }
  }

  function generateShareUrl(childId) {
    var children = ChildManager.getChildren();
    var child = children.find(function (c) { return c.id === childId; });
    if (!child) return null;

    var childData = ChildManager.getChildData(childId);
    var payload = {
      v: 1,
      child: {
        name: child.name,
        sex: child.sex,
        dob: child.dob
      },
      measurements: childData.measurements || [],
      vaccines: childData.vaccines || [],
      checkups: childData.checkups || []
    };

    var encoded = encodeData(payload);
    if (!encoded) return null;

    var baseUrl = window.location.origin + window.location.pathname;
    return baseUrl + '?share=' + encodeURIComponent(encoded);
  }

  function getIncomingPayload() {
    var params = new URLSearchParams(window.location.search);
    var rawShare = params.get('share') || params.get('import');
    if (!rawShare) return null;
    return decodeData(rawShare);
  }

  function importPayload(payload) {
    if (!payload || !payload.child || !payload.child.name) {
      throw new Error('Invalid share payload format.');
    }

    // Add child profile
    var importedChild = ChildManager.addChild({
      name: payload.child.name,
      sex: payload.child.sex,
      dob: payload.child.dob
    });

    var childId = importedChild.id;

    // Import measurements
    if (Array.isArray(payload.measurements)) {
      payload.measurements.forEach(function (m) {
        ChildManager.saveMeasurement(childId, {
          date: m.date,
          weight_kg: m.weight_kg,
          height_cm: m.height_cm,
          head_cm: m.head_cm
        });
      });
    }

    // Import vaccines
    if (Array.isArray(payload.vaccines)) {
      payload.vaccines.forEach(function (v) {
        ChildManager.recordVaccine(childId, v.vaccineId, v.doseId, v.dateGiven);
      });
    }

    // Import checkups
    if (Array.isArray(payload.checkups)) {
      payload.checkups.forEach(function (c) {
        ChildManager.saveCheckupLog(childId, c.visitId, c.notes, c.milestones);
      });
    }

    // Set as active child
    ChildManager.setActiveChild(childId);

    // Track analytics event
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'import_child_profile');
    }

    return importedChild;
  }

  function clearShareUrlParam() {
    if (window.history && window.history.replaceState) {
      var cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }

  return {
    generateShareUrl: generateShareUrl,
    getIncomingPayload: getIncomingPayload,
    importPayload: importPayload,
    clearShareUrlParam: clearShareUrlParam
  };
})();
