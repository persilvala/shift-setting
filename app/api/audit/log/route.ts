import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"

type AuditLogInput = {
  action: string
  description: string
  status: string
  adminName?: string
  metadata?: Prisma.InputJsonValue
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AuditLogInput

    const { action, description, status, adminName = "Admin", metadata } = body

    if (!action || !description || !status) {
      return NextResponse.json(
        { error: "Missing required fields: action, description, status" },
        { status: 400 },
      )
    }

    const log = await prisma.auditLog.create({
      data: {
        action,
        description,
        status,
        adminName,
        metadata: metadata ?? undefined,
      },
    })

    return NextResponse.json({ ok: true, log })
  } catch (error) {
    console.error("Failed to create audit log:", error)
    return NextResponse.json({ error: "Failed to create audit log" }, { status: 500 })
  }
}