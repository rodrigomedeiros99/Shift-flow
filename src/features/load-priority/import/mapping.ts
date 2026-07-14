/**
 * Pure, client-safe helpers for the Load Priority schedule import: column
 * detection, value normalization, formula-injection sanitizing, and per-row
 * validation. Shared by the server parse action and the client review UI so the
 * two never drift. No I/O and no binary parsing here (that lives in parse.ts).
 */

export type ImportField =
  | 'door'
  | 'lane'
  | 'carrier'
  | 'close'
  | 'zone'
  | 'notes';

/** field → column index in the parsed matrix (undefined = not mapped). */
export type ColumnMapping = Partial<Record<ImportField, number>>;

/** Accepted header synonyms per field (matched case/space-insensitively). */
export const FIELD_SYNONYMS: Record<ImportField, string[]> = {
  door: ['dock door', 'door number', 'door', 'dd'],
  // A single combined "Lane or Carrier" column maps to `lane`; a numeric value
  // stays a lane and a text label (UPS, FEDEX…) is routed to carrier at build.
  lane: [
    'lane number',
    'destination lane',
    'lane or carrier',
    'lane/carrier',
    'lane / carrier',
    'lane',
  ],
  carrier: ['carrier', 'service', 'label'],
  close: ['close time', 'cut time', 'cutoff', 'departure time', 'close', 'cut'],
  zone: ['load zone', 'zone'],
  notes: ['notes', 'comments', 'note', 'comment'],
};

const canon = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Auto-detect a column mapping from the header row. */
export function detectMapping(headers: string[]): ColumnMapping {
  const norm = headers.map(canon);
  const mapping: ColumnMapping = {};
  for (const field of Object.keys(FIELD_SYNONYMS) as ImportField[]) {
    for (const syn of FIELD_SYNONYMS[field]) {
      const idx = norm.findIndex((h) => h === syn);
      if (idx !== -1) {
        mapping[field] = idx;
        break;
      }
    }
  }
  return mapping;
}

/** True once Door + Close Time are mapped — enough to skip the manual step. */
export function mappingIsConfident(mapping: ColumnMapping): boolean {
  return mapping.door !== undefined && mapping.close !== undefined;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Normalize a dock-door value: strip a leading `DOOR`/`DD`/`D` prefix and spaces
 * so `735`, `DD735`, and `Door 735` collapse to `735`. Used both for display and
 * for de-dupe keys.
 */
export function normalizeDoor(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '');
  const stripped = cleaned.replace(/^(DOOR|DD|D)\s*/, '');
  return stripped.replace(/\s+/g, '');
}

/**
 * Normalize a close time to `HH:MM` (24h). Accepts `5 PM`, `5:00 PM`, `17:00`,
 * `1700`. Returns null when the value can't be parsed (→ flagged Invalid Time).
 */
export function normalizeCloseTime(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (!s) return null;

  let m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (m) {
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    if (h < 1 || h > 12 || min > 59) return null;
    if (m[3] === 'PM' && h !== 12) h += 12;
    if (m[3] === 'AM' && h === 12) h = 0;
    return `${pad(h)}:${pad(min)}`;
  }

  m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return `${pad(h)}:${pad(min)}`;
  }

  m = s.match(/^(\d{3,4})$/);
  if (m) {
    const v = (m[1] ?? '').padStart(4, '0');
    const h = Number(v.slice(0, 2));
    const min = Number(v.slice(2));
    if (h > 23 || min > 59) return null;
    return `${pad(h)}:${pad(min)}`;
  }

  return null;
}

/**
 * Neutralize spreadsheet formula injection: a text cell starting with `= + - @`
 * is prefixed with an apostrophe so it can never execute if re-exported/opened.
 */
export function sanitizeCell(raw: string): string {
  const t = (raw ?? '').trim();
  return /^[=+\-@]/.test(t) ? `'${t}` : t;
}

export type RowStatus =
  | 'ready'
  | 'missing_door'
  | 'missing_close'
  | 'invalid_time'
  | 'unknown_zone';

export const ROW_STATUS_LABELS: Record<RowStatus, string> = {
  ready: 'Ready',
  missing_door: 'Missing Door',
  missing_close: 'Missing Close Time',
  invalid_time: 'Invalid Time',
  unknown_zone: 'Unknown Zone',
};

/** Only Ready rows may be imported (others are resolved or excluded first). */
export function isImportable(status: RowStatus): boolean {
  return status === 'ready';
}

export interface ReviewRow {
  /** Client-side row id. */
  key: string;
  include: boolean;
  door: string;
  /** Normalized door for de-dupe (derived from `door`). */
  normDoor: string;
  lane: string;
  carrier: string;
  /** `HH:MM` or '' — the parsed/edited close time. */
  closeTime: string;
  /** Original close-time text, for showing what was invalid. */
  closeRaw: string;
  zone: number | null;
  notes: string;
}

/**
 * Compute a row's validation status. Duplicate doors are allowed (a door can
 * load more than one trailer), so they're not flagged.
 */
export function rowStatus(row: ReviewRow): RowStatus {
  if (!row.door.trim()) return 'missing_door';
  if (row.closeRaw.trim() && !row.closeTime) return 'invalid_time';
  if (!row.closeTime) return 'missing_close';
  if (row.zone === null) return 'unknown_zone';
  return 'ready';
}
