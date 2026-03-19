import { NextResponse } from 'next/server';
import { parseExcelTimesheet } from '@/lib/timesheetParser';
import type { ParsedTimesheetRow, AttendanceStatus } from '@/lib/types';
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

function countTimeFields(row: ParsedTimesheetRow) {
  let count = 0;
  if (row.beforeNoonIn) count++;
  if (row.beforeNoonOut) count++;
  if (row.afterNoonIn) count++;
  if (row.afterNoonOut) count++;
  if (row.overtimeIn) count++;
  if (row.overtimeOut) count++;
  if (row.timeIn) count++;
  if (row.timeOut) count++;
  if (row.totalHours) count++;
  return count;
}

function normalizeParsedRow(row: ParsedTimesheetRow): ParsedTimesheetRow {
  return {
    ...row,
    employeeName: row.employeeName?.trim() ?? '',
    dept: row.dept?.trim() ?? null,
    attendanceStatus: (row.attendanceStatus ?? 'full_day') as AttendanceStatus,
  };
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

    const filteredRows = result.rows
      .map(normalizeParsedRow)
      .filter((row) => {
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

    const dedupMap = new Map<string, ParsedTimesheetRow>();
    filteredRows.forEach((row) => {
      const key = `${row.employeeName.toLowerCase()}|${row.date}`;
      const existing = dedupMap.get(key);
      if (!existing || countTimeFields(row) > countTimeFields(existing)) {
        dedupMap.set(key, row);
      }
    });

    const dedupedRows = Array.from(dedupMap.values());

    const dateValues = dedupedRows
      .map((row) => row.date ? new Date(row.date) : null)
      .filter((d): d is Date => Boolean(d) && !Number.isNaN(d!.getTime()));

    const startDateFromRows = dateValues.length ? new Date(Math.min(...dateValues.map((d) => d.getTime()))) : null;
    const endDateFromRows = dateValues.length ? new Date(Math.max(...dateValues.map((d) => d.getTime()))) : null;

    if (!dedupedRows.length || !startDateFromRows || !endDateFromRows) {
      return NextResponse.json({ ok: false, error: 'No usable timesheet rows were found.' }, { status: 400 });
    }

    const uniqueEmployeeNames = [...new Set(dedupedRows.map(row => row.employeeName).filter(Boolean))];

    const employeeRecords = await Promise.all(
      uniqueEmployeeNames.map(async (name) => {
        const existing = await prisma.employee.findFirst({
          where: { employeeName: name },
        });
        if (existing) {
          return { name, employee: existing };
        }
        const employee = await prisma.employee.create({
          data: { employeeName: name },
        });
        return { name, employee };
      })
    );

    const employeeMap = new Map(employeeRecords.map(r => [r.name, r.employee]));

    const timesheet = await prisma.timesheet.create({
      data: {
        fileName: file.name,
        format: result.format,
        startDate: result.startDate ? new Date(result.startDate) : startDateFromRows,
        endDate: result.endDate ? new Date(result.endDate) : endDateFromRows,
        totalRows: dedupedRows.length,
        rows: {
          create: dedupedRows.map((row) => {
            const employee = employeeMap.get(row.employeeName);
            const isAbsent = row.attendanceStatus === 'absent';
            const totalHours = isAbsent ? null : row.totalHours ?? row.workHours ?? row.workHoursActual ?? null;
            const timeIn = isAbsent ? null : row.timeIn ?? row.beforeNoonIn ?? null;
            const timeOut = isAbsent ? null : row.timeOut ?? row.beforeNoonOut ?? null;
            return {
              employeeName: row.employeeName,
              employeeId: employee?.id,
              userId: row.userId,
              date: new Date(row.date!),
              weekday: row.weekday,
              dept: row.dept,
              beforeNoonIn: timeIn,
              beforeNoonOut: timeOut,
              afterNoonIn: row.afterNoonIn,
              afterNoonOut: row.afterNoonOut,
              overtimeIn: row.overtimeIn,
              overtimeOut: row.overtimeOut,
              totalHours,
              workHours: row.workHours ?? totalHours,
              workHoursActual: row.workHoursActual ?? totalHours,
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
              attendanceStatus: row.attendanceStatus ?? 'full_day',
            };
          }),
        },
      },
      include: { rows: true },
    });

    console.log("✓ Timesheet saved to DB:", {
      id: timesheet.id,
      fileName: timesheet.fileName,
      rowCount: timesheet.rows.length,
      uploadedAt: timesheet.uploadedAt,
      employeesCreated: employeeRecords.filter(r => !employeeMap.get(r.name)).length,
    });

    return NextResponse.json({
      ok: true,
      format: result.format,
      rows: timesheet.rows.map((row) => ({
        employeeName: row.employeeName,
        date: row.date.toISOString().slice(0, 10),
        timeIn: row.beforeNoonIn ?? null,
        timeOut: row.beforeNoonOut ?? null,
        totalHours: row.totalHours ?? row.workHours ?? null,
        issues: [],
        sourceLine: 0,
        dept: row.dept,
        userId: row.userId,
        employeeId: row.employeeId ?? undefined,
        attendanceStatus: (row.attendanceStatus as AttendanceStatus) ?? 'full_day',
      })),
      warnings: result.warnings,
      startDate: result.startDate ?? startDateFromRows?.toISOString().slice(0, 10),
      endDate: result.endDate ?? endDateFromRows?.toISOString().slice(0, 10),
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
