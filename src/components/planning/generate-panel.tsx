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
  Select,
  useToast,
} from '@/components/ui';
import { Field } from '@/components/config/field';
import {
  autoGeneratePlan,
  type GenerateSource,
} from '@/features/planning/actions';
import type { PlanTemplate } from '@/types/domain';

interface GeneratePanelProps {
  planId: string;
  templates: PlanTemplate[];
  /** Rotation lookback window (days) chosen in the workspace. */
  lookbackDays: number;
}

/**
 * Step 4–5: choose a starting point and auto-generate the planned board.
 * Re-running replaces the planned assignments (special assignments are kept).
 * Auto-generate applies fair rotation (PRD §7) and reports a rotation score.
 */
export function GeneratePanel({
  planId,
  templates,
  lookbackDays,
}: GeneratePanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  // '' = blank; otherwise a template id.
  const [choice, setChoice] = useState('');

  async function generate() {
    setPending(true);
    const source: GenerateSource =
      choice === ''
        ? { type: 'blank' }
        : { type: 'template', templateId: choice };
    const result = await autoGeneratePlan(planId, source, lookbackDays);
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
          Fill the board from a template (respecting equipment certifications),
          or start blank and assign from the pool.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Starting point" htmlFor="gen-source">
          <Select
            id="gen-source"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            <option value="">Blank (assign manually)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={generate} disabled={pending} className="gap-2">
          <Wand2 className="h-4 w-4" aria-hidden="true" />
          {pending ? 'Generating…' : 'Auto-generate plan'}
        </Button>
      </CardContent>
    </Card>
  );
}
