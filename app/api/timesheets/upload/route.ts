import { NextResponse } from "next/server";
import { parseCsvTimesheet, parseExcelTimesheet, parsePdfTimesheet } from "@/lib/timesheetParser";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

function isExcel(mime: string | undefined, name: string) {
  const loweredMime = mime?.toLowerCase() ?? "";
  return (
    loweredMime.includes("spreadsheet") ||
    loweredMime.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  );
}

function isPdf(mime: string | undefined, name: string) {
  const loweredMime = mime?.toLowerCase() ?? "";
  return loweredMime.includes("pdf") || name.endsWith(".pdf");
}

function isCsv(mime: string | undefined, name: string) {
  const loweredMime = mime?.toLowerCase() ?? "";
  return loweredMime.includes("csv") || name.endsWith(".csv");
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "File is required" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = file.name?.toLowerCase() ?? "";
  const mime = file.type?.toLowerCase();

  try {
    if (isExcel(mime, fileName)) {
      const wb = XLSX.read(buffer, { type: "buffer", raw: true });
      const sheets = wb.SheetNames.map((name) => ({
        name,
        grid: XLSX.utils.sheet_to_json<(string | number | Date | undefined)[]>(wb.Sheets[name], {
          header: 1,
          raw: true,
        }),
      }));
      const result = parseExcelTimesheet(buffer);
      return NextResponse.json({ ok: true, format: "excel", rows: result.rows, warnings: result.warnings, sheets });
    }

    if (isCsv(mime, fileName)) {
      const wb = XLSX.read(buffer, { type: "buffer", raw: true });
      const sheets = wb.SheetNames.map((name) => ({
        name,
        grid: XLSX.utils.sheet_to_json<(string | number | Date | undefined)[]>(wb.Sheets[name], {
          header: 1,
          raw: true,
        }),
      }));
      const result = parseCsvTimesheet(buffer);
      return NextResponse.json({ ok: true, format: "excel", rows: result.rows, warnings: result.warnings, sheets });
    }

    if (isPdf(mime, fileName)) {
      const result = await parsePdfTimesheet(buffer);
      return NextResponse.json({ ok: true, format: "pdf", rows: result.rows, warnings: result.warnings, sheets: [] });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported file type. Upload Excel (.xlsx/.xls), CSV, or PDF." },
      { status: 400 }
    );
  } catch (error) {
    console.error("timesheet upload parse error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Failed to parse timesheet: ${message}` },
      { status: 500 }
    );
  }
}
