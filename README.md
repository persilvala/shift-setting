## Documentation

### Overview
This web app streamlines timesheet upload, parsing, and payroll computation. HR/Admin users can upload Excel, CSV, or PDF timesheets, review normalized rows, generate payroll, adjust amounts, and export payroll as CSV.

### Project Goal (kept)
- Upload the existing timesheet template
- Display the uploaded data in a dashboard view
- Automatically compute salary based on the timesheet records

### What’s in scope (implemented)
- Upload Excel/CSV/PDF timesheets via `Timesheets`
- Parse and normalize rows (deduplicated, limited preview shown)
- Persist parsed rows in `sessionStorage` for use by payroll
- Generate payroll (base pay + OT + auto additions/deductions)
- Apply manual additions/deductions per employee
- Export payroll CSV with source-file metadata

### What’s out of scope / removed
- User management, roles, and password flows
- Persistent storage of attendance records
- Advanced dashboards/analytics (totals, trends, filters)
- Report builders beyond the payroll CSV export

### System Flow
1) Upload timesheet (Excel/CSV/PDF) on `Timesheets`
2) Review parsed preview (rows stored in session)
3) Go to `Payroll`, enter period and rates, generate payroll
4) Optionally add per-employee adjustments
5) Export payroll CSV (includes adjustments and source metadata)

### Running locally
```bash
npm install
npm run dev
# open http://localhost:3000
```

### Notes
- Source file metadata (type, row count, uploaded time) is stored client-side and included in exports.
- If no parsed timesheet data is present, payroll generation/export is disabled until you upload again.
