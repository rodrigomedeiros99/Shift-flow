/**
 * Pure shaping helpers for History exports (Excel/PDF). No library or IO imports
 * here so this stays safe to import anywhere; the heavy `exceljs`/`jspdf`
 * modules are dynamically loaded inside the client export component. The data is
 * already RLS-scoped + role-gated by the History page, so exporting it is just
 * formatting — no new data access.
 */

export interface HistoryExportRow {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  associate: string;
  department: string;
  key: string;
  task: string;
  equipment: string;
  /** Planned | Activity. */
  source: string;
  action: string;
  by: string;
}

export interface CountRow {
  label: string;
  value: number;
}

export interface HistoryExportData {
  reportTitle: string;
  facilityName: string;
  /** Set when a single associate is selected — drives filename + summary sheet. */
  associateName: string | null;
  filters: { label: string; value: string }[];
  rows: HistoryExportRow[];
  taskUsage: CountRow[];
  associateUsage: CountRow[];
}

export const HISTORY_TABLE_COLUMNS = [
  'Date',
  'Associate',
  'Department',
  'Key',
  'Task',
  'Equipment',
  'Source',
  'Action',
  'By',
] as const;

/** Safe download filename, e.g. "Michelle Brown History.xlsx". */
export function historyFilename(
  associateName: string | null,
  ext: 'xlsx' | 'pdf',
): string {
  const base = associateName ? `${associateName} History` : 'ShiftFlow History';
  return `${base.replace(/[\\/:*?"<>|]/g, '').trim()}.${ext}`;
}

/** Trigger a browser download for a built file blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
