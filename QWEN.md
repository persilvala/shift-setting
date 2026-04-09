# Shift Setting - Project Documentation

## Project Overview

**Shift Setting** is a Next.js web application that streamlines timesheet upload, parsing, and payroll computation. It enables HR/Admin users to upload Excel, CSV, or PDF timesheets, review normalized data, generate payroll with automatic calculations, and export payroll reports as CSV.

### Core Features

- **Timesheet Upload**: Support for Excel (.xlsx), CSV, and PDF formats via drag-and-drop
- **Intelligent Parsing**: Automatic normalization of timesheet data with format detection
- **Dashboard**: Review and filter normalized timesheet data
- **Payroll Generation**: Compute base pay based on attendance status (full day/half day/absent)
- **CSV Export**: Export payroll data with source file metadata
- **Session-based Storage**: Parsed data persisted in `sessionStorage` between pages
- **JWT-based Auth**: NextAuth v5 with JWT sessions, 7-day max age

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.1.6 (App Router) |
| Frontend | React 19.2.3, TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL with Prisma ORM 7.0.0 |
| Auth | NextAuth v5 (JWT sessions) |
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
│   │   ├── auth/          # NextAuth handlers
│   │   ├── debug/         # Debug utilities
│   │   ├── employees/     # Employee CRUD endpoints
│   │   ├── export/        # Payroll CSV export
│   │   ├── payroll/        # Payroll generation & export
│   │   └── timesheets/    # Timesheet upload & parsing
│   ├── admin/             # Protected admin pages
│   │   ├── dashboard/     # Main dashboard view
│   │   ├── employees/     # Employee management UI
│   │   ├── logs/          # Admin activity logs
│   │   ├── payroll/       # Payroll management
│   │   ├── timesheets/    # Timesheet upload & review
│   │   └── admins/        # Admin user management
│   ├── login/             # Login page
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx           # Root redirect (auth-aware)
├── auth.ts                # NextAuth configuration
├── auth.config.ts         # NextAuth middleware config
├── components/            # React components
│   ├── layout/
│   │   ├── BottomNav.tsx  # Bottom navigation
│   │   └── TopNav.tsx     # Top navigation bar
│   ├── timesheets/
│   │   └── TimesheetUpload.tsx  # File upload component
│   └── Payroll.tsx        # Payroll components
├── lib/                   # Business logic
│   ├── db.ts              # Prisma client singleton
│   ├── timesheetParser.ts # Excel/PDF parsing logic
│   ├── attendanceCalculator.ts # Attendance aggregation
│   └── types.ts           # Shared TypeScript types
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Prisma migrations
└── public/                # Static assets
```

---

## Key Modules

### Attendance Status

The system tracks attendance with three possible statuses:
- `full_day` - Employee worked a full day
- `half_day` - Employee worked a partial day (0.5x pay)
- `absent` - Employee was absent (0x pay)

### Shared Types (`lib/types.ts`)

```typescript
export type AttendanceStatus = "absent" | "full_day" | "half_day";

export type ParsedTimesheetRow = {
  employeeName: string;
  date: string | null;
  timeIn: string | null;
  timeOut: string | null;
  totalHours: number | null;
  issues: string[];
  sourceLine: number;
  employeeId?: string;
  attendanceStatus?: AttendanceStatus;
  // ... other fields
};

// Employee record
export type Employee = {
  id: string;
  employeeName: string;
  basePayPerDay: number | null;
  createdAt: Date;
  updatedAt: Date;
};

// Simplified PayrollEntry
export type PayrollEntry = {
  id: string;
  payrollId: string;
  timesheetRowId: string | null;
  employeeId: string;
  addedValue: number;
  subtractedValue: number;
  isEdited: boolean;
  createdAt: Date;
};

