export type Row = Record<string, string | number | null | undefined>;

export function downloadBlob(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Row[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

export function exportCsv(filename: string, rows: Row[]) {
  downloadBlob(filename, toCsv(rows), "text/csv;charset=utf-8");
}

export function exportJson(filename: string, data: unknown) {
  downloadBlob(filename, JSON.stringify(data, null, 2), "application/json");
}

export async function exportPdf(filename: string, title: string, rows: Row[], summary: Row) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(new Date().toLocaleString(), 14, 25);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 32,
    head: [Object.keys(summary)],
    body: [Object.values(summary).map((v) => String(v ?? ""))],
    theme: "grid",
    headStyles: { fillColor: [230, 126, 34] },
    styles: { fontSize: 9 },
  });

  if (rows.length) {
    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
      head: [Object.keys(rows[0]!)],
      body: rows.map((r) => Object.values(r).map((v) => String(v ?? ""))),
      theme: "striped",
      headStyles: { fillColor: [230, 126, 34] },
      styles: { fontSize: 8 },
    });
  }

  doc.save(filename);
}
