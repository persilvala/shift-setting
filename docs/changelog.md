# Changelog

## 2026-03-28

### Changes Made

#### 1. Database - PayrollEntry Note Fields
**File**: `prisma/schema.prisma`
- Added new fields to `PayrollEntry` model:
  - `note` (String, optional) - The note text
  - `noteCreatedBy` (String, optional) - Username who created the note
  - `noteCreatedAt` (DateTime, optional) - When the note was created
  - `noteEditedBy` (String, optional) - Username who last edited the note
  - `noteEditedAt` (DateTime, optional) - When the note was last edited

**Migration**: `20260328112752_add_payroll_entry_notes`

#### 2. Backend API - Note Update Endpoint
**File**: `app/api/payroll/[id]/entries/[entryId]/note/route.ts` (NEW)
- Created new `PATCH` endpoint to update note for a PayrollEntry
- Automatically tracks `noteCreatedBy`/`noteCreatedAt` on first save
- Automatically tracks `noteEditedBy`/`noteEditedAt` on subsequent edits
- Requires authentication (uses session username)

#### 3. Backend API - Get Payroll Detail
**File**: `app/api/payroll/[id]/route.ts`
- Updated to return note fields in response: `note`, `noteCreatedBy`, `noteCreatedAt`, `noteEditedBy`, `noteEditedAt`

#### 4. Frontend - Note Column in Payroll Detail
**File**: `app/admin/payroll/page.tsx`

**a. Note Column**
- Added "Note" column after "Net Pay" column in Payroll Detail table
- Button shows "📝" (blue) if note exists, "Add Note" (gray) if empty
- Click to open Note Modal

**b. Note Modal**
- Header shows employee name and Edit button
- Displays note metadata:
  - "Created by: [username] on [date]"
  - "Edited by: [username] on [date]" (if edited)
- Read-only textarea showing note content
- Edit mode: textarea becomes editable with Save/Cancel buttons

**c. Admin Logging**
- Logs "Added note for [employeeName]" when note is created
- Logs "Edited note for [employeeName]" when note is edited

### Workflow Summary

1. **Payroll Detail** → Click "📝" or "Add Note" button in the Note column
2. **Note Modal** → View note (read-only) and metadata (created/edited by)
3. **Edit Mode** → Click Edit button → Modify note → Click Save
4. **Save** → Note persisted to database with username tracking

## 2026-03-27

### Changes Made

#### 1. Backend API - Payroll Detail Date Field
**File**: `app/api/payroll/[id]/route.ts`
- Added `timesheetRow` include to fetch date from each PayrollEntry
- Returns `date` and `timesheetRowId` fields in the response

#### 2. Frontend - Payroll Detail UI Redesign
**File**: `app/admin/payroll/page.tsx`

**a. Auto-fetch on saved payroll click**
- Clicking a saved payroll now immediately shows the Payroll Detail section (no manual fetch needed)

**b. Aggregated per-employee table**
- Shows one row per employee (clickable)
- Columns: Name, Base Pay (historical), Added (+), Subtracted (-), Net Pay, Status
- Base Pay column shows the `basePayPerDay` from the Payroll record (historical value at time of generation)

**c. Employee Payroll Entries Modal**
- Click an employee row to see all their PayrollEntry records
- Columns: Date, Base Pay, Added (+), Subtracted (-), Net Pay, Edited (flag), Actions
- Edit button inside modal for per-entry editing

**d. Removed old columns**
- Removed Full Days, Half Days, Absent columns from Payroll Detail

#### 3. API - Edit Entry Recalculation Logic
**File**: `app/api/payroll/[id]/entries/[entryId]/route.ts`
- When updating days only: Keeps original `basePay` unchanged, recalculates `netPay`
- When updating added/subtracted values: Recalculates both basePay and netPay

#### 4. Removed Edit Days Feature
- Removed "Edit Days" button from Payroll Detail table
- Removed "Edit Days Attended" modal
- Removed related states (`daysEditModal`, `daysEditEmployeeEntries`)
- Kept "Edit" button in Employee Payroll Entries modal for editing Added/Subtracted values

### Workflow Summary

1. **Payroll Page** → See list of "Saved payrolls" table
2. **Click a saved payroll** → Payroll Detail section appears immediately
3. **Click an employee row** → Modal shows all PayrollEntry rows for that employee
4. **In modal** → See Date, Base Pay, Added, Subtracted, Net Pay, Edited flag per day
5. **Click Edit** → Modify Added/Subtracted values for that specific entry

### Notes
- Historical base pay is preserved - updating employee base pay later doesn't affect saved payrolls
- Each PayrollEntry shows the original base pay per day at time of generation
