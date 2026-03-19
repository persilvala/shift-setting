import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const pendingTimesheets = await prisma.timesheet.findMany({
      where: {
        payrolls: {
          none: {},
        },
      },
      include: {
        _count: {
          select: { rows: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    console.log("[Pending API] Found timesheets:", pendingTimesheets.length);
    console.log("[Pending API] Timesheet IDs:", pendingTimesheets.map(t => t.id));

    const result = pendingTimesheets.map((ts) => ({
      id: ts.id,
      fileName: ts.fileName,
      format: ts.format,
      entrySource: ts.entrySource,
      startDate: ts.startDate.toISOString().slice(0, 10),
      endDate: ts.endDate.toISOString().slice(0, 10),
      uploadedAt: ts.uploadedAt.toISOString(),
      totalRows: ts.totalRows,
      employeeCount: ts.totalRows,
    }));

    return NextResponse.json({
      ok: true,
      timesheets: result,
    });
  } catch (error) {
    console.error('Failed to fetch pending timesheets:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch pending timesheets' },
      { status: 500 }
    );
  }
}
