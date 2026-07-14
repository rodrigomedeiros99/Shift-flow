'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarPlus,
  CheckCircle2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Modal,
  useToast,
} from '@/components/ui';
import { Field } from '@/components/config/field';
import {
  addEntry,
  publishBoard,
  removeEntry,
  saveEntryToWeekly,
  setEntryStatus,
  updateEntry,
} from '@/features/load-priority/actions';
import {
  compareEntries,
  doorLabel,
  formatCloseTime,
} from '@/features/load-priority/urgency';
import type { LoadPriorityBoard, LoadPriorityEntry } from '@/types/domain';

const STATUS_TONE = {
  draft: 'warning',
  published: 'success',
  closed: 'neutral',
} as const;

/** Blank entry form values. */
function blankForm() {
  return {
    doorNumber: '',
    zone: '1',
    laneNumber: '',
    carrierLabel: '',
    closeTime: '',
    notes: '',
  };
}

export function LpBoardEditor({
  board,
  entries,
}: {
  board: LoadPriorityBoard;
  entries: LoadPriorityEntry[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<LoadPriorityEntry | null>(null);
  const [removing, setRemoving] = useState<LoadPriorityEntry | null>(null);
  const [form, setForm] = useState(blankForm());

  const zones = useMemo(
    () => [...new Set(entries.map((e) => e.zone))].sort((a, b) => a - b),
    [entries],
  );

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

  function openAdd() {
    setEditing(null);
    setForm(blankForm());
    setAdding(true);
  }
  function openEdit(entry: LoadPriorityEntry) {
    setEditing(entry);
    setForm({
      doorNumber: entry.doorNumber,
      zone: String(entry.zone),
      laneNumber: entry.laneNumberSnapshot ?? '',
      carrierLabel: entry.carrierLabelSnapshot ?? '',
      closeTime: entry.closeTime ?? '',
      notes: entry.notes ?? '',
    });
    setAdding(true);
  }

  async function submitEntry() {
    const input = {
      doorNumber: form.doorNumber,
      zone: form.zone,
      laneNumber: form.laneNumber,
      carrierLabel: form.carrierLabel,
      closeTime: form.closeTime,
      notes: form.notes,
    };
    const okDone = await run(
      () =>
        editing ? updateEntry(editing.id, input) : addEntry(board.id, input),
      editing ? 'Door updated' : 'Door added',
    );
    if (okDone) {
      setAdding(false);
      setEditing(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    const okDone = await run(() => removeEntry(removing.id), 'Door removed');
    if (okDone) setRemoving(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge tone={STATUS_TONE[board.status]}>{board.status}</Badge>
          <span className="text-foreground-muted text-sm">
            {entries.length} door{entries.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {board.status !== 'published' ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => publishBoard(board.id), 'Board published')
              }
            >
              Publish
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            className="gap-2"
            onClick={openAdd}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add door
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No doors on this board"
          description="Add a door, or configure default doors and close schedules in Settings → Load Priority so new boards pre-fill automatically."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {zones.map((zone) => (
            <Card key={zone}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Zone {zone}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                {entries
                  .filter((e) => e.zone === zone)
                  .sort(compareEntries)
                  .map((entry) => {
                    const closed = entry.status === 'closed';
                    return (
                      <div
                        key={entry.id}
                        className={`border-border rounded-lg border p-3 ${closed ? 'opacity-70' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-foreground font-semibold">
                              {doorLabel(entry)}
                            </p>
                            <p className="text-foreground-muted text-sm tabular-nums">
                              {formatCloseTime(entry.closeTime)}
                            </p>
                            {entry.notes ? (
                              <p className="text-foreground-subtle mt-0.5 text-xs">
                                {entry.notes}
                              </p>
                            ) : null}
                          </div>
                          {closed ? (
                            <Badge tone="success">Closed</Badge>
                          ) : (
                            <Badge tone="info">Open</Badge>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-1">
                          {closed ? (
                            <IconButton
                              label="Reopen"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  () => setEntryStatus(entry.id, 'open'),
                                  'Door reopened',
                                )
                              }
                              icon={
                                <RotateCcw
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              }
                            />
                          ) : (
                            <IconButton
                              label="Mark closed"
                              tone="success"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  () => setEntryStatus(entry.id, 'closed'),
                                  'Door closed',
                                )
                              }
                              icon={
                                <CheckCircle2
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              }
                            />
                          )}
                          <IconButton
                            label="Save to weekly schedule"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => saveEntryToWeekly(entry.id),
                                'Saved to weekly schedule',
                              )
                            }
                            icon={
                              <CalendarPlus
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            }
                          />
                          <IconButton
                            label="Edit"
                            onClick={() => openEdit(entry)}
                            icon={
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            }
                          />
                          <IconButton
                            label="Remove"
                            tone="danger"
                            onClick={() => setRemoving(entry)}
                            icon={
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / edit door modal */}
      <Modal
        open={adding}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        title={editing ? 'Edit door' : 'Add door'}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setAdding(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={submitEntry}
              disabled={pending || !form.doorNumber}
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Dock door" htmlFor="lp-door">
              <Input
                id="lp-door"
                value={form.doorNumber}
                onChange={(e) =>
                  setForm({ ...form, doorNumber: e.target.value })
                }
                placeholder="DD735"
              />
            </Field>
            <Field label="Zone" htmlFor="lp-zone">
              <Input
                id="lp-zone"
                type="number"
                min={1}
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lane number" htmlFor="lp-lane">
              <Input
                id="lp-lane"
                value={form.laneNumber}
                onChange={(e) =>
                  setForm({ ...form, laneNumber: e.target.value })
                }
                placeholder="5084"
              />
            </Field>
            <Field label="Carrier override" htmlFor="lp-carrier">
              <Input
                id="lp-carrier"
                value={form.carrierLabel}
                onChange={(e) =>
                  setForm({ ...form, carrierLabel: e.target.value })
                }
                placeholder="UPS"
              />
            </Field>
          </div>
          <Field label="Close time" htmlFor="lp-close">
            <Input
              id="lp-close"
              type="time"
              value={form.closeTime}
              onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
              className="sm:w-44"
            />
          </Field>
          <Field label="Notes" htmlFor="lp-notes">
            <Input
              id="lp-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional"
            />
          </Field>
          {form.carrierLabel ? (
            <p className="text-foreground-subtle text-xs">
              A carrier override is shown instead of the lane number on the
              board.
            </p>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!removing}
        title="Remove door?"
        description={
          removing
            ? `${doorLabel(removing)} will be removed from today's board.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        pending={pending}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
