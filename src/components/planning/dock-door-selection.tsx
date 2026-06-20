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
  Select,
  useToast,
} from '@/components/ui';
import { saveActiveDoors } from '@/features/planning/actions';
import type { PlanDockDoorRow } from '@/features/planning/queries';
import type { DockDoor, EquipmentType } from '@/types/domain';

interface DockDoorSelectionProps {
  planId: string;
  dockDoors: DockDoor[];
  equipment: EquipmentType[];
  activeDoors: PlanDockDoorRow[];
}

/**
 * Inbound Step 4 (PRD §6): the leader picks which dock doors are active today
 * and, per door, the equipment that door needs *for this plan*. Equipment is
 * optional and changes daily — it isn't tied permanently to the door. Each
 * active door becomes one unload slot at auto-generate.
 */
export function DockDoorSelection({
  planId,
  dockDoors,
  equipment,
  activeDoors,
}: DockDoorSelectionProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(activeDoors.map((d) => d.dockDoorId)),
  );
  // doorId → equipmentId ('' = no equipment). Preserved even if a door is
  // briefly unchecked, so toggling doesn't lose the choice.
  const [equipByDoor, setEquipByDoor] = useState<Map<string, string>>(
    () => new Map(activeDoors.map((d) => [d.dockDoorId, d.equipmentId ?? ''])),
  );

  // Only configurable, active doors are selectable (Phase 3 config).
  const selectable = dockDoors.filter((d) => d.active);
  const usableEquipment = equipment.filter((e) => e.active);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setEquip(doorId: string, equipmentId: string) {
    setEquipByDoor((prev) => {
      const next = new Map(prev);
      next.set(doorId, equipmentId);
      return next;
    });
  }

  async function save() {
    setPending(true);
    const doors = [...selected].map((dockDoorId) => ({
      dockDoorId,
      equipmentId: equipByDoor.get(dockDoorId) ?? '',
    }));
    const result = await saveActiveDoors(planId, doors);
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
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {selectable.map((d) => {
              const isOn = selected.has(d.id);
              return (
                <div
                  key={d.id}
                  className="border-border flex items-center justify-between gap-2 rounded-md border p-2.5"
                >
                  <Checkbox
                    id={`door-${d.id}`}
                    label={`Door ${d.doorNumber}`}
                    checked={isOn}
                    onChange={() => toggle(d.id)}
                  />
                  <Select
                    aria-label={`Equipment for door ${d.doorNumber}`}
                    className="w-32"
                    value={equipByDoor.get(d.id) ?? ''}
                    onChange={(e) => setEquip(d.id, e.target.value)}
                    disabled={!isOn}
                  >
                    <option value="">No equipment</option>
                    {usableEquipment.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
