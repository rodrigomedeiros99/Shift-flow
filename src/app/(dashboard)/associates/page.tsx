import { PageHeader } from '@/components/layout/page-header';
import { AssociateManager } from '@/components/config/associate-manager';
import { CONFIG_MANAGER_ROLES, requireRole } from '@/features/auth/queries';
import {
  listAssociates,
  listCertificationsByAssociate,
  listDepartments,
  listEquipment,
  listShiftKeys,
} from '@/features/config/queries';

export default async function AssociatesPage() {
  await requireRole(CONFIG_MANAGER_ROLES);
  const [associates, departments, shiftKeys, equipment, certifications] =
    await Promise.all([
      listAssociates(),
      listDepartments(),
      listShiftKeys(),
      listEquipment(),
      listCertificationsByAssociate(),
    ]);

  return (
    <>
      <PageHeader
        title="Associates"
        description="Manage the workforce: departments, default keys, and equipment certifications."
      />
      <AssociateManager
        items={associates}
        departments={departments}
        shiftKeys={shiftKeys}
        equipment={equipment}
        certifications={certifications}
      />
    </>
  );
}
