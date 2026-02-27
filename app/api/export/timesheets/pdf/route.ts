import { NextResponse } from "next/server";
import { dateRange, timesheetRows } from "@/lib/timesheetData";

function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export async function GET() {
  const headerLine = `Shift Setting Table — ${dateRange}`;
  const columnsLine = "User ID | Name | Department | Mo | Tu | We | Th | Fr | Sa | Su";
  const bodyLines = timesheetRows.map(
    (row) =>
      `${row.id} | ${row.name} | ${row.dept} | ${row.week.Mo} | ${row.week.Tu} | ${row.week.We} | ${row.week.Th} | ${row.week.Fr} | ${row.week.Sa} | ${row.week.Su}`
  );

  const lines = [headerLine, "", columnsLine, "", ...bodyLines];

  const contentLines = lines
    .map((line, idx) => `BT /F1 12 Tf 40 ${760 - idx * 16} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n");

  const stream = `${contentLines}`;
  const streamBuffer = Buffer.from(stream, "utf-8");

  const objects: string[] = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj`
  );
  objects.push(
    `4 0 obj\n<< /Length ${streamBuffer.length} >>\nstream\n${stream}\nendstream\nendobj`
  );

  const header = "%PDF-1.4\n";
  let offset = header.length;
  const xrefEntries: string[] = ["0000000000 65535 f "];
  let body = "";

  for (let i = 0; i < objects.length; i++) {
    xrefEntries.push(String(offset).padStart(10, "0") + " 00000 n ");
    const chunk = objects[i] + "\n";
    body += chunk;
    offset += chunk.length;
  }

  const xrefOffset = header.length + body.length;
  const xref = `xref\n0 ${objects.length + 1}\n${xrefEntries.join("\n")}\n`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const pdfBuffer = Buffer.concat([
    Buffer.from(header, "utf-8"),
    Buffer.from(body, "utf-8"),
    Buffer.from(xref, "utf-8"),
    Buffer.from(trailer, "utf-8"),
  ]);

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=timesheets.pdf",
    },
  });
}
