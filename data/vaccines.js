/**
 * AAP / ACIP Recommended Immunization Schedule & Well-Child Visits
 *
 * Sources:
 *   - Advisory Committee on Immunization Practices (ACIP),
 *     "Recommended Child and Adolescent Immunization Schedule," 2026.
 *     https://www.cdc.gov/vaccines/schedules/
 *   - American Academy of Pediatrics, "Bright Futures: Guidelines for
 *     Health Supervision of Infants, Children, and Adolescents," 4th ed.
 *     https://www.aap.org/en/practice-management/bright-futures/
 *
 * Age values are in months unless otherwise noted.
 * Each dose entry has:
 *   doseNumber  — ordinal dose in the series
 *   ageMinMonths — earliest recommended age
 *   ageMaxMonths — latest acceptable age (end of catch-up window)
 *   ageIdealMonths — ideal target age
 */

window.VACCINE_SCHEDULE = [

  // ── Hepatitis B (HepB) — 3-dose series ────────────────────────────
  {
    id: 'HepB',
    name: 'Hepatitis B',
    shortName: 'HepB',
    totalDoses: 3,
    doses: [
      { doseNumber: 1, ageIdealMonths: 0,   ageMinMonths: 0,   ageMaxMonths: 1   },
      { doseNumber: 2, ageIdealMonths: 1,   ageMinMonths: 1,   ageMaxMonths: 4   },
      { doseNumber: 3, ageIdealMonths: 6,   ageMinMonths: 6,   ageMaxMonths: 18  }
    ]
  },

  // ── Rotavirus (RV) — 3-dose series ────────────────────────────────
  {
    id: 'RV',
    name: 'Rotavirus',
    shortName: 'RV',
    totalDoses: 3,
    doses: [
      { doseNumber: 1, ageIdealMonths: 2,   ageMinMonths: 1.5, ageMaxMonths: 3.5 },
      { doseNumber: 2, ageIdealMonths: 4,   ageMinMonths: 3.5, ageMaxMonths: 5.5 },
      { doseNumber: 3, ageIdealMonths: 6,   ageMinMonths: 5.5, ageMaxMonths: 8   }
    ],
    notes: 'Maximum age for first dose is 14 weeks 6 days; series should not be started after 15 weeks 0 days. Maximum age for final dose is 8 months 0 days.'
  },

  // ── Diphtheria, Tetanus, Pertussis (DTaP) — 5-dose series ─────────
  {
    id: 'DTaP',
    name: 'Diphtheria, Tetanus & Pertussis',
    shortName: 'DTaP',
    totalDoses: 5,
    doses: [
      { doseNumber: 1, ageIdealMonths: 2,   ageMinMonths: 1.5, ageMaxMonths: 3.5 },
      { doseNumber: 2, ageIdealMonths: 4,   ageMinMonths: 3.5, ageMaxMonths: 5.5 },
      { doseNumber: 3, ageIdealMonths: 6,   ageMinMonths: 5.5, ageMaxMonths: 7.5 },
      { doseNumber: 4, ageIdealMonths: 16,  ageMinMonths: 15,  ageMaxMonths: 18  },
      { doseNumber: 5, ageIdealMonths: 54,  ageMinMonths: 48,  ageMaxMonths: 72  }
    ]
  },

  // ── Haemophilus influenzae type b (Hib) — 4-dose series ────────────
  {
    id: 'Hib',
    name: 'Haemophilus influenzae type b',
    shortName: 'Hib',
    totalDoses: 4,
    doses: [
      { doseNumber: 1, ageIdealMonths: 2,   ageMinMonths: 1.5, ageMaxMonths: 3.5 },
      { doseNumber: 2, ageIdealMonths: 4,   ageMinMonths: 3.5, ageMaxMonths: 5.5 },
      { doseNumber: 3, ageIdealMonths: 6,   ageMinMonths: 5.5, ageMaxMonths: 7.5 },
      { doseNumber: 4, ageIdealMonths: 13,  ageMinMonths: 12,  ageMaxMonths: 15  }
    ]
  },

  // ── Pneumococcal Conjugate (PCV15) — 4-dose series ─────────────────
  {
    id: 'PCV15',
    name: 'Pneumococcal Conjugate',
    shortName: 'PCV15',
    totalDoses: 4,
    doses: [
      { doseNumber: 1, ageIdealMonths: 2,   ageMinMonths: 1.5, ageMaxMonths: 3.5 },
      { doseNumber: 2, ageIdealMonths: 4,   ageMinMonths: 3.5, ageMaxMonths: 5.5 },
      { doseNumber: 3, ageIdealMonths: 6,   ageMinMonths: 5.5, ageMaxMonths: 7.5 },
      { doseNumber: 4, ageIdealMonths: 13,  ageMinMonths: 12,  ageMaxMonths: 15  }
    ]
  },

  // ── Inactivated Poliovirus (IPV) — 4-dose series ──────────────────
  {
    id: 'IPV',
    name: 'Inactivated Poliovirus',
    shortName: 'IPV',
    totalDoses: 4,
    doses: [
      { doseNumber: 1, ageIdealMonths: 2,   ageMinMonths: 1.5, ageMaxMonths: 3.5 },
      { doseNumber: 2, ageIdealMonths: 4,   ageMinMonths: 3.5, ageMaxMonths: 5.5 },
      { doseNumber: 3, ageIdealMonths: 9,   ageMinMonths: 6,   ageMaxMonths: 18  },
      { doseNumber: 4, ageIdealMonths: 54,  ageMinMonths: 48,  ageMaxMonths: 72  }
    ]
  },

  // ── Influenza — annual from 6 months ───────────────────────────────
  {
    id: 'Influenza',
    name: 'Influenza (Annual)',
    shortName: 'Flu',
    totalDoses: null, // annual, ongoing
    doses: [
      { doseNumber: 1, ageIdealMonths: 6,   ageMinMonths: 6,   ageMaxMonths: null }
    ],
    notes: 'Annual vaccination recommended starting at 6 months. Children 6 months through 8 years receiving influenza vaccine for the first time need 2 doses separated by ≥4 weeks.'
  },

  // ── Measles, Mumps, Rubella (MMR) — 2-dose series ─────────────────
  {
    id: 'MMR',
    name: 'Measles, Mumps & Rubella',
    shortName: 'MMR',
    totalDoses: 2,
    doses: [
      { doseNumber: 1, ageIdealMonths: 12,  ageMinMonths: 12,  ageMaxMonths: 15  },
      { doseNumber: 2, ageIdealMonths: 54,  ageMinMonths: 48,  ageMaxMonths: 72  }
    ]
  },

  // ── Varicella — 2-dose series ──────────────────────────────────────
  {
    id: 'Varicella',
    name: 'Varicella (Chickenpox)',
    shortName: 'VAR',
    totalDoses: 2,
    doses: [
      { doseNumber: 1, ageIdealMonths: 12,  ageMinMonths: 12,  ageMaxMonths: 15  },
      { doseNumber: 2, ageIdealMonths: 54,  ageMinMonths: 48,  ageMaxMonths: 72  }
    ]
  },

  // ── Hepatitis A (HepA) — 2-dose series ────────────────────────────
  {
    id: 'HepA',
    name: 'Hepatitis A',
    shortName: 'HepA',
    totalDoses: 2,
    doses: [
      { doseNumber: 1, ageIdealMonths: 12,  ageMinMonths: 12,  ageMaxMonths: 23  },
      { doseNumber: 2, ageIdealMonths: 18,  ageMinMonths: 18,  ageMaxMonths: 41  }
    ],
    notes: '2-dose series; second dose ≥6 months after first dose.'
  },

  // ── Tetanus, Diphtheria, Pertussis booster (Tdap) — 1 dose ────────
  {
    id: 'Tdap',
    name: 'Tetanus, Diphtheria & Pertussis Booster',
    shortName: 'Tdap',
    totalDoses: 1,
    doses: [
      { doseNumber: 1, ageIdealMonths: 132, ageMinMonths: 132, ageMaxMonths: 144 }
    ],
    notes: 'Administer at 11–12 years.'
  },

  // ── Human Papillomavirus (HPV) — 2-dose series ────────────────────
  {
    id: 'HPV',
    name: 'Human Papillomavirus',
    shortName: 'HPV',
    totalDoses: 2,
    doses: [
      { doseNumber: 1, ageIdealMonths: 132, ageMinMonths: 108, ageMaxMonths: 144 },
      { doseNumber: 2, ageIdealMonths: 138, ageMinMonths: 138, ageMaxMonths: 156 }
    ],
    notes: '2-dose series when started before age 15; 6–12 months between doses.'
  },

  // ── Meningococcal ACWY (MenACWY) — 2-dose series ──────────────────
  {
    id: 'MenACWY',
    name: 'Meningococcal ACWY',
    shortName: 'MenACWY',
    totalDoses: 2,
    doses: [
      { doseNumber: 1, ageIdealMonths: 132, ageMinMonths: 132, ageMaxMonths: 144 },
      { doseNumber: 2, ageIdealMonths: 192, ageMinMonths: 192, ageMaxMonths: 204 }
    ],
    notes: 'First dose at 11–12 years, booster at 16 years.'
  },

  // ── Meningococcal B (MenB) — 2-dose series ────────────────────────
  {
    id: 'MenB',
    name: 'Meningococcal B',
    shortName: 'MenB',
    totalDoses: 2,
    doses: [
      { doseNumber: 1, ageIdealMonths: 198, ageMinMonths: 192, ageMaxMonths: 216 },
      { doseNumber: 2, ageIdealMonths: 204, ageMinMonths: 198, ageMaxMonths: 276 }
    ],
    notes: 'Based on shared clinical decision-making (SCDM). Preferred at 16–18 years.'
  }

];


