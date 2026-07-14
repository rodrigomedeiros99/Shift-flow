'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Select,
  useToast,
} from '@/components/ui';
import { Field } from '@/components/config/field';
import {
  copyDaySchedule,
  createWeeklyRow,
  deleteWeeklyRow,
  setWeeklyRowActive,
  updateWeeklyRow,
} from '@/features/load-priority/actions';
import { formatCloseTime } from '@/features/load-priority/urgency';
import {
  deriveZone,
  weekdayLabel,
  WEEKDAYS_MON_FIRST,
} from '@/features/load-priority/zones';
import type {
  LoadPriorityWeeklySchedule,
  LoadPriorityZone,
} from '@/types/domain';

function blank(weekday: number) {
  return {
    doorNumber: '',
    laneNumber: '',
    carrierLabel: '',
    closeTime: '',
    zone: '',
    active: true,
    notes: '',
    weekday,
  };
}

export function LpWeeklySchedule({
  rows,
  zones,
  initialWeekday,
}: {
  rows: LoadPriorityWeeklySchedule[];
  zones: LoadPriorityZone[];
  initialWeekday: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [day, setDay] = useState(initialWeekday);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LoadPriorityWeeklySchedule | null>(
    null,
  );
  const [deleting, setDeleting] = useState<LoadPriorityWeeklySchedule | null>(
    null,
  );
  const [form, setForm] = useState(() => blank(initialWeekday));
  const [copyTo, setCopyTo] = useState<number | ''>('');

  const dayRows = useMemo(
    () =>
      rows
        .filter((r) => r.weekday === day)
        .slice()
        .sort(
          (a, b) =>
            a.closeTime.localeCompare(b.closeTime) ||
            a.doorNumber.localeCompare(b.doorNumber),
        ),
    [rows, day],
  );
  const counts = useMemo(() => {
    const map: Record<number, number> = {};
    for (const r of rows)
      if (r.active) map[r.weekday] = (map[r.weekday] ?? 0) + 1;
    return map;
  }, [rows]);

  async function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    successTitle: string,
  ) {
    setPending(true);
    const result = await action();
    setPending(false);
    if (result.ok) {
      toast({ title: successTitle });
      router.refresh();
      return true;
    }
    toast({
      title: 'Could not save',
      description: result.error,
      variant: 'error',
    });
    return false;
  }

  function openCreate() {
    setEditing(null);
    setForm(blank(day));
    setOpen(true);
  }
  function openEdit(r: LoadPriorityWeeklySchedule) {
    setEditing(r);
    setForm({
      doorNumber: r.doorNumber,
      laneNumber: r.laneNumber ?? '',
      carrierLabel: r.carrierLabel ?? '',
      closeTime: r.closeTime,
      zone: String(r.zone),
      active: r.active,
      notes: r.notes ?? '',
      weekday: r.weekday,
    });
    setOpen(true);
  }

  /** Auto-fill zone from the configured ranges when the door changes. */
  function onDoorChange(value: string) {
    const z = deriveZone(value, zones);
    setForm((f) => ({
      ...f,
      doorNumber: value,
      zone: z !== null ? String(z) : f.zone,
    }));
  }

  async function submit() {
    const input = {
      weekday: form.weekday,
      doorNumber: form.doorNumber,
      laneNumber: form.laneNumber,
      carrierLabel: form.carrierLabel,
      closeTime: form.closeTime,
      zone: form.zone,
      active: form.active,
      notes: form.notes,
    };
    const okDone = await run(
      () =>
        editing ? updateWeeklyRow(editing.id, input) : createWeeklyRow(input),
      editing ? 'Row updated' : 'Row added',
    );
    if (okDone) setOpen(false);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const okDone = await run(() => deleteWeeklyRow(deleting.id), 'Row deleted');
    if (okDone) setDeleting(null);
  }

  async function doCopy() {
    if (copyTo === '') return;
    const okDone = await run(
      () => copyDaySchedule(day, copyTo),
      `Copied ${weekdayLabel(day)} → ${weekdayLabel(copyTo)}`,
    );
    if (okDone) setCopyTo('');
  }

  return (
    <div className="space-y-4">
      {/* Weekday selector (Monday first) */}
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS_MON_FIRST.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDay(d)}
            className={
              d === day
                ? 'bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-semibold'
                : 'border-border text-foreground-muted hover:bg-surface-raised rounded-md border px-3 py-1.5 text-sm'
            }
          >
            {weekdayLabel(d)}
            <span className="ml-1.5 opacity-70">{counts[d] ?? 0}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>{weekdayLabel(day)}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Copy this day to"
              value={copyTo === '' ? '' : String(copyTo)}
              onChange={(e) =>
                setCopyTo(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="w-40"
            >
              <option value="">Copy to…</option>
              {WEEKDAYS_MON_FIRST.filter((d) => d !== day).map((d) => (
                <option key={d} value={d}>
                  {weekdayLabel(d)}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              disabled={pending || copyTo === ''}
              onClick={doCopy}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy day
            </Button>
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add row
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {dayRows.length === 0 ? (
            <EmptyState
              title={`No rows for ${weekdayLabel(day)}`}
              description="Add a recurring door, or copy another day's schedule here."
            />
          ) : (
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-border bg-surface-raised/50 border-b">
                  <tr>
                    {['Door', 'Lane / Carrier', 'Close', 'Zone', 'Status'].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-foreground-muted px-4 py-3 font-medium"
                        >
                          {h}
                        </th>
                      ),
                    )}
                    <th className="text-foreground-muted px-4 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dayRows.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-border border-b last:border-0 ${r.active ? '' : 'opacity-60'}`}
                    >
                      <td className="text-foreground px-4 py-3 font-medium">
                        {r.doorNumber}
                      </td>
                      <td className="text-foreground px-4 py-3">
                        {r.carrierLabel ? (
                          <Badge tone="info">{r.carrierLabel}</Badge>
                        ) : (
                          (r.laneNumber ?? '—')
                        )}
                      </td>
                      <td className="text-foreground px-4 py-3 tabular-nums">
                        {formatCloseTime(r.closeTime)}
                      </td>
                      <td className="text-foreground px-4 py-3">
                        Zone {r.zone}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={r.active ? 'success' : 'neutral'}>
                          {r.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            label={r.active ? 'Deactivate' : 'Activate'}
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => setWeeklyRowActive(r.id, !r.active),
                                r.active ? 'Deactivated' : 'Activated',
                              )
                            }
                            icon={
                              <Power className="h-4 w-4" aria-hidden="true" />
                            }
                          />
                          <IconButton
                            label="Edit"
                            onClick={() => openEdit(r)}
                            icon={
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            }
                          />
                          <IconButton
                            label="Delete"
                            tone="danger"
                            onClick={() => setDeleting(r)}
                            icon={
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          editing
            ? `Edit row — ${weekdayLabel(form.weekday)}`
            : `Add row — ${weekdayLabel(day)}`
        }
        footer={
          <>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={pending || !form.doorNumber || !form.closeTime}
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Dock door" htmlFor="w-door">
              <Input
                id="w-door"
                value={form.doorNumber}
                onChange={(e) => onDoorChange(e.target.value)}
                placeholder="DD735"
              />
            </Field>
            <Field label="Zone" htmlFor="w-zone">
              <Input
                id="w-zone"
                type="number"
                min={1}
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lane number" htmlFor="w-lane">
              <Input
                id="w-lane"
                value={form.laneNumber}
                onChange={(e) =>
                  setForm({ ...form, laneNumber: e.target.value })
                }
                placeholder="5084"
              />
            </Field>
            <Field label="Carrier override" htmlFor="w-carrier">
              <Input
                id="w-carrier"
                value={form.carrierLabel}
                onChange={(e) =>
                  setForm({ ...form, carrierLabel: e.target.value })
                }
                placeholder="UPS"
              />
            </Field>
          </div>
          <Field label="Close time" htmlFor="w-close">
            <Input
              id="w-close"
              type="time"
              value={form.closeTime}
              onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
              className="sm:w-44"
            />
          </Field>
          <Field label="Notes" htmlFor="w-notes">
            <Input
              id="w-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional"
            />
          </Field>
          <Checkbox
            id="w-active"
            label="Active"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete recurring row?"
        description={
          deleting
            ? `${deleting.doorNumber} on ${weekdayLabel(deleting.weekday)} will be removed from the weekly schedule. Published boards keep their snapshots.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
