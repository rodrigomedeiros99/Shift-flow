'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud } from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Modal,
  Select,
  useToast,
} from '@/components/ui';
import { Field } from '@/components/config/field';
import { createBoard } from '@/features/load-priority/actions';
import {
  importEntries,
  importWeekly,
  parseSchedule,
  type ParseScheduleResult,
} from '@/features/load-priority/import/actions';
import {
  ROW_STATUS_LABELS,
  isImportable,
  mappingIsConfident,
  normalizeCloseTime,
  normalizeDoor,
  rowStatus,
  sanitizeCell,
  type ColumnMapping,
  type ImportField,
  type ReviewRow,
  type RowStatus,
} from '@/features/load-priority/import/mapping';
import { formatCloseTime } from '@/features/load-priority/urgency';
import {
  deriveZone,
  weekdayLabel,
  weekdayOf,
  WEEKDAYS_MON_FIRST,
} from '@/features/load-priority/zones';
import type { BadgeTone } from '@/components/ui/badge';

type ParseData = Extract<ParseScheduleResult, { ok: true }>;
type ImportTarget = 'daily' | 'weekly';

const STATUS_TONE: Record<RowStatus, BadgeTone> = {
  ready: 'success',
  missing_door: 'danger',
  missing_close: 'danger',
  invalid_time: 'danger',
  unknown_zone: 'warning',
};

const MAP_FIELDS: { field: ImportField; label: string; required?: boolean }[] =
  [
    { field: 'door', label: 'Dock Door', required: true },
    { field: 'lane', label: 'Lane' },
    { field: 'carrier', label: 'Carrier' },
    { field: 'close', label: 'Close Time', required: true },
    { field: 'zone', label: 'Zone' },
    { field: 'notes', label: 'Notes' },
  ];

let rowSeq = 0;

function buildRows(data: ParseData, mapping: ColumnMapping): ReviewRow[] {
  const cellOf = (row: string[], field: ImportField) =>
    mapping[field] !== undefined ? (row[mapping[field]!] ?? '') : '';

  return data.rows
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => {
      const rawDoor = cellOf(r, 'door');
      const door = rawDoor.trim() ? normalizeDoor(rawDoor) : '';
      const closeRaw = cellOf(r, 'close');
      const zoneCell = cellOf(r, 'zone')
        .replace(/[^0-9]/g, '')
        .trim();
      const zoneFromFile = zoneCell ? Number(zoneCell) : NaN;
      const zone =
        Number.isFinite(zoneFromFile) && zoneFromFile > 0
          ? zoneFromFile
          : deriveZone(door, data.zones);
      // A combined "Lane or Carrier" column maps to lane: a plain number is a
      // lane, anything else (UPS, FEDEX…) is a carrier label.
      let lane = sanitizeCell(cellOf(r, 'lane'));
      let carrier = sanitizeCell(cellOf(r, 'carrier'));
      if (lane && !carrier && !/^\d+$/.test(lane)) {
        carrier = lane;
        lane = '';
      }
      return {
        key: `row-${rowSeq++}`,
        include: true,
        door,
        normDoor: normalizeDoor(door),
        lane,
        carrier,
        closeTime: normalizeCloseTime(closeRaw) ?? '',
        closeRaw,
        zone,
        notes: sanitizeCell(cellOf(r, 'notes')),
      };
    });
}

