'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  useToast,
} from '@/components/ui';
import { Field } from '@/components/config/field';
import {
  planSetupSchema,
  type PlanSetupValues,
} from '@/features/planning/schemas';
import { createDraftPlan } from '@/features/planning/actions';
import { todayISO } from '@/lib/utils/date';
import { DEPARTMENT_KIND_LABELS } from '@/lib/constants/departments';
import type { Department, ShiftKey } from '@/types/domain';

interface PlanSetupFormProps {
  departments: Department[];
  shiftKeys: ShiftKey[];
}

/**
 * Step 2 of the outbound workflow: choose department, key, and date, then start
 * a draft. If an active plan already exists for that slot we surface the
 * duplicate warning (PRD §5) with a shortcut to open it instead of creating a
 * second one.
 */
export function PlanSetupForm({ departments, shiftKeys }: PlanSetupFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  const defaults = useMemo<PlanSetupValues>(
    () => ({
      departmentId: departments[0]?.id ?? '',
      shiftKeyId: shiftKeys[0]?.id ?? '',
      planDate: todayISO(),
    }),
    [departments, shiftKeys],
  );

  const form = useForm<PlanSetupValues>({
    resolver: zodResolver(planSetupSchema),
    defaultValues: defaults,
  });

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    setDuplicateId(null);
    const result = await createDraftPlan(values);
    setPending(false);

    if (result.ok) {
      router.push(`/create-plan/${result.id}`);
      return;
    }
    if ('code' in result) {
      setDuplicateId(result.existingId);
      return;
    }
    toast({
      title: 'Could not start plan',
      description: result.error,
      variant: 'error',
    });
  });

  return (
    <Card className="max-w-xl">
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <Field
            label="Department"
            htmlFor="plan-dept"
            error={form.formState.errors.departmentId?.message}
          >
            <Select id="plan-dept" {...form.register('departmentId')}>
              <option value="">Select a department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({DEPARTMENT_KIND_LABELS[d.kind]})
                  {d.active ? '' : ' (inactive)'}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Key"
            htmlFor="plan-key"
            error={form.formState.errors.shiftKeyId?.message}
          >
            <Select id="plan-key" {...form.register('shiftKeyId')}>
              <option value="">Select a key</option>
              {shiftKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                  {k.active ? '' : ' (inactive)'}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Date"
            htmlFor="plan-date"
            error={form.formState.errors.planDate?.message}
          >
            <Input id="plan-date" type="date" {...form.register('planDate')} />
          </Field>

          {duplicateId ? (
            <div className="border-warning/40 bg-warning/10 flex items-start gap-3 rounded-md border p-3">
              <AlertTriangle
                className="text-warning mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
              <div className="space-y-2 text-sm">
                <p className="text-foreground font-medium">
                  A plan already exists for this department, key, and date.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(`/create-plan/${duplicateId}`)}
                >
                  Open existing plan
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? 'Starting…' : 'Start plan'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
