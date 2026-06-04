'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Checkbox, Input, Select, useToast } from '@/components/ui';
import { Field } from '@/components/config/field';
import {
  templateSchema,
  type TemplateFormValues,
} from '@/features/templates/schemas';
import { createTemplate, updateTemplate } from '@/features/templates/actions';
import type { Department, PlanTemplate, ShiftKey } from '@/types/domain';

interface TemplateFormProps {
  /** Existing template for edit mode; omit to create a new one. */
  template?: PlanTemplate;
  departments: Department[];
  shiftKeys: ShiftKey[];
}

/**
 * Inline header form for a template (name, department, shift key, active).
 * Used as a full page section in both create (`/templates/new`) and edit
 * (`/templates/[id]`) — never inside a modal (editors get their own surface).
 * On create it redirects to the new template's editor so items can be added.
 */
export function TemplateForm({
  template,
  departments,
  shiftKeys,
}: TemplateFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const editing = !!template;

  const defaults = useMemo<TemplateFormValues>(
    () => ({
      name: template?.name ?? '',
      departmentId: template?.departmentId ?? departments[0]?.id ?? '',
      shiftKeyId: template?.shiftKeyId ?? shiftKeys[0]?.id ?? '',
      active: template?.active ?? true,
    }),
    [template, departments, shiftKeys],
  );

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: defaults,
  });

  const submit = form.handleSubmit(async (values) => {
    setPending(true);

    if (template) {
      const result = await updateTemplate(template.id, values);
      setPending(false);
      if (result.ok) {
        toast({ title: 'Template updated' });
        router.refresh();
      } else {
        toast({
          title: 'Could not save',
          description: result.error,
          variant: 'error',
        });
      }
      return;
    }

    const result = await createTemplate(values);
    setPending(false);
    if (result.ok) {
      toast({ title: 'Template created' });
      router.push(`/templates/${result.id}`);
    } else {
      toast({
        title: 'Could not save',
        description: result.error,
        variant: 'error',
      });
    }
  });

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field
        label="Name"
        htmlFor="template-name"
        error={form.formState.errors.name?.message}
      >
        <Input
          id="template-name"
          {...form.register('name')}
          placeholder="e.g. Key 1 Outbound"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Department"
          htmlFor="template-dept"
          error={form.formState.errors.departmentId?.message}
        >
          <Select id="template-dept" {...form.register('departmentId')}>
            <option value="">Select a department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.active ? '' : ' (inactive)'}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Shift key"
          htmlFor="template-key"
          error={form.formState.errors.shiftKeyId?.message}
        >
          <Select id="template-key" {...form.register('shiftKeyId')}>
            <option value="">Select a shift key</option>
            {shiftKeys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
                {k.active ? '' : ' (inactive)'}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Checkbox
        id="template-active"
        label="Active"
        {...form.register('active')}
      />

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/templates')}
          disabled={pending}
        >
          {editing ? 'Back to templates' : 'Cancel'}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save changes' : 'Create template'}
        </Button>
      </div>
    </form>
  );
}
