import { NextResponse } from 'next/server';
import { parseExcelTimesheet } from '@/lib/timesheetParser';
import { prisma } from '@/lib/db';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

function isExcel(mime: string | undefined, name: string) {
  const loweredMime = mime?.toLowerCase() ?? '';
  return (
    loweredMime.includes('spreadsheet') ||
    loweredMime.includes('excel') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls')
  );
}

function isPdf(mime: string | undefined, name: string) {
  const loweredMime = mime?.toLowerCase() ?? '';
  return loweredMime.includes('pdf') || name.endsWith('.pdf');
}

function isCsv(mime: string | undefined, name: string) {
  const loweredMime = mime?.toLowerCase() ?? '';
  return loweredMime.includes('csv') || name.endsWith('.csv');
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'File is required' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = file.name?.toLowerCase() ?? '';
  const mime = file.type?.toLowerCase();

  try {
    // Parse the file first
    let result;
    if (isExcel(mime, fileName) || isCsv(mime, fileName)) {
      const wb = XLSX.read(buffer, { type: 'buffer', raw: true });
      result = isCsv(mime, fileName) 
        ? { ...parseExcelTimesheet(buffer), format: 'excel' as const }
        : parseExcelTimesheet(buffer);
    } else if (isPdf(mime, fileName)) {
      result = await import('@/lib/timesheetParser').then(m => m.parsePdfTimesheet(buffer));
    } else {
      return NextResponse.json(
        { ok: false, error: 'Unsupported file type. Upload Excel (.xlsx/.xls), CSV, or PDF.' },
        { status: 400 }
      );
    }

    // Save to database
    const timesheet = await prisma.timesheet.create({
      data: {
        fileName: file.name,
        format: result.format,
        startDate: new Date(result.startDate!),
        endDate: new Date(result.endDate!),
        totalRows: result.rows.length,
        rows: {
          create: result.rows
            .filter(row => row.date)
            .map(row => ({
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

    console.log("✓ Timesheet saved to DB:", {
      id: timesheet.id,
      fileName: timesheet.fileName,
      rowCount: timesheet.rows.length,
      uploadedAt: timesheet.uploadedAt,
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
    console.error('timesheet upload parse error', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, error: `Failed to parse timesheet: ${message}` },
      { status: 500 }
    );
  }
}
