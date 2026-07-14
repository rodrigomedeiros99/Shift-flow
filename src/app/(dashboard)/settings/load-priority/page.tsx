import { PageHeader } from '@/components/layout/page-header';
import { CONFIG_MANAGER_ROLES, requireRole } from '@/features/auth/queries';
import { listZones } from '@/features/load-priority/queries';
import { LpZones } from '@/components/load-priority/lp-zones';

export default async function LoadPriorityZonesPage() {
  await requireRole(CONFIG_MANAGER_ROLES);
  const zones = await listZones();

  return (
    <>
      <PageHeader
        title="Load Priority zones"
        description="Configure the door-number range for each zone. Used to auto-assign zones on the weekly schedule and imports."
      />
      <LpZones zones={zones} />
    </>
  );
}
