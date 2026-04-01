import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const admin = await prisma.admin.findUnique({
      where: { username: "admin" },
    });
    
    return NextResponse.json({ 
      success: true,
      adminFound: !!admin,
      adminId: admin?.id,
      username: admin?.username,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const code = (error as Record<string, unknown>).code;
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
    return NextResponse.json({ 
      success: false,
      error: message,
      code,
      cause,
    }, { status: 500 });
  }
}
