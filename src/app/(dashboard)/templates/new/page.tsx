import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui';
import { TemplateForm } from '@/components/templates/template-form';
import { requireRole, TEMPLATE_MANAGER_ROLES } from '@/features/auth/queries';
import { listDepartments, listShiftKeys } from '@/features/config/queries';

export default async function NewTemplatePage() {
  await requireRole(TEMPLATE_MANAGER_ROLES);
  const [departments, shiftKeys] = await Promise.all([
    listDepartments(),
    listShiftKeys(),
  ]);

  return (
    <>
      <PageHeader
        title="New template"
        description="Name the template and choose its department and shift key. You'll add line items next."
      />
      <Card className="max-w-2xl">
        <CardContent>
          <TemplateForm departments={departments} shiftKeys={shiftKeys} />
        </CardContent>
      </Card>
    </>
  );
}
