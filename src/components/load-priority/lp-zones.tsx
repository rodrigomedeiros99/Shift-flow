'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Modal,
  useToast,
} from '@/components/ui';
import { Field } from '@/components/config/field';
import { StatusCell } from '@/components/config/row-actions';
import {
  createZone,
  deleteZone,
  updateZone,
} from '@/features/load-priority/actions';
import type { LoadPriorityZone } from '@/types/domain';

function blank() {
  return { zone: '1', doorLow: '', doorHigh: '', active: true };
}

/**
 * Configurable zone ranges (Zone N = door numbers low..high). Used to auto-assign
 * a zone on the weekly schedule and on imports; supervisors can always override
 * per row. Manager-gated.
 */
export function LpZones({ zones }: { zones: LoadPriorityZone[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LoadPriorityZone | null>(null);
  const [deleting, setDeleting] = useState<LoadPriorityZone | null>(null);
  const [form, setForm] = useState(blank());

  function openCreate() {
    setEditing(null);
    setForm(blank());
    setOpen(true);
  }
  function openEdit(z: LoadPriorityZone) {
    setEditing(z);
    setForm({
      zone: String(z.zone),
      doorLow: String(z.doorLow),
      doorHigh: String(z.doorHigh),
      active: z.active,
    });
    setOpen(true);
  }

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

  async function submit() {
    const input = {
      zone: form.zone,
      doorLow: form.doorLow,
      doorHigh: form.doorHigh,
      active: form.active,
    };
    const okDone = await run(
      () => (editing ? updateZone(editing.id, input) : createZone(input)),
      editing ? 'Zone updated' : 'Zone added',
    );
    if (okDone) setOpen(false);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const okDone = await run(() => deleteZone(deleting.id), 'Zone deleted');
    if (okDone) setDeleting(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-foreground-muted text-sm">
          Zone N covers a range of door numbers. Auto-assignment parses a door’s
          digits and picks the matching range; supervisors can override per row.
        </p>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add zone range
        </Button>
      </div>

      {zones.length === 0 ? (
        <EmptyState
          title="No zone ranges yet"
          description="Add ranges like Zone 1 = 704–720 so doors auto-assign to a zone."
        />
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-border bg-surface-raised/50 border-b">
              <tr>
                {['Zone', 'Door range', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="text-foreground-muted px-4 py-3 font-medium"
                  >
                    {h}
                  </th>
                ))}
                <th className="text-foreground-muted px-4 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr
                  key={z.id}
                  className="border-border hover:bg-surface-raised/30 border-b last:border-0"
                >
                  <td className="text-foreground px-4 py-3 font-medium">
                    Zone {z.zone}
                  </td>
                  <td className="text-foreground px-4 py-3 tabular-nums">
                    {z.doorLow}–{z.doorHigh}
                  </td>
                  <td className="px-4 py-3">
                    <StatusCell active={z.active} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label="Edit"
                        onClick={() => openEdit(z)}
                        icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                      />
                      <IconButton
                        label="Delete"
                        tone="danger"
                        onClick={() => setDeleting(z)}
                        icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit zone range' : 'Add zone range'}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Zone" htmlFor="z-zone">
            <Input
              id="z-zone"
              type="number"
              min={1}
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lowest door #" htmlFor="z-low">
              <Input
                id="z-low"
                type="number"
                min={0}
                value={form.doorLow}
                onChange={(e) => setForm({ ...form, doorLow: e.target.value })}
                placeholder="704"
              />
            </Field>
            <Field label="Highest door #" htmlFor="z-high">
              <Input
                id="z-high"
                type="number"
                min={0}
                value={form.doorHigh}
                onChange={(e) => setForm({ ...form, doorHigh: e.target.value })}
                placeholder="720"
              />
            </Field>
          </div>
          <Checkbox
            id="z-active"
            label="Active"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete zone range?"
        description={
          deleting
            ? `Zone ${deleting.zone} (${deleting.doorLow}–${deleting.doorHigh}) will be removed. Doors in this range will no longer auto-assign.`
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
