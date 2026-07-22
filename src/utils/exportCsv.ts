// Massivni CSV ga aylantirib brauzerda yuklab olish.
// Excel mos kelishi uchun BOM qo'shamiz va RFC 4180 ga rioya qilamiz —
// vergullar va tirnoqlar to'g'ri escape qilinadi.

interface ExportOptions {
  filename: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
}

export function csvEscape(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  // CSV formula injection himoyasi: = + - @ (yoki tab/CR) bilan boshlangan kataklarni
  // ' bilan neytrallashtiramiz — Excel/Sheets =HYPERLINK/=cmd|... bajarmasin
  // (ism/izoh mijozdan keladigan ishonchsiz matn bo'lishi mumkin).
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  // Vergul, tirnoq yoki yangi qator bo'lsa — tirnoqlash kerak
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportToCsv({ filename, columns, rows }: ExportOptions): void {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => csvEscape(row[c.key])).join(","))
    .join("\r\n");

  // BOM qo'shilsa Excel UTF-8 ni to'g'ri o'qiydi —
  // kirillcha va boshqa non-ASCII belgilar to'g'ri ko'rinadi.
  const content = "\uFEFF" + header + "\r\n" + body;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // URL'ni darhol revoke qilmaymiz — ba'zi brauzerlarda download tugamasdan
  // revoke bo'lsa fayl ko'p marta yuklanmaydi. setTimeout bilan kichik kechikish.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
