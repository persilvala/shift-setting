# Shift Setting Console - Project Context

## Project Overview

A **Next.js 16** web application for HR/Admin users to streamline timesheet upload, parsing, and payroll computation. The app allows uploading Excel, CSV, or PDF timesheets, reviewing normalized data, generating payroll with manual adjustments, and exporting results as CSV.

### Core Features
- **Timesheet Upload**: Parse Excel (.xlsx/.xls), CSV, or PDF timesheets via `/timesheets`
- **Data Normalization**: Deduplicate and normalize rows from various template formats
- **Dashboard**: View attendance summaries with filtering by employee, department, and date range
- **Payroll Generation**: Compute salaries based on work days, hours, overtime, and auto-additions/deductions
- **Manual Adjustments**: Apply per-employee additions or deductions before export
- **CSV Export**: Export payroll with source-file metadata included

### Tech Stack
| Category | Technology |
|----------|------------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Frontend | React 19.2.3, TypeScript 5 |
| Styling | Tailwind CSS 4, CSS variables for theming |
| Parsing | `xlsx` 0.18.5, `pdf-parse` 2.4.5 |
| Export | `jspdf` 4.2.0, `jspdf-autotable` 5.0.7 |
| Linting | ESLint 9 with Next.js configs |

## Project Structure

```
shift-setting/
├── app/                      # Next.js App Router pages and API routes
│   ├── api/                  # API endpoints
│   │   ├── payroll/          # Payroll generation and export
│   │   ├── timesheets/       # Timesheet upload and parsing
│   │   └── login/            # Authentication endpoint
│   ├── login/                # Login page
│   ├── payroll/              # Payroll computation page
│   ├── timesheets/           # Timesheet upload page
│   ├── layout.tsx            # Root layout with fonts and theming
│   └── page.tsx              # Dashboard/Overview page
├── components/               # Reusable React components
│   ├── TopNav.tsx            # Top navigation bar
│   ├── BottomNav.tsx         # Bottom navigation (unused in main flow)
│   └── TimesheetUpload.tsx   # File upload and preview component
├── lib/                      # Core business logic
│   ├── timesheetParser.ts    # Multi-format timesheet parsing logic
│   └── timesheetData.ts      # Static sample data (legacy)
├── middleware.ts             # Auth middleware (cookie-based demo auth)
├── next.config.ts            # Next.js configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies and scripts
```

## Building and Running

### Development
```bash
npm install
npm run dev
# Opens http://localhost:3000
```

### Production Build
```bash
npm run build
npm run start
```

### Linting
```bash
npm run lint
```

## Key Conventions

### Code Style
- **TypeScript**: Strict mode enabled, ES2017 target
- **Module Resolution**: `bundler` strategy with path alias `@/*` → `./*`
- **Components**: All page components use `"use client"` for interactivity where needed
- **Naming**: PascalCase for components/types, camelCase for variables/functions

### Data Flow
1. **Upload** → `/api/timesheets/upload` parses file and returns normalized rows
2. **Storage** → Parsed rows stored in `sessionStorage` (client-side only)
3. **Payroll** → `/api/payroll/generate` computes salaries from aggregated data
4. **Export** → `/api/payroll/export` generates CSV with adjustments included

### Authentication
- Demo cookie-based auth (`demo-auth`) via middleware
- Login redirects to requested path after successful sign-in
- Middleware excludes `/api` routes and public files

### Parser Architecture (`lib/timesheetParser.ts`)
The parser supports multiple timesheet templates:
- **Attendance Statistic** template
- **Attendance Template** (standard format)
- **Time Card** blocks
- **Shift Code** template
- **Generic mapped** sheets

Key types:
```typescript
ParsedTimesheetRow {
  employeeName, date, timeIn, timeOut, totalHours,
  workHours, overtimeHours, lateMinutes, earlyMinutes,
  addPayNormal, addPayOvertime, addPayAllowance,
  payrollDeduction, dept, userId, shiftCode, ...
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/timesheets/upload` | Upload and parse timesheet file |
| POST | `/api/payroll/generate` | Generate payroll from timesheet data |
| POST | `/api/payroll/export` | Export payroll as CSV |
| POST | `/api/login` | Demo authentication |

## Session Storage Keys

| Key | Content |
|-----|---------|
| `timesheetData` | Array of `ParsedTimesheetRow` |
| `timesheetMeta` | `{ format, totalRows, uploadedAt }` |

## Notes
- No persistent database; all data is client-side session storage
- Source file metadata (format, row count, upload time) included in exports
- Dashboard aggregates unique dates for present-day counts
- Payroll uses work days from timesheet (parsed as `N/M` format)
