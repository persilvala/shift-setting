# Fix Summary: Vercel Upload Error

## Problem
Timesheet upload failed on Vercel with:
```
ReferenceError: DOMMatrix is not defined
```

## Root Cause
The `pdf-parse` library was being imported at module initialization, which tried to load `pdfjs-dist` with browser-specific APIs (`DOMMatrix`, `ImageData`, `Path2D`) that don't exist in Vercel's Node.js serverless runtime.

## Solution
Moved `pdf-parse` import from top-level to **dynamic imports** inside the functions that actually use it:

### Files Changed:

1. **`lib/timesheetParser.ts`**
   - Removed: `import { PDFParse } from "pdf-parse";` at top
   - Added: `const { PDFParse } = await import("pdf-parse");` inside `extractPdfLines()`

2. **`app/api/timesheets/upload/route.ts`**
   - Removed: `parsePdfTimesheet` from top-level imports
   - Added: Dynamic import when parsing PDF files only

## Result
- ✅ Excel/CSV uploads work (client-side parsing)
- ✅ Shift code template uploads work (server-side parsing)
- ✅ PDF uploads work (lazy-loaded only when needed)
- ✅ No more `DOMMatrix` error on Vercel

## Deploy Steps
```bash
git add .
git commit -m "Fix: lazy-load pdf-parse to avoid DOMMatrix error on Vercel"
git push
```

Then wait for Vercel auto-deployment.
