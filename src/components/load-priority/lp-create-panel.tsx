'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  useToast,
} from '@/components/ui';
import { Field } from '@/components/config/field';
import { Input } from '@/components/ui';
import { createBoard } from '@/features/load-priority/actions';
import { LpImportDialog } from './lp-import-dialog';
import { todayISO } from '@/lib/utils/date';
import type { ShiftKey } from '@/types/domain';

/**
 * Create (or open) a daily Load Priority board for a date + shift key. The board
 * is pre-filled from the active door configs whose close schedule covers that
 * weekday; the action is idempotent, so re-creating just opens the existing one.
 */
export function LpCreatePanel({ shiftKeys }: { shiftKeys: ShiftKey[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [boardDate, setBoardDate] = useState(todayISO());
  const [shiftKeyId, setShiftKeyId] = useState(shiftKeys[0]?.id ?? '');
  const [pending, setPending] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  async function submit() {
    if (!shiftKeyId) return;
    setPending(true);
    const result = await createBoard({ shiftKeyId, boardDate });
    setPending(false);
    if (result.ok) {
      router.push(`/load-priority/${result.id}`);
    } else {
      toast({
        title: 'Could not create board',
        description: result.error,
        variant: 'error',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New board</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Date" htmlFor="lp-date">
            <Input
              id="lp-date"
              type="date"
              value={boardDate}
              onChange={(e) => setBoardDate(e.target.value)}
              className="sm:w-44"
            />
          </Field>
          <Field label="Shift key" htmlFor="lp-key">
            <Select
              id="lp-key"
              value={shiftKeyId}
              onChange={(e) => setShiftKeyId(e.target.value)}
              className="sm:w-44"
            >
              {shiftKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button onClick={submit} disabled={pending || !shiftKeyId}>
            {pending ? 'Creating…' : 'Create / open board'}
          </Button>
          <Button
            variant="secondary"
            className="gap-2"
            disabled={!shiftKeyId}
            onClick={() => setImportOpen(true)}
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Import schedule
          </Button>
        </div>
      </CardContent>

      <LpImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        shiftKeyId={shiftKeyId}
        boardDate={boardDate}
      />
    </Card>
  );
}
