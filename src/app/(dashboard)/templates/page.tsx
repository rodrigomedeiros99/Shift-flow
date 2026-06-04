import { PageHeader } from '@/components/layout/page-header';
import { TemplateManager } from '@/components/templates/template-manager';
import { requireRole, TEMPLATE_MANAGER_ROLES } from '@/features/auth/queries';
import { listDepartments, listShiftKeys } from '@/features/config/queries';
import { listTemplates } from '@/features/templates/queries';

export default async function TemplatesPage() {
  await requireRole(TEMPLATE_MANAGER_ROLES);
  const [templates, departments, shiftKeys] = await Promise.all([
    listTemplates(),
    listDepartments(),
    listShiftKeys(),
  ]);

  return (
    <>
      <PageHeader
        title="Templates"
        description="Reusable planning templates by department and shift key — so leaders don't build plans from zero."
      />
      <TemplateManager
        items={templates}
        departments={departments}
        shiftKeys={shiftKeys}
      />
    </>
  );
}
