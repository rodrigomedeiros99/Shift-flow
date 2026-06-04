import { PageHeader } from '@/components/layout/page-header';
import { DepartmentManager } from '@/components/config/department-manager';
import { CONFIG_MANAGER_ROLES, requireRole } from '@/features/auth/queries';
import { listDepartments } from '@/features/config/queries';

export default async function DepartmentsPage() {
  await requireRole(CONFIG_MANAGER_ROLES);
  const departments = await listDepartments();

  return (
    <>
      <PageHeader
        title="Departments"
        description="Organize operations into configurable departments."
      />
      <DepartmentManager items={departments} />
    </>
  );
}
