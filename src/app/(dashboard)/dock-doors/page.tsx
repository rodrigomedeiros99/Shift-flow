import { PageHeader } from '@/components/layout/page-header';
import { DockDoorManager } from '@/components/config/dock-door-manager';
import { CONFIG_MANAGER_ROLES, requireRole } from '@/features/auth/queries';
import { listDockDoors } from '@/features/config/queries';

export default async function DockDoorsPage() {
  await requireRole(CONFIG_MANAGER_ROLES);
  const dockDoors = await listDockDoors();

  return (
    <>
      <PageHeader
        title="Dock Doors"
        description="Maintain the configurable dock door list used for inbound planning."
      />
      <DockDoorManager items={dockDoors} />
    </>
  );
}
