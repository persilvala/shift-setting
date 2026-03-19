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

    const names = Array.from(new Set(dedupedRows.map((r) => r.employeeName).filter(Boolean)));

    let deptMap = new Map<string, string | null>();
    let employeeMap = new Map<string, { id: string; employeeName: string }>();

    if (names.length) {
      const [existingRows, employees] = await Promise.all([
        prisma.timesheetRow.findMany({
          where: { employeeName: { in: names } },
          select: { employeeName: true, dept: true },
        }),
        prisma.employee.findMany({
          where: { employeeName: { in: names } },
          select: { id: true, employeeName: true },
        }),
      ]);

      deptMap = new Map(
        existingRows
          .filter((r) => r.dept)
          .map((r) => [r.employeeName, r.dept as string])
      );

      employeeMap = new Map(employees.map((emp) => [emp.employeeName.toLowerCase(), emp]));
    }

    const decorateIncoming = (row: ParsedTimesheetRow): ParsedTimesheetRow => {
      const employee = employeeMap.get(row.employeeName.toLowerCase());
      const existingDept = deptMap.get(row.employeeName);
      return {
        ...row,
        employeeId: employee?.id ?? row.employeeId,
        dept: existingDept ? existingDept : row.dept,
      };
    };

    const incomingRows = dedupedRows.map(decorateIncoming);

    // Pull existing persisted rows for identity-linked merge
    const existingRowsForEmployees = names.length
      ? await prisma.timesheetRow.findMany({
          where: {
            OR: [
              { employeeName: { in: names } },
              { employeeId: { in: Array.from(employeeMap.values()).map((e) => e.id) } },
            ],
          },
          orderBy: [{ date: 'asc' }, { employeeName: 'asc' }],
        })
      : [];

    const existingParsed = existingRowsForEmployees.map((row) => ({
      employeeName: row.employeeName,
      employeeId: row.employeeId ?? employeeMap.get(row.employeeName.toLowerCase())?.id,
      date: row.date.toISOString().slice(0, 10),
      timeIn: row.beforeNoonIn ?? null,
      timeOut: row.beforeNoonOut ?? null,
      totalHours: row.totalHours ?? row.workHours ?? null,
      issues: [],
      sourceLine: 0,
      dept: row.dept ?? null,
      userId: row.userId ?? null,
      attendanceStatus: (row.attendanceStatus as AttendanceStatus) ?? 'full_day',
    } satisfies ParsedTimesheetRow));

    const mergedMap = new Map<string, ParsedTimesheetRow>();
    const keyFor = (row: ParsedTimesheetRow) => {
      const empKey = (row.employeeId ?? row.employeeName ?? '').toLowerCase();
      return `${empKey}|${row.date ?? ''}`;
    };

    existingParsed.forEach((row) => mergedMap.set(keyFor(row), row));
    incomingRows.forEach((row) => {
      const key = keyFor(row);
      const existing = mergedMap.get(key);
      if (existing) {
        const existingHours = (existing.totalHours ?? existing.workHours ?? 0) as number;
        const incomingHours = (row.totalHours ?? row.workHours ?? 0) as number;
        mergedMap.set(key, {
          ...existing,
          ...row,
          totalHours: existingHours + incomingHours,
          workHours: existingHours + incomingHours,
        });
      } else {
        mergedMap.set(key, row);
      }
    });

    const mergedRows = Array.from(mergedMap.values());

    const dateValues = mergedRows
      .map((row) => (row.date ? new Date(row.date) : null))
      .filter((d): d is Date => Boolean(d) && !Number.isNaN(d!.getTime()));

    const startDateFromRows = dateValues.length ? new Date(Math.min(...dateValues.map((d) => d.getTime()))) : null;
    const endDateFromRows = dateValues.length ? new Date(Math.max(...dateValues.map((d) => d.getTime()))) : null;

    if (!mergedRows.length || !startDateFromRows || !endDateFromRows) {
      return NextResponse.json({ ok: false, error: 'No usable timesheet rows were found.' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      format: result.format,
      rows: mergedRows,
      warnings: result.warnings,
      startDate: result.startDate ?? startDateFromRows?.toISOString().slice(0, 10),
      endDate: result.endDate ?? endDateFromRows?.toISOString().slice(0, 10),
      timesheetId: null,
      mergedFromDatabaseCount: existingParsed.length,
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
