import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ 
    test: "pg test removed - using @vercel/postgres instead requires Vercel Postgres",
  });
}
