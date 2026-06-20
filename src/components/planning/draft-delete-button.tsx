'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, useToast } from '@/components/ui';
import { deleteDraftPlan } from '@/features/planning/actions';

interface DraftDeleteButtonProps {
  planId: string;
  /** Where to go after delete; if omitted, just refresh the current list. */
  redirectTo?: string;
  size?: 'sm' | 'md';
}

/**
 * Delete-draft control (button + confirmation). Only ever rendered for draft
 * plans; the server action re-checks status and permissions. Used in the plan
 * workspace (redirects away) and in the dashboard / create-plan lists (refresh).
 */
export function DraftDeleteButton({
  planId,
  redirectTo,
  size = 'sm',
}: DraftDeleteButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    const result = await deleteDraftPlan(planId);
    setPending(false);
    if (result.ok) {
      toast({ title: 'Draft deleted successfully' });
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } else {
      toast({
        title: 'Could not delete draft',
        description: result.error,
        variant: 'error',
      });
      setOpen(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        className="text-danger gap-2"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete draft
      </Button>

      <ConfirmDialog
        open={open}
        title="Delete draft plan?"
        description="Are you sure you want to delete this draft plan? This action cannot be undone."
        confirmLabel="Delete Draft"
        destructive
        pending={pending}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
