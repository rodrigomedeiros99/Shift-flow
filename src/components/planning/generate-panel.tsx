'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  useToast,
} from '@/components/ui';
import { autoGeneratePlan } from '@/features/planning/actions';

interface GeneratePanelProps {
  planId: string;
  /** Rotation lookback window (days) chosen in the workspace. */
  lookbackDays: number;
}

/**
 * Auto-generate the planned board from the staffing needs (and, for inbound,
 * the active dock doors), respecting equipment certifications and fair
 * rotation. Re-running replaces the planned assignments; special assignments
 * and staffing needs are kept.
 */
export function GeneratePanel({ planId, lookbackDays }: GeneratePanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function generate() {
    setPending(true);
    const result = await autoGeneratePlan(planId, lookbackDays);
    setPending(false);
    if (result.ok) {
      toast({
        title: 'Plan generated',
        description: `${result.score}% rotation · ${result.filled} assigned · ${result.open} open · ${result.pool} in pool`,
      });
      router.refresh();
    } else {
      toast({
        title: 'Could not generate',
        description: result.error,
        variant: 'error',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-generate</CardTitle>
        <CardDescription>
          Fill the board from the staffing needs above, respecting equipment
          certifications and fair rotation. You can review and adjust afterward.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={generate} disabled={pending} className="gap-2">
          <Wand2 className="h-4 w-4" aria-hidden="true" />
          {pending ? 'Generating…' : 'Auto Generate Plan'}
        </Button>
      </CardContent>
    </Card>
  );
}
