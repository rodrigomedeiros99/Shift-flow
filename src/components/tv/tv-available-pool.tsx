/** Available-labor panel for TV Mode (PRD §8 "Available Pool Visibility"). */
export function TvAvailablePool({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-foreground text-2xl font-semibold">
        Available
        <span className="text-foreground-subtle ml-2 text-xl font-normal">
          ({names.length})
        </span>
      </h3>
      <div className="flex flex-wrap gap-3">
        {names.map((name) => (
          <span
            key={name}
            className="border-border bg-surface text-foreground rounded-full border px-5 py-2 text-xl"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
