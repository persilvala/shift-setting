"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"

type AuditStatus = "Success" | "Failed" | "Cancelled" | "Info"

interface LogAuditParams {
  action: string
  description: string
  status: AuditStatus
  metadata?: Record<string, unknown>
}

export async function logAuditEvent({
  action,
  description,
  status,
  metadata,
}: LogAuditParams): Promise<{ success: boolean }> {
  try {
    const session = await auth()
    const adminId = session?.user?.id ?? null
    const adminName = (session?.user?.name as string) ?? "System"

    await prisma.auditLog.create({
      data: {
        action,
        adminId,
        adminName,
        description,
        status,
        metadata: metadata as object | undefined,
      },
    })

    return { success: true }
  } catch (error) {
    console.error("Audit log error:", error)
    return { success: false }
  }
}
