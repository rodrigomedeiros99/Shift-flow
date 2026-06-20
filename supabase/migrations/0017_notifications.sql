-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0017
-- v2.3: Notification Center (operational awareness).
--
-- A lightweight, per-recipient notification feed for warehouse operations — NOT
-- a social feed. Phase 1 covers five types: plan_published, draft_exists,
-- staffing_warning, rotation_alert, uph_warning. Each row targets one recipient
-- (`user_id`); a null `user_id` is reserved for a future facility/role broadcast.
--
-- Spam control: `dedupe_key` + a partial unique index let the app UPSERT a
-- condition (e.g. one active draft notice per plan) instead of inserting a
-- duplicate. `daily_plan_id` lets notifications auto-clear when a draft is
-- deleted (cascade) or published (app deletes by dedupe key).
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  facility_id   uuid not null references public.facilities (id) on delete cascade,
  -- Recipient. Null is reserved for a future facility/role-wide broadcast; Phase
  -- 1 always sets a concrete recipient (the plan's creator).
  user_id       uuid references public.profiles (id) on delete cascade,
  type          text not null check (
                  type in (
                    'plan_published',
                    'draft_exists',
                    'staffing_warning',
                    'rotation_alert',
                    'uph_warning'
                  )
                ),
  severity      text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title         text not null,
  message       text not null,
  link          text,
  -- Stable key for a recurring condition (e.g. 'draft:<planId>'); when set, the
  -- app upserts on (facility_id, dedupe_key) so a condition has at most one row.
  dedupe_key    text,
  daily_plan_id uuid references public.daily_plans (id) on delete cascade,
  is_read       boolean not null default false,
  read_at       timestamptz,
  -- "Clear read" archives (hides) rather than deleting — history is retained.
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, archived_at, is_read, created_at desc);

create index if not exists notifications_plan_idx
  on public.notifications (daily_plan_id);

-- One live row per condition per facility — supports UPSERT-on-dedupe.
create unique index if not exists notifications_dedupe_uidx
  on public.notifications (facility_id, dedupe_key)
  where dedupe_key is not null;

-- ---------------------------------------------------------------------------
-- RLS: a user reads their own (or facility-broadcast) notifications and may
-- update read-state on them; planners (auth_can_plan) emit/clear within their
-- facility from server actions. Facility scoped via auth_user_facility().
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    facility_id = public.auth_user_facility()
    and (user_id is null or user_id = auth.uid())
  );

-- Recipient may flip read-state (mark read / unread / clear) on their own rows.
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (
    facility_id = public.auth_user_facility()
    and (user_id is null or user_id = auth.uid())
  )
  with check (
    facility_id = public.auth_user_facility()
    and (user_id is null or user_id = auth.uid())
  );

-- Planners create notifications (fan-out from plan actions) within their facility.
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (
    public.auth_can_plan()
    and facility_id = public.auth_user_facility()
  );

-- Planners delete (auto-clear a resolved/published/deleted-draft condition).
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated
  using (
    public.auth_can_plan()
    and facility_id = public.auth_user_facility()
  );

-- ---------------------------------------------------------------------------
-- Realtime: stream notification changes so the bell's unread count live-updates
-- (same publication TV/Live use). Idempotent add.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;
