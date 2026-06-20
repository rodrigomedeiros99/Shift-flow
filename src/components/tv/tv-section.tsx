import {
  Boxes,
  ClipboardCheck,
  DoorOpen,
  Forklift,
  GraduationCap,
  Grid2x2,
  Layers,
  type LucideIcon,
  MapPin,
  Package,
  Route,
  Scissors,
  Timer,
  Truck,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { getEquipmentBadgeClass } from '@/lib/utils/equipment-badge';
import type { TvCard, TvPlanView } from '@/features/tv/queries';

/**
 * TV Mode — Operations Command Center. Each task/special is a panel: an orange
 * header band with a task icon + name, a large headcount, the equipment under
 * it, and the assigned associates listed below. Panels flow in a responsive
 * grid that fills the screen width and wraps side-by-side (no page scroll on a
 * TV; stacks + scrolls on phones). Built entirely from semantic theme tokens so
 * the same component renders in Light, Dark, and System.
 *
 * Outbound panels follow a fixed business order (matched by keyword so it
 * survives task-name spelling):
 *   1 CL · 2 FLR · 3 OBL · 4 PA/TL · 5 Trim Overbox · 6 Flooring Overbox ·
 *   7-9 Load Zone 1/2/3 · 10 All Zone Load.
 * Specials (Middle Mile · ICQA Support · Overtime · Training) follow, then any
 * unmatched task, each keeping its relative order.
 */

const SPECIAL_LABELS = {
  middle_mile: 'Middle Mile',
  icqa_support: 'ICQA Support',
  support_outbound: 'Support Outbound',
  training: 'Training',
  overtime: 'Overtime',
} as const;
type SpecialKey = keyof typeof SPECIAL_LABELS;

function specialType(label: string): SpecialKey | null {
  const e = Object.entries(SPECIAL_LABELS).find(([, v]) => v === label);
  return e ? (e[0] as SpecialKey) : null;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

const SPECIAL_ORDER: Record<SpecialKey, number> = {
  middle_mile: 20,
  icqa_support: 21,
  overtime: 22,
  training: 23,
  support_outbound: 24,
};

const SPECIAL_ICON: Record<SpecialKey, LucideIcon> = {
  middle_mile: Route,
  icqa_support: ClipboardCheck,
  overtime: Timer,
  training: GraduationCap,
  support_outbound: Package,
};

/** Fixed business hierarchy index for a task panel (lower = earlier). */
function taskOrder(label: string): number {
  const n = norm(label);
  if (n === 'cl') return 1;
  if (n === 'flr') return 2;
  if (n === 'obl') return 3;
  if (n.includes('pa/tl') || n === 'pa' || n === 'tl') return 4;
  if (n.includes('overbox') && n.includes('trim')) return 5;
  if (n.includes('overbox') && n.includes('flor')) return 6;
  if (n.includes('all zone')) return 10;
  if (n.includes('zone')) {
    const d = Number(n.match(/\d+/)?.[0] ?? '1');
    return 7 + Math.max(0, d - 1); // Zone 1 -> 7, Zone 2 -> 8, Zone 3 -> 9
  }
  return 999;
}

/** A distinct icon per task family (falls back to a generic box icon). */
function taskIcon(label: string): LucideIcon {
  const n = norm(label);
  if (n === 'cl') return Forklift;
  if (n === 'flr') return Layers;
  if (n === 'obl') return Boxes;
  if (n.includes('pa/tl') || n === 'pa' || n === 'tl') return UserCog;
  if (n.includes('overbox') && n.includes('trim')) return Scissors;
  if (n.includes('overbox') && n.includes('flor')) return Grid2x2;
  if (n.includes('all zone')) return Truck;
  if (n.includes('zone')) return MapPin;
  return Package;
}

function compactName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0]} ${parts[parts.length - 1]?.[0] ?? ''}.`;
}

/** One assigned associate — the board's most important element. */
interface Person {
  id: string;
  name: string;
  /** Equipment chip (secondary); specials carry none (data fallback). */
  equip?: string;
  /** Dock door chip (inbound unload). */
  door?: string;
}

interface Panel {
  key: string;
  label: string;
  icon: LucideIcon;
  count: number;
  people: Person[];
  order: number;
}

function buildPanels(view: TvPlanView): Panel[] {
  const panels: Panel[] = [];
  const doorCards: TvCard[] = [];
  let unmatched = 0;

  for (const g of view.groups) {
    if (g.key.startsWith('door:')) {
      doorCards.push(...g.cards);
      continue;
    }
    if (g.cards.length === 0) continue;
    const order = taskOrder(g.label);
    panels.push({
      key: g.key,
      label: g.label,
      icon: taskIcon(g.label),
      count: g.cards.length,
      people: g.cards.map((c) => ({
        id: c.assignmentId,
        name: compactName(c.associateName),
        equip: c.equipmentName ?? undefined,
      })),
      order: order === 999 ? 1000 + unmatched++ : order,
    });
  }

  // Inbound: unload door assignments collapse into one panel; each person keeps
  // their own dock door + equipment chip.
  if (doorCards.length > 0) {
    panels.push({
      key: 'doors',
      label: 'Unload',
      icon: DoorOpen,
      count: doorCards.length,
      people: doorCards.map((c) => ({
        id: c.assignmentId,
        name: compactName(c.associateName),
        equip: c.equipmentName ?? undefined,
        door: c.doorNumber ?? undefined,
      })),
      order: 1000 + unmatched++,
    });
  }

  // Specials become panels too, slotted into the fixed order.
  const byType = new Map<SpecialKey, Person[]>();
  for (const s of view.specials) {
    const t = specialType(s.label);
    if (!t) continue;
    const name =
      compactName(s.associateName) +
      (s.relatedName ? ` + ${compactName(s.relatedName)}` : '');
    const list = byType.get(t) ?? [];
    list.push({ id: s.id, name });
    byType.set(t, list);
  }
  for (const [type, people] of byType) {
    if (people.length === 0) continue;
    panels.push({
      key: `special-${type}`,
      label: SPECIAL_LABELS[type],
      icon: SPECIAL_ICON[type],
      count: people.length,
      people,
      order: SPECIAL_ORDER[type],
    });
  }

  return panels.sort((a, b) => a.order - b.order);
}

/** Small secondary chip (equipment / dock door) shown beside a name. */
function Chip({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase xl:text-xs',
        className ?? 'border-border bg-surface-raised text-foreground-muted',
      )}
    >
      {children}
    </span>
  );
}

function TaskPanel({ panel }: { panel: Panel }) {
  const Icon = panel.icon;
  return (
    <div className="border-border bg-surface hover:border-primary/60 flex h-full min-w-0 flex-col overflow-hidden rounded-xl border shadow-lg transition-colors">
      {/* Header (secondary): task icon + name with the count inline — never a
          giant standalone number. */}
      <div className="bg-primary text-primary-foreground flex items-center gap-1.5 px-3 py-1.5">
        <Icon className="size-4 shrink-0 xl:size-5" strokeWidth={2.5} />
        <span className="truncate text-sm font-bold tracking-wide uppercase xl:text-base">
          {panel.label}
        </span>
        <span className="ml-auto text-sm font-bold tabular-nums opacity-90 xl:text-base">
          ({panel.count})
        </span>
      </div>

      {/* Associate names — the dominant element: large, high contrast. */}
      {panel.people.length > 0 ? (
        <ul className="divide-border/60 flex flex-col divide-y">
          {panel.people.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 px-3 py-1.5"
            >
              <span className="text-foreground min-w-0 truncate text-lg leading-tight font-bold xl:text-2xl">
                {p.name}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {p.door ? <Chip>{`D${p.door}`}</Chip> : null}
                {p.equip ? (
                  <Chip className={getEquipmentBadgeClass(p.equip)}>
                    {p.equip}
                  </Chip>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-foreground-subtle px-3 py-2 text-sm">Unassigned</p>
      )}
    </div>
  );
}

export function TvSection({ view }: { view: TvPlanView }) {
  const isInbound = view.kind === 'inbound';
  const panels = buildPanels(view);

  return (
    <section className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      <header className="border-border flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 border-b pb-1.5">
        <h2 className="text-foreground text-2xl font-bold tracking-tight">
          {view.departmentName}
        </h2>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
          <p className="text-foreground-muted text-lg">{view.shiftKeyName}</p>
          {isInbound && view.activeDoorNumbers.length > 0 ? (
            <p className="text-foreground-subtle text-sm">
              Doors: {view.activeDoorNumbers.join(', ')}
            </p>
          ) : null}
        </div>
      </header>

      {panels.length === 0 ? (
        <p className="text-foreground-muted text-xl">No assignments yet.</p>
      ) : (
        <div
          className={cn(
            'grid items-stretch gap-3',
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
          )}
        >
          {panels.map((p) => (
            <TaskPanel key={p.key} panel={p} />
          ))}
        </div>
      )}

      {!isInbound && view.middleMileOwner === 'inbound' ? (
        <p className="text-foreground-subtle text-sm">
          Middle Mile handled by Inbound.
        </p>
      ) : null}
    </section>
  );
}
