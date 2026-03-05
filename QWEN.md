# Shift Setting - Project Documentation

## Project Overview

**Shift Setting** is a Next.js web application that streamlines timesheet upload, parsing, and payroll computation. It enables HR/Admin users to upload Excel, CSV, or PDF timesheets, review normalized data, generate payroll with automatic calculations, and export payroll reports as CSV.

### Core Features

- **Timesheet Upload**: Support for Excel (.xlsx), CSV, and PDF formats via drag-and-drop
- **Intelligent Parsing**: Automatic normalization of timesheet data with format detection
- **Payroll Generation**: Compute base pay, overtime, and apply manual adjustments per employee
- **CSV Export**: Export payroll data with source file metadata
- **Session-based Storage**: Parsed data persisted in `sessionStorage` between pages

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.1.6 (App Router) |
| Frontend | React 19.2.3, TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL with Prisma ORM 6.0.0 |
| File Parsing | `xlsx` (Excel), `pdf-parse` (PDF), `jspdf` (export) |

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
│   │   ├── export/         # Payroll CSV export
│   │   ├── login/          # Authentication
│   │   ├── payroll/        # Payroll generation
│   │   └── timesheets/     # Timesheet upload API
│   ├── dashboard/          # Main dashboard view
│   ├── login/              # Login page
│   ├── payroll/            # Payroll management
│   └── timesheets/         # Timesheet upload & review
├── components/             # React components
│   ├── BottomNav.tsx       # Bottom navigation
│   ├── TimesheetUpload.tsx # File upload component
│   └── TopNav.tsx          # Top navigation bar
├── lib/                    # Business logic
│   ├── db.ts               # Prisma client singleton
│   ├── timesheetData.ts    # Session storage helpers
│   └── timesheetParser.ts  # Excel/PDF parsing logic
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Prisma migrations
└── public/                 # Static assets
```

---

## Key Modules

### Timesheet Parser (`lib/timesheetParser.ts`)

Parses uploaded timesheets into normalized rows:

```typescript
type ParsedTimesheetRow = {
  employeeName: string;
  date: string | null;
  timeIn: string | null;
  timeOut: string | null;
  totalHours: number | null;
  issues: string[];
  sourceLine: number;
  // Time card fields
  beforeNoonIn?: string | null;
  beforeNoonOut?: string | null;
  afterNoonIn?: string | null;
  afterNoonOut?: string | null;
  overtimeIn?: string | null;
  overtimeOut?: string | null;
  // Payroll fields
  workHours?: number | null;
  overtimeHours?: number | null;
  lateMinutes?: number | null;
  // ... more fields
};
```

### Session Storage Keys

| Key | Content |
|-----|---------|
| `timesheetData` | Array of `ParsedTimesheetRow` |
| `timesheetMeta` | `{ format, totalRows, uploadedAt, startDate, endDate }` |

### Database Models (Prisma)

- **Timesheet**: Uploaded file metadata
- **TimesheetRow**: Individual parsed row data
- **Payroll**: Generated payroll batch
- **PayrollEntry**: Per-employee payroll calculations

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
import type { ParsedTimesheetRow } from "@/lib/timesheetParser";  // Internal
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

## System Flow

1. **Upload**: User uploads timesheet (Excel/CSV/PDF) on `/timesheets`
2. **Parse**: File is parsed and normalized; preview shown
3. **Store**: Parsed rows stored in `sessionStorage`
4. **Generate**: Navigate to `/payroll`, enter period/rates, generate payroll
5. **Adjust**: Optionally add per-employee manual adjustments
6. **Export**: Download payroll CSV with source metadata

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
