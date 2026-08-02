# Healthy Human

Healthy Human is a pediatric growth and health tracking web application. It helps parents and caregivers monitor child growth parameters, immunization schedules, and well-child checkup records with clinical reference standards.

## Key Features

- **Child Profile Management**: Track individual profiles for multiple children with date of birth and sex-specific growth references.
- **Growth Charting & Percentiles**: Plot weight-for-age, length/height-for-age, head circumference, and BMI-for-age against official reference data.
  - WHO standards for ages 0 to 24 months.
  - CDC growth standards for ages 2 to 20 years.
  - Percentile curves including p3, p15, p50, p85, and p97.
- **Unit Support**: Seamlessly toggle between Imperial (pounds, inches, ounces) and Metric (kilograms, centimeters) units.
- **Vaccine & Immunization Tracking**: Includes CDC recommended immunization schedules from birth through 18 years, tracking completed doses, due dates, and overdue alerts.
- **Well-Child Checkup Logs**: Schedule and record outcomes for 30 standardized well-child visits, complete with developmental milestone lists and notes.
- **PDF Report Export**: Generate comprehensive PDF reports summarizing growth trends, vaccine history, and visit logs using jsPDF.
- **Data Privacy & Portability**: All data stays stored locally in your browser (`localStorage`). Export full profile backups as JSON files or import existing backups anytime.

## Tech Stack & Dependencies

- **Frontend**: Standard HTML5, CSS3, JavaScript (ES6+). No build step or framework required.
- **Libraries**:
  - [Chart.js](https://www.chartjs.org/) (v4.4.4) for growth curve rendering.
  - [jsPDF](https://github.com/parallax/jsPDF) (v2.5.1) for generating PDF exports.
  - [Google Fonts](https://fonts.google.com/) (Inter, IBM Plex Mono).

## Project Structure

```text
healthy_human/
├── index.html              # Main web application interface
├── styles.css              # Custom styling and design system
├── app.js                  # Application controller and UI event wiring
├── calc/                   # Calculation logic
│   ├── growth.js           # LMS growth z-score and percentile algorithms
│   └── vaccines.js         # Vaccine schedule logic and status evaluation
├── components/             # UI component scripts
│   ├── checkup-tracker.js  # Well-child visit logs
│   ├── child-manager.js    # Profile storage and switching
│   ├── export.js           # PDF report generation and JSON backup/restore
│   ├── growth-chart.js     # Chart.js rendering and dataset generation
│   ├── measurement-form.js # Growth entry modal/form logic
│   ├── metric-cards.js     # Current stats summary cards
│   ├── summary.js          # Printable/exportable summary overview
│   └── vaccine-table.js    # Immunization schedule table
├── data/                   # Reference datasets
│   ├── cdc-lms.js          # CDC 2000 LMS parameters (ages 2 to 20)
│   ├── who-lms.js          # WHO 2006 LMS parameters (ages 0 to 2)
│   └── vaccines.js         # CDC vaccine schedule definitions
├── test-node.js            # Node.js automated test runner
└── test.html               # Browser-based test suite
```

## Getting Started

### Running the App

No installation or compilation step is required.

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/healthy-human.git
   cd healthy-human
   ```
2. Open `index.html` directly in your web browser, or serve it using any static file server:
   ```bash
   # Using Python
   python -m http.server 8000

   # Or using Node serve
   npx serve .
   ```
3. Open `http://localhost:8000` in your browser.

### Running Tests

You can run the test suite via Node.js or directly in a browser.

**Via Node.js:**
```bash
node test-node.js
```

**Via Browser:**
Open `test.html` in your web browser to execute and view all test assertions.

## Data Privacy

All profile records and growth data reside exclusively in local browser storage (`localStorage`). No personal information or measurements are sent to external servers.

## Copyright & License

Copyright (c) 2026 Michael Guo. All Rights Reserved.

This software and associated documentation files are proprietary and confidential. Unauthorized copying, distribution, modification, or commercial use of this file, via any medium, is strictly prohibited.

