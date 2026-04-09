import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const timesheets = await prisma.timesheet.findMany({
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        format: true,
        startDate: true,
        endDate: true,
        totalRows: true,
        uploadedAt: true,
        _count: { select: { rows: true } },
      },
    });

    return NextResponse.json({ timesheets });
  } catch (error) {
    console.error('Failed to fetch timesheets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timesheets' },
      { status: 500 }
    );
  }
}
