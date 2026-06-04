import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { TemplateEditor } from '@/components/templates/template-editor';
import { requireRole, TEMPLATE_MANAGER_ROLES } from '@/features/auth/queries';
import {
  listDepartments,
  listDockDoors,
  listEquipment,
  listShiftKeys,
  listTasks,
} from '@/features/config/queries';
import { getTemplate, listTemplateItems } from '@/features/templates/queries';

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(TEMPLATE_MANAGER_ROLES);
  const { id } = await params;

  const template = await getTemplate(id);
  if (!template) notFound();

  const [items, departments, shiftKeys, tasks, equipment, dockDoors] =
    await Promise.all([
      listTemplateItems(id),
      listDepartments(),
      listShiftKeys(),
      listTasks(),
      listEquipment(),
      listDockDoors(),
    ]);

  return (
    <>
      <PageHeader
        title={template.name}
        description="Edit the template details and manage its line items."
      />
      <TemplateEditor
        template={template}
        items={items}
        departments={departments}
        shiftKeys={shiftKeys}
        tasks={tasks}
        equipment={equipment}
        dockDoors={dockDoors}
      />
    </>
  );
}
