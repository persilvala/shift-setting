# Shift Setting - Vercel Upload Issue Context

## Problem Summary

Timesheet upload works in **local production** but fails on **Vercel production** with error:
```
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

This indicates the API is returning an HTML error page instead of JSON.

---

## What Was Implemented

### Client-Side Parsing (for Vercel compatibility)

**Files Modified:**
- `lib/clientParser.ts` (new) - Client-side Excel/CSV parsing
- `components/timesheets/TimesheetUpload.tsx` - Updated to parse client-side
- `app/api/timesheets/upload/route.ts` - Accepts JSON payload + FormData fallback
- `vercel.json` - Increased function timeout (60s) and memory (1024MB)

**Flow:**
1. Standard Excel/CSV → Parsed in browser → Send JSON to API
2. Shift code template (template.xlsx) → Detected → Fallback to FormData upload
3. PDF → Always server-side via FormData.

---

## Current Error

When uploading `template.xlsx` on Vercel:
```
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**Root Cause:** API route returns HTML error page (likely 500 error) instead of JSON.

**Most Likely Causes:**
1. `DATABASE_URL` environment variable not set in Vercel
2. Database connection failing (Neon PostgreSQL)
3. Prisma client not generated properly in build

---

## Environment Setup

### DATABASE_URL (Neon PostgreSQL)
```
postgresql://neondb_owner:npg_XXX@ep-ancient-pine-anjh0294-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require
```

⚠️ **Note:** Password was exposed in chat - needs rotation

### Vercel Environment Variables Required:
- `DATABASE_URL` - Neon connection string

### package.json Scripts:
```json
{
  "postinstall": "prisma generate",
  "build": "next build",
  "dev": "next dev"
}
```

---

## Code Changes Summary

### lib/clientParser.ts (NEW)
```typescript
// Detects shift code template format
const hasShiftCodeFormat = data.some((row, i) => {
  if (i > 5) return false;
  const rowStr = row.map((c) => String(c ?? "").toLowerCase()).join(" ");
  return rowStr.includes("user id") && rowStr.includes("name") && rowStr.includes("department");
});

if (hasShiftCodeFormat) {
  throw new Error("SHIFT_CODE_TEMPLATE"); // Fallback to server
}
```

### components/timesheets/TimesheetUpload.tsx
```typescript
// Fallback to server-side parsing for shift templates
try {
  parseResult = parseExcelFileClient(arrayBuffer, file.name);
} catch (parseError) {
  if (parseError instanceof Error && parseError.message === "SHIFT_CODE_TEMPLATE") {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/timesheets/upload", { method: "POST", body });
    // ... handle response
  }
}
```

### app/api/timesheets/upload/route.ts
```typescript
// Check database connection first
try {
  await prisma.$connect();
} catch (dbError) {
  return NextResponse.json(
    { ok: false, error: "Database connection failed", details: dbError.message },
    { status: 500 }
  );
}

// Handle FormData for fallback
else if (contentType.includes("multipart/form-data")) {
  // ... parse with parseExcelTimesheet() for shift templates
}
```

### vercel.json (NEW)
```json
{
  "functions": {
    "app/api/timesheets/upload/route.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  }
}
```

---

## Debugging Steps Needed

### 1. Check Vercel Environment Variables
- Go to Vercel Dashboard → Project → Settings → Environment Variables
- Verify `DATABASE_URL` exists and is correct
- **Redeploy after adding/changing env vars**

### 2. Check Vercel Function Logs
- Go to Vercel Dashboard → Deployments → Latest
- Click "View Function Logs"
- Look for errors when upload is attempted
- Expected logs: "Database connection failed" or Prisma errors

### 3. Check Browser Network Tab
- Open DevTools → Network tab
- Upload file
- Click on `/api/timesheets/upload` request
- Check:
  - Status code (likely 500)
  - Response (HTML error page)
  - Request payload

### 4. Test Database Connection
The API route now includes DB connection check that returns:
```json
{
  "ok": false,
  "error": "Database connection failed. Please check DATABASE_URL environment variable.",
  "details": "<error message>"
}
```

---

## template.xlsx Format

The file uses a **shift code template** format (NOT standard time-in/time-out):

```
Row 0: [null, "Shift Setting Table (For Verification Only)"]
Row 1: ["Date:2024-03-11~2024-03-16", null, ..., "Special Shift: 25-Business trip, ..."]
Row 2: ["User ID", "Name", "Department", 11, 12, 13, 14, 15, 16]
Row 3: [null, null, null, "Mo", "Tu", "We", "Th", "Fr", "Sa"]
Row 4: [1, "Jann Skyler Teng", "COMPANY", 1, 1, 1, 1, 1]
```

This format is handled by the existing `parseExcelTimesheet()` server-side function in `lib/timesheetParser.ts`.

---

## Files to Review

| File | Purpose |
|------|---------|
| `lib/clientParser.ts` | Client-side Excel/CSV parsing |
| `lib/timesheetParser.ts` | Server-side parsing (shift code templates) |
| `lib/db.ts` | Prisma client with Neon adapter |
| `app/api/timesheets/upload/route.ts` | Upload API with JSON + FormData support |
| `components/timesheets/TimesheetUpload.tsx` | Upload component with fallback logic |
| `vercel.json` | Vercel function configuration |
| `.env` | Local DATABASE_URL (not committed to Git) |

---

## Next Steps for Antigravity

1. **Check Vercel Function Logs** - Shows exact error message
2. **Verify DATABASE_URL in Vercel** - Must match Neon connection string
3. **Check if Prisma generated** - `postinstall` script should run `prisma generate`
4. **Test with simple file first** - Try a standard Excel with "Name,Date,Time In,Time Out" headers
5. **Review error handling** - API should return JSON error, not HTML

---

## Build Status

✅ Build passes successfully
✅ No TypeScript errors
✅ Client-side parsing works locally
✅ Server-side parsing works locally
❌ Vercel deployment fails with HTML error (likely DB connection)

---

## Contact Info

Project: Shift Setting (Next.js 15, Prisma, Neon DB, Vercel)
Issue: Timesheet upload fails on Vercel with HTML error instead of JSON
Last Updated: 2026-03-31
