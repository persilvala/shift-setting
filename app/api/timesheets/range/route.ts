import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { AttendanceStatus, ParsedTimesheetRow } from "@/lib/types"
import type { Prisma } from "@prisma/client"

type RowForMap = {
  id: number
  employeeName: string
  employeeId: number | null
  date: Date
  beforeNoonIn: string | null
  beforeNoonOut: string | null
  totalHours: number | null
  workHours: number | null
  dept: string | null
  userId: string | null
  attendanceStatus: string
  timesheet: {
    id: number
    startDate: Date
    endDate: Date
    uploadedAt: Date
    fileName: string | null
    format: string
  }
}

function mapRow(row: RowForMap): ParsedTimesheetRow {
  return {
    id: row.id,
    employeeName: row.employeeName,
    employeeId: row.employeeId ?? undefined,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
    timeIn: row.beforeNoonIn ?? null,
    timeOut: row.beforeNoonOut ?? null,
    totalHours: row.totalHours ?? row.workHours ?? null,
    issues: [],
    sourceLine: 0,
    dept: row.dept ?? null,
    userId: row.userId ?? null,
    attendanceStatus: (row.attendanceStatus as AttendanceStatus) ?? "full_day",
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const employeeId = searchParams.get("employeeId")
  const employeeName = searchParams.get("employeeName")

  if (!startDate || !endDate) {
    return NextResponse.json(
      { ok: false, error: "startDate and endDate are required" },
      { status: 400 },
    )
  }

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json(
      { ok: false, error: "Invalid date range" },
      { status: 400 },
    )
  }

  if (start >= end) {
    return NextResponse.json(
      { ok: false, error: "startDate must be earlier than endDate" },
      { status: 400 },
    )
  }

  const where: Prisma.TimesheetRowWhereInput = {
    date: {
      gte: start,
      lte: end,
    },
  }

  if (employeeId) {
    const idNum = Number(employeeId)
    if (!Number.isNaN(idNum)) {
      where.employeeId = idNum
    }
  } else if (employeeName) {
    where.employeeName = employeeName
  }

  try {
    const rows = await prisma.timesheetRow.findMany({
      where,
      orderBy: [{ employeeName: "asc" }, { date: "asc" }],
      include: {
        timesheet: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            uploadedAt: true,
            fileName: true,
            format: true,
          },
        },
      },
    })

    const mapped = rows.map(mapRow)
    const timesheets = Array.from(
      new Map(
        rows.map((row) => [
          row.timesheet.id,
          {
            id: row.timesheet.id,
            startDate: row.timesheet.startDate.toISOString(),
            endDate: row.timesheet.endDate.toISOString(),
            uploadedAt: row.timesheet.uploadedAt.toISOString(),
            fileName: row.timesheet.fileName,
            format: row.timesheet.format,
          },
        ]),
      ).values(),
    )

    return NextResponse.json({ ok: true, rows: mapped, timesheets })
  } catch (error) {
    console.error("Failed to load timesheets for range:", error)
    const message = error instanceof Error ? error.message : "Failed to load range"
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    )
  }
}