export function LpImportDialog({
  open,
  onClose,
  shiftKeyId,
  boardDate,
}: {
  open: boolean;
  onClose: () => void;
  shiftKeyId: string;
  boardDate: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'review'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [data, setData] = useState<ParseData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [target, setTarget] = useState<ImportTarget>('daily');
  const [weekday, setWeekday] = useState(() => weekdayOf(boardDate));

  function reset() {
    setStep('upload');
    setFile(null);
    setDragActive(false);
    setData(null);
    setMapping({});
    setRows([]);
    setTarget('daily');
    setWeekday(weekdayOf(boardDate));
  }
  function close() {
    reset();
    onClose();
  }

  async function doParse() {
    if (!file) return;
    setPending(true);
    const fd = new FormData();
    fd.set('file', file);
    fd.set('shiftKeyId', shiftKeyId);
    fd.set('boardDate', boardDate);
    const result = await parseSchedule(fd);
    setPending(false);
    if (!result.ok) {
      toast({
        title: 'Could not read file',
        description: result.error,
        variant: 'error',
      });
      return;
    }
    setData(result);
    setMapping(result.mapping);
    if (mappingIsConfident(result.mapping)) {
      setRows(buildRows(result, result.mapping));
      setStep('review');
    } else {
      setStep('map');
    }
  }

  function applyMapping() {
    if (!data) return;
    setRows(buildRows(data, mapping));
    setStep('review');
  }

  // Live validation status per row. Duplicate doors are allowed (two trailers
  // at the same door), so they're not flagged.
  const statuses = useMemo<RowStatus[]>(
    () => rows.map((row) => rowStatus(row)),
    [rows],
  );

  const summary = useMemo(() => {
    let ready = 0;
    let needsReview = 0;
    let excluded = 0;
    statuses.forEach((st, i) => {
      if (!rows[i]?.include) excluded += 1;
      if (st === 'ready') ready += 1;
      else needsReview += 1;
    });
    return { total: rows.length, ready, needsReview, excluded };
  }, [statuses, rows]);

  const includedInvalid = rows.some(
    (r, i) => r.include && !isImportable(statuses[i] ?? 'missing_door'),
  );
  const includedReady = rows.some(
    (r, i) => r.include && isImportable(statuses[i] ?? 'missing_door'),
  );

  function patchRow(key: string, patch: Partial<ReviewRow>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if (patch.door !== undefined) next.normDoor = normalizeDoor(patch.door);
        if (patch.closeRaw !== undefined)
          next.closeTime = normalizeCloseTime(patch.closeRaw) ?? '';
        return next;
      }),
    );
  }
  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        key: `row-${rowSeq++}`,
        include: true,
        door: '',
        normDoor: '',
        lane: '',
        carrier: '',
        closeTime: '',
        closeRaw: '',
        zone: null,
        notes: '',
      },
    ]);
  }

  async function confirm() {
    const toImport = rows
      .filter(
        (r, i) => r.include && isImportable(statuses[i] ?? 'missing_door'),
      )
      .map((r) => ({
        doorNumber: r.door,
        zone: r.zone ?? 1,
        laneNumber: r.lane || undefined,
        carrierLabel: r.carrier || undefined,
        closeTime: r.closeTime,
        notes: r.notes || undefined,
      }));
    if (toImport.length === 0) return;

    setPending(true);

    if (target === 'weekly') {
      const result = await importWeekly({ weekday, rows: toImport });
      setPending(false);
      if (!result.ok) {
        toast({
          title: 'Import failed',
          description: result.error,
          variant: 'error',
        });
        return;
      }
      toast({
        title: `Saved ${result.imported} door${result.imported === 1 ? '' : 's'} to ${weekdayLabel(weekday)}`,
      });
      close();
      router.push('/load-priority/schedule');
      return;
    }

    const board = await createBoard({ shiftKeyId, boardDate });
    if (!board.ok) {
      setPending(false);
      toast({
        title: 'Could not create board',
        description: board.error,
        variant: 'error',
      });
      return;
    }
    const result = await importEntries(board.id, { rows: toImport });
    setPending(false);
    if (!result.ok) {
      toast({
        title: 'Import failed',
        description: result.error,
        variant: 'error',
      });
      return;
    }
    toast({
      title: `Imported ${result.imported} door${result.imported === 1 ? '' : 's'}`,
    });
    close();
    router.push(`/load-priority/${board.id}`);
  }

  const columnOptions = (data?.headers ?? []).map((h, i) => ({
    value: String(i),
    label: h || `Column ${i + 1}`,
  }));

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import schedule"
      className="max-w-4xl"
      footer={
        step === 'review' ? (
          <>
            <Button variant="ghost" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={confirm}
              disabled={pending || includedInvalid || !includedReady}
            >
              {pending ? 'Importing…' : 'Confirm import'}
            </Button>
          </>
        ) : step === 'map' ? (
          <>
            <Button
              variant="ghost"
              onClick={() => setStep('upload')}
              disabled={pending}
            >
              Back
            </Button>
            <Button
              onClick={applyMapping}
              disabled={
                mapping.door === undefined || mapping.close === undefined
              }
            >
              Continue
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={doParse} disabled={pending || !file}>
              {pending ? 'Reading…' : 'Upload & detect'}
            </Button>
          </>
        )
      }
    >
      {step === 'upload' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Import into" htmlFor="imp-target">
              <Select
                id="imp-target"
                value={target}
                onChange={(e) => setTarget(e.target.value as ImportTarget)}
              >
                <option value="daily">Today’s daily draft</option>
                <option value="weekly">Weekly master schedule</option>
              </Select>
            </Field>
            {target === 'weekly' ? (
              <Field label="Weekday" htmlFor="imp-weekday">
                <Select
                  id="imp-weekday"
                  value={String(weekday)}
                  onChange={(e) => setWeekday(Number(e.target.value))}
                >
                  {WEEKDAYS_MON_FIRST.map((d) => (
                    <option key={d} value={d}>
                      {weekdayLabel(d)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragActive ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <UploadCloud
              className="text-foreground-subtle h-8 w-8"
              aria-hidden="true"
            />
            <p className="text-foreground mt-2 text-sm font-medium">
              {file ? file.name : 'Drag a file here, or browse'}
            </p>
            <p className="text-foreground-subtle mt-1 text-xs">
              Accepted: .xlsx or .csv · max 5 MB
            </p>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => fileInput.current?.click()}
            >
              Browse file
            </Button>
          </div>
          <p className="text-foreground-subtle text-xs">
            Need the format?{' '}
            <button
              type="button"
              onClick={() => window.open('/load-priority/template', '_blank')}
              className="text-primary hover:underline"
            >
              Download the import template
            </button>
            .
          </p>
        </div>
      ) : null}

      {step === 'map' ? (
        <div className="space-y-3">
          <p className="text-foreground-muted text-sm">
            We couldn’t confidently detect every column. Match them below (Dock
            Door and Close Time are required).
          </p>
          <div className="grid grid-cols-2 gap-3">
            {MAP_FIELDS.map(({ field, label, required }) => (
              <Field
                key={field}
                label={`${label}${required ? ' *' : ''}`}
                htmlFor={`map-${field}`}
              >
                <Select
                  id={`map-${field}`}
                  value={
                    mapping[field] === undefined ? '' : String(mapping[field])
                  }
                  onChange={(e) =>
                    setMapping((prev) => ({
                      ...prev,
                      [field]:
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value),
                    }))
                  }
                >
                  <option value="">Not present</option>
                  {columnOptions.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        </div>
      ) : null}

      {step === 'review' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge tone="neutral">Total {summary.total}</Badge>
            <Badge tone="success">Ready {summary.ready}</Badge>
            <Badge tone="warning">Needs review {summary.needsReview}</Badge>
            <Badge tone="neutral">Excluded {summary.excluded}</Badge>
          </div>

          <div className="border-border max-h-[45vh] overflow-auto rounded-lg border">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-border bg-surface-raised/50 sticky top-0 border-b">
                <tr>
                  {[
                    '',
                    'Dock Door',
                    'Lane / Carrier',
                    'Close Time',
                    'Zone',
                    'Status',
                    '',
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="text-foreground-muted px-3 py-2 font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const st = statuses[i] ?? 'missing_door';
                  return (
                    <tr
                      key={row.key}
                      className="border-border border-b last:border-0"
                    >
                      <td className="px-3 py-2">
                        <Checkbox
                          id={`inc-${row.key}`}
                          label=""
                          checked={row.include}
                          onChange={(e) =>
                            patchRow(row.key, { include: e.target.checked })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.door}
                          onChange={(e) =>
                            patchRow(row.key, { door: e.target.value })
                          }
                          className="w-24"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Input
                            value={row.lane}
                            onChange={(e) =>
                              patchRow(row.key, { lane: e.target.value })
                            }
                            placeholder="Lane"
                            className="w-20"
                          />
                          <Input
                            value={row.carrier}
                            onChange={(e) =>
                              patchRow(row.key, { carrier: e.target.value })
                            }
                            placeholder="Carrier"
                            className="w-24"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.closeRaw}
                          onChange={(e) =>
                            patchRow(row.key, { closeRaw: e.target.value })
                          }
                          placeholder="5:00 PM"
                          className="w-24"
                          title={
                            row.closeTime
                              ? formatCloseTime(row.closeTime)
                              : 'Invalid'
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={row.zone ?? ''}
                          onChange={(e) =>
                            patchRow(row.key, {
                              zone: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="w-16"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={STATUS_TONE[st]}>
                          {ROW_STATUS_LABELS[st]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setRows((prev) =>
                              prev.filter((r) => r.key !== row.key),
                            )
                          }
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="secondary" size="sm" onClick={addRow}>
              Add row
            </Button>
            {includedInvalid ? (
              <p className="text-warning text-xs">
                Resolve or uncheck the highlighted rows to import.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
