import { NextResponse } from "next/server";
import { parseCsvTimesheet, parseExcelTimesheet, parsePdfTimesheet } from "@/lib/timesheetParser";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

function isExcel(mime: string | undefined, name: string) {
  const loweredMime = mime?.toLowerCase() ?? "";
  return (
    loweredMime.includes("spreadsheet") ||
    loweredMime.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  );
}

function isPdf(mime: string | undefined, name: string) {
  const loweredMime = mime?.toLowerCase() ?? "";
  return loweredMime.includes("pdf") || name.endsWith(".pdf");
}

function isCsv(mime: string | undefined, name: string) {
  const loweredMime = mime?.toLowerCase() ?? "";
  return loweredMime.includes("csv") || name.endsWith(".csv");
}

function errorResponse(message: string, status: number = 500) {
  console.error('[timesheet-upload]', message);
  return NextResponse.json(
    { ok: false, error: message },
    { status }
  );
}

export async function POST(request: Request) {
<<<<<<< Updated upstream
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "File is required" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = file.name?.toLowerCase() ?? "";
  const mime = file.type?.toLowerCase();

  try {
    if (isExcel(mime, fileName)) {
      const wb = XLSX.read(buffer, { type: "buffer", raw: true });
      const sheets = wb.SheetNames.map((name) => ({
        name,
        grid: XLSX.utils.sheet_to_json<(string | number | Date | undefined)[]>(wb.Sheets[name], {
          header: 1,
          raw: true,
        }),
      }));
      const result = parseExcelTimesheet(buffer);
      return NextResponse.json({
        ok: true,
        format: "excel",
        rows: result.rows,
        warnings: result.warnings,
        sheets,
        startDate: result.startDate,
        endDate: result.endDate,
      });
    }

    if (isCsv(mime, fileName)) {
      const wb = XLSX.read(buffer, { type: "buffer", raw: true });
      const sheets = wb.SheetNames.map((name) => ({
        name,
        grid: XLSX.utils.sheet_to_json<(string | number | Date | undefined)[]>(wb.Sheets[name], {
          header: 1,
          raw: true,
        }),
      }));
      const result = parseCsvTimesheet(buffer);
      return NextResponse.json({
        ok: true,
        format: "excel",
        rows: result.rows,
        warnings: result.warnings,
        sheets,
        startDate: result.startDate,
        endDate: result.endDate,
      });
    }

    if (isPdf(mime, fileName)) {
      const result = await parsePdfTimesheet(buffer);
      return NextResponse.json({
        ok: true,
        format: "pdf",
        rows: result.rows,
        warnings: result.warnings,
        sheets: [],
        startDate: result.startDate,
        endDate: result.endDate,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported file type. Upload Excel (.xlsx/.xls), CSV, or PDF." },
      { status: 400 }
    );
  } catch (error) {
    console.error("timesheet upload parse error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Failed to parse timesheet: ${message}` },
      { status: 500 }
    );
=======
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return errorResponse('File is required', 400);
    }

    const fileName = file.name?.toLowerCase() ?? '';
    const mime = file.type?.toLowerCase();

    console.log('[timesheet-upload] Received file:', {
      name: file.name,
      type: mime,
      size: file.size,
    });

    if (!fileName || fileName.trim() === '') {
      return errorResponse('File name is empty', 400);
    }

    if (file.size === 0) {
      return errorResponse('File is empty', 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('[timesheet-upload] Parsing file, size:', buffer.length);

    let result;
    if (isExcel(mime, fileName) || isCsv(mime, fileName)) {
      try {
        const wb = XLSX.read(buffer, { type: 'buffer', raw: true });
        console.log('[timesheet-upload] Excel parsed, sheets:', wb.SheetNames);
      } catch (readErr) {
        console.error('[timesheet-upload] XLSX.read error:', readErr);
        return errorResponse(`Failed to read Excel file: ${readErr instanceof Error ? readErr.message : 'Invalid format'}`);
      }
      result = isCsv(mime, fileName) 
        ? { ...parseExcelTimesheet(buffer), format: 'excel' as const }
        : parseExcelTimesheet(buffer);
    } else if (isPdf(mime, fileName)) {
      console.log('[timesheet-upload] Processing PDF file');
      const parserModule = await import('@/lib/timesheetParser');
      result = await parserModule.parsePdfTimesheet(buffer);
    } else {
      return errorResponse('Unsupported file type. Upload Excel (.xlsx/.xls), CSV, or PDF.', 400);
    }

    console.log('[timesheet-upload] Parser result:', {
      format: result.format,
      rowsCount: result.rows.length,
      warningsCount: result.warnings.length,
      startDate: result.startDate,
      endDate: result.endDate,
    });

    if (!result.startDate || !result.endDate) {
      console.warn('[timesheet-upload] Missing date range in parsed result');
    }

    const filteredRows = result.rows.filter((row) => {
      const hasName = Boolean(row.employeeName && row.employeeName.trim());
      const hasDate = Boolean(row.date);
      const hasTimeOrHours = Boolean(row.timeIn || row.timeOut || row.totalHours || row.workHours || row.workHoursActual);
      const hasAnyTimeBlock = Boolean(
        row.beforeNoonIn || row.beforeNoonOut ||
        row.afterNoonIn || row.afterNoonOut ||
        row.overtimeIn || row.overtimeOut
      );
      return hasName && hasDate && (hasTimeOrHours || hasAnyTimeBlock);
    });

    console.log('[timesheet-upload] Filtered rows:', {
      total: result.rows.length,
      filtered: filteredRows.length,
    });

    if (filteredRows.length === 0) {
      return errorResponse('No valid timesheet rows found. Please check the file format.', 400);
    }

    const timesheet = await prisma.timesheet.create({
      data: {
        fileName: file.name,
        format: result.format,
        startDate: new Date(result.startDate!),
        endDate: new Date(result.endDate!),
        totalRows: filteredRows.length,
        rows: {
          create: filteredRows.map((row) => ({
            employeeName: row.employeeName,
            userId: row.userId,
            date: new Date(row.date!),
            weekday: row.weekday,
            dept: row.dept,
            beforeNoonIn: row.beforeNoonIn,
            beforeNoonOut: row.beforeNoonOut,
            afterNoonIn: row.afterNoonIn,
            afterNoonOut: row.afterNoonOut,
            overtimeIn: row.overtimeIn,
            overtimeOut: row.overtimeOut,
            totalHours: row.totalHours,
            workHours: row.workHours,
            workHoursActual: row.workHoursActual,
            overtimeHours: row.overtimeHours,
            lateMinutes: row.lateMinutes,
            earlyMinutes: row.earlyMinutes,
            workDays: row.workDays,
            tripDays: row.tripDays,
            absenceDays: row.absenceDays,
            leaveDays: row.leaveDays,
            addPayNormal: row.addPayNormal,
            addPayOvertime: row.addPayOvertime,
            addPayAllowance: row.addPayAllowance,
            payrollDeduction: row.payrollDeduction,
            shiftCode: row.shiftCode,
            remark: row.remark,
          })),
        },
      },
      include: { rows: true },
    });

    console.log('[timesheet-upload] Saved to DB:', {
      id: timesheet.id,
      fileName: timesheet.fileName,
      rowCount: timesheet.rows.length,
    });

    return NextResponse.json({
      ok: true,
      format: result.format,
      rows: result.rows,
      warnings: result.warnings,
      startDate: result.startDate,
      endDate: result.endDate,
      timesheetId: timesheet.id,
    });
  } catch (error) {
    console.error('[timesheet-upload] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to process timesheet: ${message}`);
>>>>>>> Stashed changes
  }
}
