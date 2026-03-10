# Shift Setting - Project Documentation

## Project Overview

**Shift Setting** is a Next.js web application that streamlines timesheet upload, parsing, and payroll computation. It enables HR/Admin users to upload Excel, CSV, or PDF timesheets, review normalized data, generate payroll with automatic calculations, and export payroll reports as CSV.

### Core Features

- **Timesheet Upload**: Support for Excel (.xlsx), CSV, and PDF formats via drag-and-drop
- **Intelligent Parsing**: Automatic normalization of timesheet data with format detection
- **Dashboard**: Review and filter normalized timesheet data
- **Payroll Generation**: Compute base pay, overtime, and apply manual adjustments per employee
- **CSV Export**: Export payroll data with source file metadata
- **Session-based Storage**: Parsed data persisted in `sessionStorage` between pages
- **Cookie-based Auth**: Simple demo authentication with `demo-auth` cookie

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.1.6 (App Router) |
| Frontend | React 19.2.3, TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL with Prisma ORM 7.0.0 |
| File Parsing | `xlsx` (Excel), `pdf-parse` (PDF), `jspdf` + `jspdf-autotable` (export) |

---

## Building and Running

### Prerequisites

- Node.js 20+
- PostgreSQL database (update `.env` with connection string)

### Installation

```bash
npm install
```

### Development

```bash
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
npm run lint -- --fix  # Auto-fix issues
```

### Database Setup

```bash
# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

---

## Project Structure

```
shift-setting/
├── app/                    # Next.js App Router pages
│   ├── api/                # API routes
│   │   ├── debug/          # Debug utilities
│   │   ├── export/         # Payroll CSV export
│   │   ├── login/          # Login API
│   │   ├── payroll/        # Payroll generation
│   │   ├── signup/         # User signup API
│   │   └── timesheets/     # Timesheet upload API
│   ├── dashboard/          # Main dashboard view
│   ├── login/              # Login page
│   ├── payroll/            # Payroll management
│   ├── timesheets/         # Timesheet upload & review
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx            # Root redirect (auth-aware)
├── components/             # React components
│   ├── layout/
│   │   ├── BottomNav.tsx   # Bottom navigation
│   │   └── TopNav.tsx      # Top navigation bar
│   ├── payroll/            # Payroll components (empty)
│   └── timesheets/
│       └── TimesheetUpload.tsx  # File upload component
├── lib/                    # Business logic
│   ├── db.ts               # Prisma client singleton
│   ├── timesheetData.ts    # Session storage helpers
│   ├── timesheetParser.ts  # Excel/PDF parsing logic
│   └── types.ts            # Shared TypeScript types
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Prisma migrations
└── public/                 # Static assets
```

---

## Key Modules

### Shared Types (`lib/types.ts`)

```typescript
// Parsed timesheet row with all supported fields
export type ParsedTimesheetRow = {
  employeeName: string;
  date: string | null;
  timeIn: string | null;
  timeOut: string | null;
  totalHours: number | null;
  issues: string[];
  sourceLine: number;
  sheetName?: string;
  weekday?: string | null;
  dept?: string | null;
  userId?: string | null;
  template?: string | null;
  raw?: string[];
  // Time card fields
  beforeNoonIn?: string | null;
  beforeNoonOut?: string | null;
  afterNoonIn?: string | null;
  afterNoonOut?: string | null;
  overtimeIn?: string | null;
  overtimeOut?: string | null;
  // Payroll fields
  workHours?: number | null;
  workHoursActual?: number | null;
  overtimeHours?: number | null;
  overtimeHoliday?: number | null;
  lateCount?: number | null;
  lateMinutes?: number | null;
  earlyCount?: number | null;
  earlyMinutes?: number | null;
  workDays?: string | null;
  tripDays?: number | null;
  absenceDays?: number | null;
  leaveDays?: number | null;
  shiftCode?: string | null;
  // Additional pay fields
  addPayNormal?: number | null;
  addPayOvertime?: number | null;
  addPayAllowance?: number | null;
  leavePayLateEarly?: number | null;
  leavePayNoPaid?: number | null;
  payrollDeduction?: number | null;
  remark?: string | null;
};

// Payroll entry for export/generation
export type PayrollEntry = {
  userId: string;
  employeeName: string;
  department: string;
  startDate: string;
  endDate: string;
  workDays: number;
  workHours: number;
  overtimeHours: number;
  basePayPerDay: number;
  basePay: number;
  overtimePay: number;
  additions: Array<{ description: string; amount: number }>;
  deductions: Array<{ description: string; amount: number }>;
  totalAdditions: number;
  totalDeductions: number;
  netPay: number;
};

// Timesheet metadata stored in sessionStorage
export type TimesheetMeta = {
  format?: "excel" | "pdf";
  totalRows?: number;
  uploadedAt?: string;
  timesheetId?: string;
  startDate?: string | null;
  endDate?: string | null;
};

// Dashboard filter state
export type FilterState = {
  employee: string;
  dept: string;
  startDate: string;
  endDate: string;
};

