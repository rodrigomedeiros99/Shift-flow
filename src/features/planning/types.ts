/** Result for planning mutations that don't return data. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Result for mutations that succeed but may carry a non-blocking warning (e.g.
 * a certification mismatch the leader chose to override).
 */
export type WarnResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

/**
 * Creating a draft plan can collide with an existing active plan for the same
 * facility/department/key/date — surfaced as a `duplicate` so the UI can offer
 * to open it (PRD §5: duplicate plan warning).
 */
export type CreateDraftResult =
  | { ok: true; id: string }
  | { ok: false; code: 'duplicate'; existingId: string }
  | { ok: false; error: string };

/** Summary returned by auto-generate so the UI can report the outcome. */
export type GenerateResult =
  | { ok: true; filled: number; open: number; pool: number; score: number }
  | { ok: false; error: string };
