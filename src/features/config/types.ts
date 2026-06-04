/** Result returned by every config mutation server action. */
export type ActionResult = { ok: true } | { ok: false; error: string };
