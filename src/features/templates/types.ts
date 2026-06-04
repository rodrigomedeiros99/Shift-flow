/** Result returned by template mutations that don't need to return data. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Result of creating a template — carries the new id so the UI can navigate. */
export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };
