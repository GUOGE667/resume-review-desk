// Quote every CSV field and keep untrusted names/reasons as spreadsheet text.
// This reduces formula execution risk when a downloaded CSV is opened directly.
const FORMULA_PREFIX = /^[\s\u0000-\u001f\u007f\u200b-\u200d\u2060\ufeff]*[=+\-@]/u;

export function csvCell(value) {
  let text = String(value ?? '');
  if (FORMULA_PREFIX.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializeCsv(header, rows) {
  return '\ufeff' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}
