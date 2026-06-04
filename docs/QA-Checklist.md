# ShiftFlow DFC 5523 — QA & Verification Checklist

Manual checklist for Phase 10 "Done When" (roadmap §10). Run against a deployment with the
migrations applied and at least one published plan + some live activity.

## A. Build gate

- [ ] `npm run typecheck` — no errors
- [ ] `npm run lint` — passes
- [ ] `npm run format:check` — clean
- [ ] `npm run build` — succeeds

## B. Role × route access (RLS + ROUTE_ACCESS)

Sign in as each role and confirm access matches. ✅ = reachable, 🚫 = blocked/hidden.

| Route | admin | supervisor | inbound_leader | outbound_leader | viewer |
| --- | --- | --- | --- | --- | --- |
| `/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/create-plan`, `/live-plan` | ✅ | ✅ | ✅ | ✅ | 🚫 |
| `/templates` | ✅ | ✅ | ✅ | ✅ | 🚫 |
| `/history` | ✅ | ✅ | ✅ | ✅ | 🚫 |
| `/tv` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/associates` `/tasks` `/equipment` `/dock-doors` `/settings` `/settings/audit` | ✅ | ✅ | 🚫 | 🚫 | 🚫 |

- [ ] Each role's nav shows only permitted items.
- [ ] Direct-URL access to a blocked route redirects/denies (not just hidden in nav).
- [ ] A `viewer` cannot mutate (create/publish/live actions) — RLS rejects even if forced.

## C. Cross-phase smoke test

- [ ] **Config**: add an associate, task, equipment, dock door; mark a department's `kind`.
- [ ] **Template**: build an outbound + an inbound template (inbound with a "per active door" item).
- [ ] **Outbound plan**: create → morning setup → auto-generate (cert-filtered, rotation score) → publish.
- [ ] **Inbound plan**: create → select active doors → auto-generate (groups by door) → publish.
- [ ] **TV** (`/tv`): both plans show; toggle Outbound/Inbound/Full; edit an assignment in
      another tab → TV updates within seconds; Present + Fullscreen work.
- [ ] **Live** (`/live-plan/[id]`): move / switch / complete (→ pool) / assign from pool /
      close shift; `planned_assignment_history` stays unchanged.
- [ ] **History** (`/history`): team distribution + special summary; pick an associate →
      separate Planned vs Activity panels + frequency + rotation badge.
- [ ] **Audit** (`/settings/audit`, admin): rows for create_plan, publish_plan,
      moved_associate, switched_assignment, close_shift.

## D. Security

- [ ] After `npm run build`: `grep -r "service_role" .next/static` returns nothing.
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` in any `NEXT_PUBLIC_*` var or client component.
- [ ] Response headers include HSTS, CSP, X-Frame-Options, X-Content-Type-Options.
- [ ] Unauthenticated access to any app route redirects to `/login`.

## E. Responsive / devices

Check layout and readability at each size (DevTools device toolbar + a real device where possible):

- [ ] **Mobile** (~390px): nav collapses, forms/cards stack, no horizontal scroll on key pages.
- [ ] **Tablet** (~768–1024px): grids reflow to 2 columns; modals usable.
- [ ] **Desktop** (≥1280px): full multi-column boards.
- [ ] **TV** (`/tv` on a large display, 1080p+): cards readable from a distance; Present mode
      hides chrome; status colors distinguishable.

## F. Realtime resilience

- [ ] With Realtime enabled, live/TV update within a few seconds of a change.
- [ ] With Realtime momentarily off, the 45s fallback poll still refreshes the views.
