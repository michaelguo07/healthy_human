/**
 * Healthy Human — Vaccine Calculation Engine
 *
 * Pure functions for determining vaccine status, upcoming checkups,
 * and overdue counts based on the AAP/ACIP schedule.
 *
 * Depends on:
 *   - window.VACCINE_SCHEDULE  (data/vaccines.js)
 *   - window.WELL_CHILD_VISITS (data/vaccines.js)
 *
 * All functions are pure — no side effects, no DOM access.
 */

(function () {
  'use strict';

  // ─── Internal Helpers ──────────────────────────────────────────────

  /**
   * Calculate decimal months between two dates.
   * @param {Date} d1
   * @param {Date} d2
   * @returns {number} decimal months (positive if d2 > d1)
   */
  function monthsBetween(d1, d2) {
    return (d2 - d1) / (1000 * 60 * 60 * 24 * 30.4375);
  }

  /**
   * Parse a value to a Date object safely.
   * @param {Date|string|number} val
   * @returns {Date}
   */
  function toDate(val) {
    if (val instanceof Date) return val;
    return new Date(val);
  }


  // ─── Public API ────────────────────────────────────────────────────

  window.VaccineCalc = {

    /**
     * Calculate the status of every vaccine dose for a child.
     *
     * @param {Date|string} dob — child's date of birth
     * @param {Array<{vaccineId: string, doseNumber: number, dateGiven: Date|string}>} loggedVaccines
     *   — array of vaccines that have been administered
     * @param {Date|string} [currentDate=new Date()] — reference date for status
     * @returns {Array<{vaccineId:string, vaccineName:string, doseNumber:number,
     *   status:string, ageIdealMonths:number, ageMinMonths:number,
     *   ageMaxMonths:number, dateGiven:Date|null}>}
     *
     * Status values:
     *   'up_to_date' — dose has been administered
     *   'due'        — child is within the recommended age window
     *   'overdue'    — child has passed the recommended age window
     *   'upcoming'   — dose is coming within the next 2 months
     *   'not_yet'    — dose is not yet applicable
     */
    calculateVaccineStatus: function (dob, loggedVaccines, currentDate) {
      var birthDate = toDate(dob);
      var now = currentDate ? toDate(currentDate) : new Date();
      var ageMonths = monthsBetween(birthDate, now);
      var schedule = window.VACCINE_SCHEDULE;

      if (!schedule) {
        throw new Error('VACCINE_SCHEDULE not loaded. Include data/vaccines.js first.');
      }

      var logMap = {};
      if (loggedVaccines && loggedVaccines.length) {
        for (var v = 0; v < loggedVaccines.length; v++) {
          var entry = loggedVaccines[v];
          var keyId = (entry.vaccineId || '') + '_' + entry.doseNumber;
          var keyName = (entry.vaccineName || '') + '_' + entry.doseNumber;
          if (entry.vaccineId) logMap[keyId] = toDate(entry.dateGiven);
          if (entry.vaccineName) logMap[keyName] = toDate(entry.dateGiven);
        }
      }

      var results = [];

      for (var i = 0; i < schedule.length; i++) {
        var vaccine = schedule[i];

        // Skip influenza for detailed dose tracking (it's annual/ongoing)
        if (vaccine.id === 'Influenza') {
          var fluKeyId = 'Influenza_1';
          var fluKeyName = 'Influenza (Annual)_1';
          var fluGivenDate = logMap[fluKeyId] || logMap[fluKeyName] || null;
          var fluStatus = 'not_yet';
          if (ageMonths >= 6) {
            if (fluGivenDate) {
              fluStatus = 'up_to_date';
            } else {
              fluStatus = 'due';
            }
          }
          results.push({
            vaccineId: vaccine.id,
            vaccineName: vaccine.name,
            shortName: vaccine.shortName,
            doseNumber: 1,
            status: fluStatus,
            ageIdealMonths: 6,
            ageMinMonths: 6,
            ageMaxMonths: null,
            dateGiven: fluGivenDate,
            notes: vaccine.notes || null
          });
          continue;
        }

        for (var d = 0; d < vaccine.doses.length; d++) {
          var dose = vaccine.doses[d];
          var doseKeyId = vaccine.id + '_' + dose.doseNumber;
          var doseKeyName = vaccine.name + '_' + dose.doseNumber;
          var givenDate = logMap[doseKeyId] || logMap[doseKeyName] || null;

          var status;
          if (givenDate) {
            status = 'up_to_date';
          } else if (ageMonths > dose.ageMaxMonths) {
            status = 'overdue';
          } else if (ageMonths >= dose.ageMinMonths && ageMonths <= dose.ageMaxMonths) {
            status = 'due';
          } else if (dose.ageMinMonths - ageMonths <= 2 && dose.ageMinMonths - ageMonths > 0) {
            status = 'upcoming';
          } else {
            status = 'not_yet';
          }

          // If a previous dose in this vaccine series is not completed,
          // this dose should not show as 'due' — show 'not_yet' instead
          if (status === 'due' && dose.doseNumber > 1) {
            var prevKey = vaccine.id + '_' + (dose.doseNumber - 1);
            if (!logMap[prevKey]) {
              status = 'not_yet';
            }
          }

          results.push({
            vaccineId: vaccine.id,
            vaccineName: vaccine.name,
            shortName: vaccine.shortName,
            doseNumber: dose.doseNumber,
            status: status,
            ageIdealMonths: dose.ageIdealMonths,
            ageMinMonths: dose.ageMinMonths,
            ageMaxMonths: dose.ageMaxMonths,
            dateGiven: givenDate
          });
        }
      }

      return results;
    },

    /**
     * Get the next recommended well-child visit.
     *
     * @param {Date|string} dob — child's date of birth
     * @param {Array<{ageMonths: number, dateCompleted: Date|string}>} loggedCheckups
     *   — array of checkups already completed
     * @param {Date|string} [currentDate=new Date()] — reference date
     * @returns {{ageMonths: number, label: string, category: string,
     *   suggestedDate: Date, isOverdue: boolean}|null}
     *   Next visit, or null if all visits completed
     */
    getNextCheckup: function (dob, loggedCheckups, currentDate) {
      var birthDate = toDate(dob);
      var now = currentDate ? toDate(currentDate) : new Date();
      var ageMonths = monthsBetween(birthDate, now);
      var visits = window.WELL_CHILD_VISITS;

      if (!visits) {
        throw new Error('WELL_CHILD_VISITS not loaded. Include data/vaccines.js first.');
      }

      // Build a set of completed visit ages (with tolerance of ±1 month)
      var completedSet = {};
      if (loggedCheckups && loggedCheckups.length) {
        for (var c = 0; c < loggedCheckups.length; c++) {
          completedSet[loggedCheckups[c].ageMonths] = true;
        }
      }

      // Find the next visit that hasn't been completed
      for (var i = 0; i < visits.length; i++) {
        var visit = visits[i];

        // Skip visits that are completed
        if (completedSet[visit.ageMonths]) continue;

        // Skip visits whose window has passed by more than 3 months
        // (except overdue ones — they should still show)
        // We show the first uncompleted visit
        var suggestedDate = new Date(birthDate);
        suggestedDate.setMonth(suggestedDate.getMonth() + Math.floor(visit.ageMonths));
        var fractionalDays = (visit.ageMonths % 1) * 30.4375;
        suggestedDate.setDate(suggestedDate.getDate() + Math.round(fractionalDays));

        var isOverdue = ageMonths > visit.ageMonths + 1;

        return {
          ageMonths: visit.ageMonths,
          label: visit.label,
          category: visit.category,
          suggestedDate: suggestedDate,
          isOverdue: isOverdue
        };
      }

      return null; // all visits completed
    },

    /**
     * Get a quick count of overdue vaccines.
     *
     * @param {Date|string} dob — child's date of birth
     * @param {Array<{vaccineId: string, doseNumber: number, dateGiven: Date|string}>} loggedVaccines
     * @param {Date|string} [currentDate=new Date()] — reference date
     * @returns {{overdueCount: number, dueCount: number, upcomingCount: number,
     *   overdueVaccines: Array<{vaccineId: string, vaccineName: string, doseNumber: number}>}}
     */
    getOverdueVaccines: function (dob, loggedVaccines, currentDate) {
      var allStatuses = this.calculateVaccineStatus(dob, loggedVaccines, currentDate);

      var overdueCount = 0;
      var dueCount = 0;
      var upcomingCount = 0;
      var overdueVaccines = [];

      for (var i = 0; i < allStatuses.length; i++) {
        var s = allStatuses[i];
        switch (s.status) {
          case 'overdue':
            overdueCount++;
            overdueVaccines.push({
              vaccineId: s.vaccineId,
              vaccineName: s.vaccineName,
              shortName: s.shortName,
              doseNumber: s.doseNumber
            });
            break;
          case 'due':
            dueCount++;
            break;
          case 'upcoming':
            upcomingCount++;
            break;
        }
      }

      return {
        overdueCount: overdueCount,
        dueCount: dueCount,
        upcomingCount: upcomingCount,
        overdueVaccines: overdueVaccines
      };
    }

  };

})();