// Manual adjustment per employee
export type Adjustment = {
  addition: number;
  deduction: number;
};

// Saved payroll record
export type SavedPayroll = {
  id: string;
  startDate: string;
  endDate: string;
  basePayPerDay: number;
  overtimeRate: number;
  totalNetPay: number;
  generatedAt: string;
  _count: { entries: number };
};
```

### Session Storage Keys

| Key | Content |
|-----|---------|
| `timesheetData` | Array of `ParsedTimesheetRow` |
| `timesheetMeta` | `TimesheetMeta` object |

### Database Models (Prisma)

**Timesheet** - Uploaded file metadata
- `id`, `fileName`, `format`, `startDate`, `endDate`, `totalRows`, `uploadedAt`

**TimesheetRow** - Individual parsed row data
- Employee info: `employeeName`, `userId`, `dept`
- Date/time: `date`, `weekday`, `beforeNoonIn/Out`, `afterNoonIn/Out`, `overtimeIn/Out`
- Hours: `totalHours`, `workHours`, `workHoursActual`, `overtimeHours`
- Attendance: `lateMinutes`, `earlyMinutes`, `workDays`, `tripDays`, `absenceDays`, `leaveDays`
- Pay: `addPayNormal`, `addPayOvertime`, `addPayAllowance`, `payrollDeduction`
- Other: `shiftCode`, `remark`

**Payroll** - Generated payroll batch
- `id`, `startDate`, `endDate`, `basePayPerDay`, `overtimeRate`, `totalNetPay`, `generatedAt`

**PayrollEntry** - Per-employee payroll calculations
- `id`, `payrollId`, `employeeName`, `employeeUserId`, `department`
- `workDays`, `workHours`, `overtimeHours`
- `basePay`, `overtimePay`, `totalAdditions`, `totalDeductions`, `netPay`
- `manualAddition`, `manualDeduction`

---

## Development Conventions

### TypeScript

- Strict mode enabled (`strict: true`)
- Always define explicit return types
- Use `interface` for object shapes, `type` for unions
- Use `Record<K, T>` for dictionary types
- Path alias `@/*` maps to project root

```typescript
// Good
function parseDate(value: unknown): string | null { }

interface ParsedTimesheetRow {
  employeeName: string;
  date: string | null;
}
```

### React/Next.js

- `"use client"` directive for interactive components (useState, onClick)
- Server components by default
- Use `sessionStorage` for client-side persistence
- Next.js App Router conventions
- Async server components for data fetching

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `TimesheetUpload.tsx` |
| Types/Interfaces | PascalCase | `ParsedTimesheetRow` |
| Functions/Variables | camelCase | `parseExcelTimesheet` |
| Constants | SCREAMING_SNAKE_CASE | `REQUIRED_FIELDS` |

### Imports Order

```typescript
import { useState } from "react";           // External libraries
import * as XLSX from "xlsx";
import type { ParsedTimesheetRow } from "@/lib/types";  // Internal
```

### Formatting

- 2-space indentation
- Double quotes for strings
- Trailing commas in multiline objects/arrays
- Semicolons required
- Max line length: 100 characters (soft limit)

### Error Handling

Use try/catch for async operations and return typed error responses:

```typescript
return NextResponse.json(
  { error: "Failed to parse timesheet", details: error.message },
  { status: 400 }
);
```

### API Routes

- Place in `app/api/` directory
- Use `NextResponse` for responses
- Define explicit return types

```typescript
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
```

---

## Authentication

Simple cookie-based demo authentication:

- **Cookie**: `demo-auth`
- **Middleware**: Protects `/dashboard`, `/timesheets`, `/payroll` routes
- **Public routes**: `/login`
- **Root redirect**: `/` → `/dashboard` (if authenticated) or `/login` (if not)

```typescript
// middleware.ts
const AUTH_COOKIE = "demo-auth";
const protectedRoots = ["/dashboard", "/timesheets", "/payroll"];
```

---

## System Flow

1. **Login**: User authenticates via `/login`, receives `demo-auth` cookie
2. **Upload**: User uploads timesheet (Excel/CSV/PDF) on `/timesheets`
3. **Parse**: File is parsed and normalized; preview shown
4. **Store**: Parsed rows stored in `sessionStorage`
5. **Review**: Navigate to `/dashboard` to filter and review data
6. **Generate**: Navigate to `/payroll`, enter period/rates, generate payroll
7. **Adjust**: Optionally add per-employee manual adjustments
8. **Export**: Download payroll CSV with source metadata

---

## Environment Variables

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shift_setting?schema=public"
```

---

## Testing

No test framework is currently configured. If tests are added:

```bash
# Jest
npm test -- --testPathPattern=filename

# Vitest
npm run test -- filename
```

---

## Notes

- Source file metadata (type, row count, upload time) is stored client-side
- Payroll generation is disabled if no parsed timesheet data exists
- Authentication uses a simple cookie-based demo auth (`demo-auth` cookie)
- Root page (`/`) automatically redirects based on auth status
- Layout uses Geist Sans + Geist Mono fonts with radial gradient background
