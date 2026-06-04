import { PageHeader } from '@/components/layout/page-header';
import { TaskManager } from '@/components/config/task-manager';
import { CONFIG_MANAGER_ROLES, requireRole } from '@/features/auth/queries';
import {
  listDepartments,
  listEquipment,
  listTasks,
} from '@/features/config/queries';

export default async function TasksPage() {
  await requireRole(CONFIG_MANAGER_ROLES);
  const [tasks, departments, equipment] = await Promise.all([
    listTasks(),
    listDepartments(),
    listEquipment(),
  ]);

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Configure outbound and inbound task types — add new ones without code changes."
      />
      <TaskManager
        items={tasks}
        departments={departments}
        equipment={equipment}
      />
    </>
  );
}
