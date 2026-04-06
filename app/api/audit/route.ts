import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const adminFilter = searchParams.get("admin")
    const dateFilter = searchParams.get("date")
    const page = parseInt(searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(searchParams.get("pageSize") ?? "10", 10)

    const where: Record<string, unknown> = {}

    if (adminFilter) {
      where.adminName = { contains: adminFilter, mode: "insensitive" }
    }

    if (dateFilter) {
      const startDate = new Date(dateFilter)
      const endDate = new Date(dateFilter)
      endDate.setDate(endDate.getDate() + 1)
      where.createdAt = { gte: startDate, lt: endDate }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error("Failed to fetch audit logs:", error)
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 })
  }
}
