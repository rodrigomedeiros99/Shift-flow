import { cn } from '@/lib/utils/cn';
import { getEquipmentBadgeClass } from '@/lib/utils/equipment-badge';
import { AnimatedCount } from './tv-status';
import type { TvCard, TvPlanView } from '@/features/tv/queries';

/**
 * TV Mode — Operations Command Center. Each task / special / unload group is a
 * frosted-glass card: an orange gradient header band with the label + a live
 * headcount pill, then the assigned associates listed below, each with their
 * equipment "role" badge (Clamp / Pacer / Walk …). Cards flow in a responsive
 * auto-fill grid and fade in with a staggered entrance. Built from the shared
 * `.tv-*` classes so the same board renders in Light, Dark, and System.
 *
 * Outbound cards follow a fixed business order (matched by keyword so it
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

/** Fixed business hierarchy index for a task card (lower = earlier). */
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

function compactName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0]} ${parts[parts.length - 1]?.[0] ?? ''}.`;
}

/** One assigned associate — the board's most important element. */
interface Person {
  id: string;
  name: string;
  /** Equipment "role" chip (secondary); specials carry none. */
  equip?: string;
  /** Dock door chip (inbound unload). */
  door?: string;
}

interface Panel {
  key: string;
  label: string;
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
      count: g.cards.length,
      people: g.cards.map((c) => ({
        id: c.assignmentId,
        name: compactName(c.associateName),
        equip: c.equipmentName ?? undefined,
      })),
      order: order === 999 ? 1000 + unmatched++ : order,
    });
  }

  // Inbound: unload door assignments collapse into one card; each person keeps
  // their own dock door + equipment chip.
  if (doorCards.length > 0) {
    panels.push({
      key: 'doors',
      label: 'Unload',
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

  // Specials become cards too, slotted into the fixed order.
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
      count: people.length,
      people,
      order: SPECIAL_ORDER[type],
    });
  }

  return panels.sort((a, b) => a.order - b.order);
}

/** Equipment / dock-door "role" badge beside a name. */
function Badge({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-md border px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase xl:text-xs',
        className ?? 'border-border bg-surface-raised text-foreground-muted',
      )}
    >
      {children}
    </span>
  );
}

function TaskCard({ panel, index }: { panel: Panel; index: number }) {
  return (
    <div
      className="tv-card tv-card-enter flex h-full min-w-0 flex-col overflow-hidden rounded-2xl"
      style={{ animationDelay: `${Math.min(index, 14) * 70}ms` }}
    >
      {/* Orange gradient header band: label + live count pill. */}
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#f97316] to-[#fb923c] px-3.5 py-2">
        <span className="truncate text-sm font-extrabold tracking-wider text-white uppercase xl:text-base">
          {panel.label}
        </span>
        <span className="tv-count-pill rounded-full px-2.5 py-0.5 text-xs font-bold text-white tabular-nums">
          <AnimatedCount target={panel.count} />
        </span>
      </div>

      {/* Associates — the dominant element. */}
      {panel.people.length > 0 ? (
        <ul className="flex flex-col gap-1.5 p-3">
          {panel.people.map((p) => (
            <li
              key={p.id}
              className="tv-row flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
            >
              <span className="text-foreground min-w-0 truncate text-[15px] leading-tight font-semibold xl:text-lg">
                {p.name}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {p.door ? <Badge>{`D${p.door}`}</Badge> : null}
                {p.equip ? (
                  <Badge className={getEquipmentBadgeClass(p.equip)}>
                    {p.equip}
                  </Badge>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-foreground-subtle px-3 py-2.5 text-sm">Unassigned</p>
      )}
    </div>
  );
}

export function TvSection({ view }: { view: TvPlanView }) {
  const isInbound = view.kind === 'inbound';
  const panels = buildPanels(view);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 px-1">
        <h2 className="text-foreground text-lg font-extrabold tracking-widest uppercase">
          {view.departmentName}
        </h2>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
          <p className="text-foreground-subtle text-xs tracking-widest uppercase">
            {view.shiftKeyName}
          </p>
          {isInbound && view.activeDoorNumbers.length > 0 ? (
            <p className="text-foreground-subtle text-xs">
              Doors: {view.activeDoorNumbers.join(', ')}
            </p>
          ) : null}
        </div>
      </header>

      {panels.length === 0 ? (
        <p className="text-foreground-muted text-xl">No assignments yet.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] items-start gap-3.5">
          {panels.map((p, i) => (
            <TaskCard key={p.key} panel={p} index={i} />
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
