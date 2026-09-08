/**
 * CSV export for the code batches the teacher hands out on paper.
 *
 * Two details that are easy to get wrong and both break Excel on an Arabic
 * Windows install:
 *
 * 1. The UTF-8 BOM. Without it Excel reads the file in the system codepage and
 *    every Arabic lecture title becomes mojibake. Google Sheets does not need
 *    it and does not mind it.
 * 2. CRLF line endings, for the same reason — Excel is the target here, not a
 *    Unix pipeline.
 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value ?? '');
    // Quote whenever the value could otherwise split a cell. Doubling an
    // existing quote is the CSV escape, not a backslash.
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const body = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
