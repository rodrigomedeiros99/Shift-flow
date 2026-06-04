import { PageHeader } from '@/components/layout/page-header';
import { EquipmentManager } from '@/components/config/equipment-manager';
import { CONFIG_MANAGER_ROLES, requireRole } from '@/features/auth/queries';
import { listEquipment } from '@/features/config/queries';

export default async function EquipmentPage() {
  await requireRole(CONFIG_MANAGER_ROLES);
  const equipment = await listEquipment();

  return (
    <>
      <PageHeader
        title="Equipment"
        description="Configure equipment types and whether they require certification."
      />
      <EquipmentManager items={equipment} />
    </>
  );
}
