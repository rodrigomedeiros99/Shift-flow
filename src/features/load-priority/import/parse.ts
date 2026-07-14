import 'server-only';

import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';

/** A parsed spreadsheet reduced to a header row + string data rows. */
export interface ParsedMatrix {
  headers: string[];
  rows: string[][];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Best-effort convert an ExcelJS cell value to a trimmed string. */
function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return `${pad(v.getHours())}:${pad(v.getMinutes())}`;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text.trim();
    if ('result' in o) return cellToString(o.result);
    if (Array.isArray(o.richText))
      return (o.richText as { text?: string }[])
        .map((r) => r.text ?? '')
        .join('')
        .trim();
    if (typeof o.hyperlink === 'string' && typeof o.text === 'string')
      return String(o.text).trim();
  }
  return String(v).trim();
}

/**
 * Parse an .xlsx or .csv buffer into a header row + data rows. Runs server-side
 * only. Legacy .xls is not supported (v1) — callers reject it before here.
 */
export async function parseWorkbook(
  buffer: Buffer,
  kind: 'xlsx' | 'csv',
): Promise<ParsedMatrix> {
  const workbook = new ExcelJS.Workbook();
  let worksheet: ExcelJS.Worksheet | undefined;

  if (kind === 'csv') {
    worksheet = await workbook.csv.read(Readable.from(buffer.toString('utf8')));
  } else {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    worksheet = workbook.worksheets[0];
  }
  if (!worksheet) return { headers: [], rows: [] };

  const matrix: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[]; // 1-indexed; [0] is empty
    const cells: string[] = [];
    for (let c = 1; c < values.length; c++) cells.push(cellToString(values[c]));
    matrix.push(cells);
  });

  // Drop fully blank rows and pad to a uniform width.
  const nonEmpty = matrix.filter((r) => r.some((c) => c !== ''));
  const width = nonEmpty.reduce((w, r) => Math.max(w, r.length), 0);
  const padded = nonEmpty.map((r) => {
    const copy = [...r];
    while (copy.length < width) copy.push('');
    return copy;
  });

  return { headers: padded[0] ?? [], rows: padded.slice(1) };
}
