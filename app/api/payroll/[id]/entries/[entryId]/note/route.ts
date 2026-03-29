import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"

type Params = {
  params: Promise<{ id: string; entryId: string }>
}

function parseId(id: string): number | null {
  const parsed = Number(id)
  return Number.isFinite(parsed) ? parsed : null
}

type UpdateNoteRequest = {
  note: string
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.name) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const username = session.user.name

    const { id: payrollId, entryId } = await params
    const payrollInt = parseId(payrollId)
    const entryInt = parseId(entryId)

    if (payrollInt === null || entryInt === null) {
      return NextResponse.json({ ok: false, error: "Invalid payroll or entry id" }, { status: 400 })
    }

    const body = (await request.json()) as UpdateNoteRequest

    if (typeof body.note !== "string") {
      return NextResponse.json({ ok: false, error: "Note must be a string" }, { status: 400 })
    }

    const existingEntry = await prisma.payrollEntry.findUnique({
      where: { id: entryInt },
    })

    if (!existingEntry) {
      return NextResponse.json({ ok: false, error: "Entry not found" }, { status: 404 })
    }

    const isNewNote = !existingEntry.note && body.note

    const updatedEntry = await prisma.payrollEntry.update({
      where: { id: entryInt },
      data: {
        note: body.note,
        noteEditedBy: username,
        noteEditedAt: new Date(),
        ...(isNewNote && {
          noteCreatedBy: username,
          noteCreatedAt: new Date(),
        }),
      },
    })

    console.log("Payroll entry note updated:", {
      id: updatedEntry.id,
      employeeId: updatedEntry.employeeId,
      payrollId,
      note: updatedEntry.note,
      noteCreatedBy: updatedEntry.noteCreatedBy,
      noteEditedBy: updatedEntry.noteEditedBy,
    })

    return NextResponse.json({
      ok: true,
      entry: {
        id: updatedEntry.id,
        note: updatedEntry.note,
        noteCreatedBy: updatedEntry.noteCreatedBy,
        noteCreatedAt: updatedEntry.noteCreatedAt?.toISOString() ?? null,
        noteEditedBy: updatedEntry.noteEditedBy,
        noteEditedAt: updatedEntry.noteEditedAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error("Failed to update payroll entry note:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { ok: false, error: `Failed to update note: ${message}` },
      { status: 500 }
    )
  }
}
