# ShiftFlow DFC 5523 — Deployment Guide

Production deployment runbook (Phase 10). Target stack: **Next.js 16 on Vercel** +
**Supabase** (Postgres, Auth, Realtime, RLS).

---

## 1. Environment variables

| Variable | Scope | Where to find it | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser) | Supabase → Project Settings → API | Safe to expose. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (browser) | Supabase → Project Settings → API | Anon key; all access gated by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Supabase → Project Settings → API | **Never** expose to the browser. Only read via `src/lib/env-server.ts` (`server-only`). Not required at runtime today; keep it out of any `NEXT_PUBLIC_*` name. |

- Local: copy `.env.example` → `.env.local` (gitignored) and fill in.
- Vercel: add the three vars under **Project → Settings → Environment Variables**
  (Production + Preview). Do **not** prefix the service-role key with `NEXT_PUBLIC_`.

## 2. Supabase setup

1. Create the project; note the URL + anon + service-role keys.
2. **Run the migrations in order** in the SQL Editor (each is idempotent):
   `0001` → `0002` → `0003` → `0004` → `0005` → `0006` → `0007` → `0008` → `0009`.
3. **Realtime**: migrations `0007` and `0008` add the board + `activity_history` tables to
   the `supabase_realtime` publication. Ensure **Realtime is enabled** for the project
   (Database → Replication / Realtime). TV Mode and the live board depend on it (they also
   poll every 45s as a fallback).
4. **Auth**: enable Email/Password. For password sign-in to work, accounts must have a
   confirmed email — either keep **Auto Confirm** on for internal use, or confirm via the
   dashboard (see `supabase/README.md`).
5. Seed an admin: sign the first user up, then promote them to `admin` in `profiles`
   (or use the dashboard). Roles: `admin`, `supervisor`, `inbound_leader`,
   `outbound_leader`, `viewer`.

## 3. Vercel setup

- Framework preset: **Next.js**. Build: `npm run build`. Install: `npm install`.
- Node: 20+ (matches local). Output is server-rendered (dynamic routes + middleware/proxy).
- Add the env vars (section 1), then deploy. The `proxy.ts` (middleware) refreshes the
  Supabase session and gates routes.
- After the first deploy, confirm the production domain loads `/login` and that an
  authenticated user reaches `/dashboard`.

## 4. Security notes (verified in Phase 10)

- **Service-role isolation**: the key lives only in `src/lib/env-server.ts`, guarded by
  `import 'server-only'`; it is in **no** client bundle. Verify after build:
  `grep -r "service_role" .next/static` → no matches.
- **Headers/CSP**: set globally in `next.config.ts` (HSTS, X-Frame-Options SAMEORIGIN,
  nosniff, Referrer-Policy, Permissions-Policy, a conservative CSP, and
  `upgrade-insecure-requests` in production). `connect-src` allows Supabase REST + WSS.
  Script CSP keeps `'unsafe-inline'`; nonce-based scripts are deferred (Next's inline
  bootstrap + Turbopack make nonces brittle) — revisit if a stricter policy is required.
- **Dev tunnels**: `serverActions.allowedOrigins` is applied **only** in development
  (`NODE_ENV === 'development'`), so production CSRF stays same-origin-only.
- **RLS** is the authoritative gate on every table; `ROUTE_ACCESS`
  (`src/lib/auth/permissions.ts`) mirrors it for UI/route gating. Verify with
  `docs/QA-Checklist.md`.

## 5. Pre-launch gate

```bash
npm run typecheck && npm run lint && npm run format:check && npm run build
```

All four must pass. Then walk `docs/QA-Checklist.md`.