/**
 * AAP Bright Futures Well-Child Visit Schedule
 *
 * Each entry specifies the recommended age for a well-child visit.
 * ageMonths = recommended age in months
 * label     = human-readable label
 * category  = 'infant' | 'toddler' | 'child' | 'adolescent'
 */
window.WELL_CHILD_VISITS = [
  // Infancy
  { ageMonths: 0.15, label: 'Newborn (3–5 days)',      category: 'infant' },
  { ageMonths: 1,    label: '1 Month',                  category: 'infant' },
  { ageMonths: 2,    label: '2 Months',                 category: 'infant' },
  { ageMonths: 4,    label: '4 Months',                 category: 'infant' },
  { ageMonths: 6,    label: '6 Months',                 category: 'infant' },
  { ageMonths: 9,    label: '9 Months',                 category: 'infant' },
  { ageMonths: 12,   label: '12 Months',                category: 'infant' },

  // Toddler
  { ageMonths: 15,   label: '15 Months',                category: 'toddler' },
  { ageMonths: 18,   label: '18 Months',                category: 'toddler' },
  { ageMonths: 24,   label: '2 Years',                  category: 'toddler' },
  { ageMonths: 30,   label: '2½ Years',                 category: 'toddler' },

  // Annual visits 3–21 years
  { ageMonths: 36,   label: '3 Years',                  category: 'child' },
  { ageMonths: 48,   label: '4 Years',                  category: 'child' },
  { ageMonths: 60,   label: '5 Years',                  category: 'child' },
  { ageMonths: 72,   label: '6 Years',                  category: 'child' },
  { ageMonths: 84,   label: '7 Years',                  category: 'child' },
  { ageMonths: 96,   label: '8 Years',                  category: 'child' },
  { ageMonths: 108,  label: '9 Years',                  category: 'child' },
  { ageMonths: 120,  label: '10 Years',                 category: 'child' },
  { ageMonths: 132,  label: '11 Years',                 category: 'adolescent' },
  { ageMonths: 144,  label: '12 Years',                 category: 'adolescent' },
  { ageMonths: 156,  label: '13 Years',                 category: 'adolescent' },
  { ageMonths: 168,  label: '14 Years',                 category: 'adolescent' },
  { ageMonths: 180,  label: '15 Years',                 category: 'adolescent' },
  { ageMonths: 192,  label: '16 Years',                 category: 'adolescent' },
  { ageMonths: 204,  label: '17 Years',                 category: 'adolescent' },
  { ageMonths: 216,  label: '18 Years',                 category: 'adolescent' },
  { ageMonths: 228,  label: '19 Years',                 category: 'adolescent' },
  { ageMonths: 240,  label: '20 Years',                 category: 'adolescent' },
  { ageMonths: 252,  label: '21 Years',                 category: 'adolescent' }
];
