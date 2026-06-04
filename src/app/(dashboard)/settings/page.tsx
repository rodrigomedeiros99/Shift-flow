import Link from 'next/link';
import {
  Users,
  ClipboardList,
  Forklift,
  DoorClosed,
  Building2,
  KeyRound,
  ScrollText,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui';
import { CONFIG_MANAGER_ROLES, requireRole } from '@/features/auth/queries';

/** Configuration areas reachable from Settings (PRD §10). */
const CONFIG_SECTIONS: ReadonlyArray<{
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    title: 'Associates',
    description: 'Workforce, default keys, departments, and certifications.',
    href: '/associates',
    icon: Users,
  },
  {
    title: 'Tasks',
    description: 'Outbound and inbound task types.',
    href: '/tasks',
    icon: ClipboardList,
  },
  {
    title: 'Equipment',
    description: 'Equipment types and certification requirements.',
    href: '/equipment',
    icon: Forklift,
  },
  {
    title: 'Dock Doors',
    description: 'Configurable dock door list for inbound planning.',
    href: '/dock-doors',
    icon: DoorClosed,
  },
  {
    title: 'Departments',
    description: 'Configurable operational departments.',
    href: '/settings/departments',
    icon: Building2,
  },
  {
    title: 'Shift Keys',
    description: 'Shift key schedules and operating days.',
    href: '/settings/shift-keys',
    icon: KeyRound,
  },
  {
    title: 'Audit Log',
    description: 'Recent plan and live-operations actions, for review.',
    href: '/settings/audit',
    icon: ScrollText,
  },
];

export default async function SettingsPage() {
  await requireRole(CONFIG_MANAGER_ROLES);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure operational data so plans never depend on hardcoded values."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CONFIG_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href} className="group">
              <Card className="hover:border-primary/60 transition-colors">
                <CardContent className="flex items-start gap-4">
                  <span className="bg-surface-raised text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-foreground text-sm font-semibold">
                      {section.title}
                    </h2>
                    <p className="text-foreground-muted mt-1 text-sm">
                      {section.description}
                    </p>
                  </div>
                  <ChevronRight
                    className="text-foreground-subtle h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
