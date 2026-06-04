import { TvAssignmentCard } from './tv-assignment-card';
import { TvAvailablePool } from './tv-available-pool';
import type { TvPlanView } from '@/features/tv/queries';

/**
 * A full department board for TV Mode (one published plan). Outbound groups by
 * task; inbound groups by dock door (task shown on each card) plus its active
 * doors, special assignments, and the available pool.
 */
export function TvSection({ view }: { view: TvPlanView }) {
  const isInbound = view.kind === 'inbound';

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-white/10 pb-4">
        <h2 className="text-primary text-4xl font-bold tracking-tight">
          {view.departmentName}
        </h2>
        <p className="text-foreground-muted text-2xl">{view.shiftKeyName}</p>
      </header>

      {isInbound && view.activeDoorNumbers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground-muted text-lg">Active doors:</span>
          {view.activeDoorNumbers.map((n) => (
            <span
              key={n}
              className="border-primary/40 text-foreground rounded-full border px-4 py-1 text-lg font-medium"
            >
              {n}
            </span>
          ))}
        </div>
      ) : null}

      {view.groups.length === 0 && view.specials.length === 0 ? (
        <p className="text-foreground-muted text-2xl">No assignments yet.</p>
      ) : (
        <div className="space-y-8">
          {view.groups.map((group) => (
            <div key={group.key} className="space-y-3">
              <h3 className="text-foreground text-2xl font-semibold">
                {group.label}
                <span className="text-foreground-subtle ml-2 text-xl font-normal">
                  ({group.cards.length})
                </span>
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {group.cards.map((card) => (
                  <TvAssignmentCard
                    key={card.assignmentId}
                    card={card}
                    showTask={group.key.startsWith('door:')}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view.specials.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-foreground text-2xl font-semibold">
            Special assignments
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {view.specials.map((s) => (
              <div
                key={s.id}
                className="border-border bg-surface rounded-xl border p-5"
              >
                <p className="text-primary text-lg font-semibold">{s.label}</p>
                <p className="text-foreground mt-1 truncate text-2xl font-semibold">
                  {s.associateName}
                  {s.relatedName ? (
                    <span className="text-foreground-muted text-xl">
                      {' '}
                      + {s.relatedName}
                    </span>
                  ) : null}
                </p>
                {s.taskName ? (
                  <p className="text-foreground-muted mt-1 text-lg">
                    {s.taskName}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!isInbound && view.middleMileOwner === 'inbound' ? (
        <p className="text-foreground-muted text-xl">
          Middle Mile handled by Inbound.
        </p>
      ) : null}

      <TvAvailablePool names={view.pool} />
    </section>
  );
}