// Saved payroll record
export type SavedPayroll = {
  id: string;
  timesheetId: string | null;
  startDate: string;
  endDate: string;
  basePayPerDay: number;
  totalNetPay: number;
  isEdited: boolean;
  generatedAt: string;
  _count: { entries: number };
};
```

### Session Storage Keys

| Key | Content |
|-----|---------|
| `timesheetData` | Array of `ParsedTimesheetRow` |
| `timesheetMeta` | `TimesheetMeta` object |
| `manualTimesheetRows` | Manual entry rows |
| `payroll-locks` | Prevent duplicate payroll generation |

### Database Models (Prisma)

**Employee** - Employee master data
- `id`, `employeeName` (unique), `basePayPerDay` (nullable), `createdAt`, `updatedAt`

**Timesheet** - Uploaded file metadata
- `id`, `fileName`, `format`, `startDate`, `endDate`, `totalRows`, `uploadedAt`

**TimesheetRow** - Individual parsed row data
- Employee info: `employeeId` (FK), `employeeName`, `userId`, `dept`
- `attendanceStatus` - full_day/half_day/absent
- Date/time: `date`, `weekday`, `beforeNoonIn/Out`, `afterNoonIn/Out`, `overtimeIn/Out`
- Hours: `totalHours`, `workHours`, `workHoursActual`, `overtimeHours`
- Attendance: `lateMinutes`, `earlyMinutes`, `workDays`, `tripDays`, `absenceDays`, `leaveDays`
- Pay: `addPayNormal`, `addPayOvertime`, `addPayAllowance`, `payrollDeduction`

**Payroll** - Generated payroll batch
- `id`, `timesheetId` (FK), `startDate`, `endDate`, `basePayPerDay`, `totalNetPay`, `isEdited`, `generatedAt`

**PayrollEntry** - Per-employee payroll calculations
- `id`, `payrollId` (FK), `timesheetRowId` (FK), `employeeId` (FK)
- `attendanceDays`, `halfDays`, `absentDays`
- `basePay`, `addedValue`, `subtractedValue`, `netPay`
- `isEdited` (indicates if manually edited)

---

## Payroll Calculation

Payroll is calculated based on attendance status:
- **Full Day**: basePayPerDay * 1.0
- **Half Day**: basePayPerDay * 0.5
- **Absent**: basePayPerDay * 0.0

Net Pay = (attendanceDays * basePayPerDay) + (halfDays * basePayPerDay * 0.5) + addedValue - subtractedValue

### Payroll Display Columns

| Column | Description |
|--------|-------------|
| Name | Employee name |
| Full Days | Number of full days worked |
| Half Days | Number of half days worked |
| Absent | Number of absent days |
| Start | Payroll period start date |
| End | Payroll period end date |
| Total | Net pay amount |
| Status | "Generated" or "Edited" |
| Added (+) | Manual additions |
| Subtracted (-) | Manual deductions |
| Actions | Edit button with modal |

### Edit Modal

Clicking "Edit" opens a modal where you can:
- Modify attendance days (full, half, absent)
- Add/subtract values manually
- See updated base pay and net pay preview
- Mark entry as edited (shows exclamation icon)

---

## Development Conventions

### TypeScript

- Strict mode enabled (`strict: true`)
- Always define explicit return types
- Use `interface` for object shapes, `type` for unions
- Use `Record<K, T>` for dictionary types
- Path alias `@/*` maps to project root

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

NextAuth v5 with JWT sessions:

- **Strategy**: JWT with 7-day max age (604800 seconds)
- **Provider**: Credentials provider with username/password
- **Middleware**: Protects `/admin/*` routes (except `/admin/password`)
- **Login flow**: Must change password on first login (`mustChangePassword` flag)

### Protected Routes

| Route | Protected |
|-------|----------|
| `/admin/*` | Yes (except `/admin/password`) |
| `/login` | No |
| `/` | Redirects based on auth |

---

## System Flow

1. **Login**: User authenticates via `/login`, receives JWT session
2. **Manage Employees**: Add/edit employees on `/admin/employees`
3. **Upload**: User uploads timesheet (Excel/CSV/PDF) on `/admin/timesheets`
4. **Parse**: File is parsed and normalized; Employees auto-created; preview shown
5. **Review**: Navigate to `/admin/dashboard` to filter and review data
6. **Generate**: Navigate to `/admin/payroll`, enter period/rates, generate payroll
7. **Edit**: Optionally edit individual payroll entries with modal
8. **Save**: Save payroll to database
9. **Export**: Download payroll CSV with source metadata

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
- Authentication uses NextAuth v5 with JWT sessions
- First-time admins must change their password
- Root page (`/`) automatically redirects based on auth status
- Layout uses Geist Sans + Geist Mono fonts with radial gradient background
- Employees are auto-created during file upload or manual entry
- `TimesheetRow.employeeId` is populated on both file upload and manual entry
- Exclamation icon (!) shows when `isEdited = true` in payroll entries
