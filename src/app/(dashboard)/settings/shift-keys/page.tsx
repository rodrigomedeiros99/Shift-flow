import { PageHeader } from '@/components/layout/page-header';
import { ShiftKeyManager } from '@/components/config/shift-key-manager';
import { CONFIG_MANAGER_ROLES, requireRole } from '@/features/auth/queries';
import { listShiftKeys } from '@/features/config/queries';

export default async function ShiftKeysPage() {
  await requireRole(CONFIG_MANAGER_ROLES);
  const shiftKeys = await listShiftKeys();

  return (
    <>
      <PageHeader
        title="Shift Keys"
        description="Define shift key schedules and operating days."
      />
      <ShiftKeyManager items={shiftKeys} />
    </>
  );
}
