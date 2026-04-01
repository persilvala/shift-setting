import { NextResponse } from "next/server";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "NOT SET";
  const masked = dbUrl.replace(/\/\/.*:.*@/, "//****:****@");
  return NextResponse.json({ 
    databaseUrl: masked,
    hasDb: !!process.env.DATABASE_URL 
  });
}
