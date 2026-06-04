'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  useToast,
} from '@/components/ui';
import { saveActiveDoors } from '@/features/planning/actions';
import type { DockDoor } from '@/types/domain';

interface DockDoorSelectionProps {
  planId: string;
  dockDoors: DockDoor[];
  activeDoorIds: string[];
}

/**
 * Inbound Step 4 (PRD §6): the leader picks which dock doors are active today.
 * Only active doors participate in auto-generate (each per-active-door template
 * item expands to one slot per selected door).
 */
export function DockDoorSelection({
  planId,
  dockDoors,
  activeDoorIds,
}: DockDoorSelectionProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(activeDoorIds),
  );

  // Only configurable, active doors are selectable (Phase 3 config).
  const selectable = dockDoors.filter((d) => d.active);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setPending(true);
    const result = await saveActiveDoors(planId, [...selected]);
    setPending(false);
    if (result.ok) {
      toast({ title: 'Active doors saved' });
      router.refresh();
    } else {
      toast({
        title: 'Could not save',
        description: result.error,
        variant: 'error',
      });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>
          Active dock doors
          <span className="text-foreground-subtle ml-1 text-sm font-normal">
            ({selected.size})
          </span>
        </CardTitle>
        <Button size="sm" onClick={save} disabled={pending}>
          Save active doors
        </Button>
      </CardHeader>
      <CardContent>
        {selectable.length === 0 ? (
          <p className="text-foreground-muted text-sm">
            No active dock doors are configured. Add them under Dock doors.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {selectable.map((d) => (
              <Checkbox
                key={d.id}
                id={`door-${d.id}`}
                label={`Door ${d.doorNumber}`}
                checked={selected.has(d.id)}
                onChange={() => toggle(d.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
