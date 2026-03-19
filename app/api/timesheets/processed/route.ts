import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateFilter = searchParams.get('startDate');
    const endDateFilter = searchParams.get('endDate');

    const whereClause: {
      payrolls: { some: Record<string, never> };
      startDate?: { gte?: Date; lte?: Date };
      endDate?: { gte?: Date; lte?: Date };
    } = {
      payrolls: {
        some: {},
      },
    };

    if (startDateFilter) {
      whereClause.startDate = {
        gte: new Date(startDateFilter),
      };
    }

    if (endDateFilter) {
      whereClause.endDate = {
        lte: new Date(endDateFilter),
      };
    }

    const processedTimesheets = await prisma.timesheet.findMany({
      where: whereClause,
      include: {
        payrolls: {
          select: {
            id: true,
            totalNetPay: true,
            basePayPerDay: true,
            createdAt: true,
          },
        },
        _count: {
          select: { rows: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    const result = processedTimesheets.map((ts) => ({
      id: ts.id,
      fileName: ts.fileName,
      format: ts.format,
      entrySource: ts.entrySource,
      startDate: ts.startDate.toISOString().slice(0, 10),
      endDate: ts.endDate.toISOString().slice(0, 10),
      uploadedAt: ts.uploadedAt.toISOString(),
      totalRows: ts.totalRows,
      employeeCount: ts.totalRows,
      payrolls: ts.payrolls.map((p: { id: string; totalNetPay: number; basePayPerDay: number; createdAt: Date }) => ({
        id: p.id,
        totalNetPay: p.totalNetPay,
        basePayPerDay: p.basePayPerDay,
        createdAt: p.createdAt.toISOString(),
      })),
    }));

    return NextResponse.json({
      ok: true,
      timesheets: result,
    });
  } catch (error) {
    console.error('Failed to fetch processed timesheets:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch processed timesheets' },
      { status: 500 }
    );
  }
}
