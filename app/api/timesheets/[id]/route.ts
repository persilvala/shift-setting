import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const timesheet = await prisma.timesheet.findUnique({
      where: { id },
      include: {
        rows: {
          orderBy: [{ date: 'asc' }, { employeeName: 'asc' }],
        },
      },
    });

    if (!timesheet) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });
    }

    // Convert dates to strings for JSON serialization
    const serializedTimesheet = {
      ...timesheet,
      startDate: timesheet.startDate.toISOString(),
      endDate: timesheet.endDate.toISOString(),
      uploadedAt: timesheet.uploadedAt.toISOString(),
      rows: timesheet.rows.map(row => ({
        ...row,
        date: row.date.toISOString(),
        createdAt: row.createdAt.toISOString(),
      })),
    };

    return NextResponse.json({ timesheet: serializedTimesheet });
  } catch (error) {
    console.error('Failed to fetch timesheet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timesheet' },
      { status: 500 }
    );
  }
}
