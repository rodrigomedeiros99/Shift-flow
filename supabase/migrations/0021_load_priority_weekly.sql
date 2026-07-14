-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0021
-- Load Priority: Weekly Master Schedule + configurable zone ranges.
--
-- Replaces the two-table recurring config (door_configs + close_schedules) with
-- a single flat weekly model: one row per (weekday, door) carrying lane/carrier,
-- close time, and zone. Adds a configurable zone-range table so zones aren't
-- hardcoded. Daily boards still snapshot into load_priority_entries; a new
-- source_weekly_schedule_id records provenance. Existing config is migrated, then
-- the old tables are dropped.
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. load_priority_zones — configurable zone ranges (Zone N = doors low..high).
--    Auto-assignment parses a door's digits and finds the containing range.
-- ---------------------------------------------------------------------------
create table if not exists public.load_priority_zones (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  zone        smallint not null check (zone >= 1),
  door_low    integer not null,
  door_high   integer not null,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (door_high >= door_low)
);

create index if not exists lp_zones_facility_idx
  on public.load_priority_zones (facility_id);

drop trigger if exists lp_zones_updated_at on public.load_priority_zones;
create trigger lp_zones_updated_at
  before update on public.load_priority_zones
  for each row execute function public.lp_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. load_priority_weekly_schedules — the recurring master (one row per weekday
--    per door). weekday: 0 = Sunday … 6 = Saturday. `active` rows are copied
--    into a daily board.
-- ---------------------------------------------------------------------------
create table if not exists public.load_priority_weekly_schedules (
  id            uuid primary key default gen_random_uuid(),
  facility_id   uuid not null references public.facilities (id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6),
  door_number   text not null,
  lane_number   text,
  carrier_label text,
  close_time    time not null,
  zone          smallint not null check (zone >= 1),
  active        boolean not null default true,
  notes         text,
  sort_order    integer not null default 0,
  created_by    uuid references public.profiles (id) on delete set null,
  updated_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (facility_id, weekday, door_number)
);

create index if not exists lp_weekly_facility_weekday_idx
  on public.load_priority_weekly_schedules (facility_id, weekday);

drop trigger if exists lp_weekly_updated_at on public.load_priority_weekly_schedules;
create trigger lp_weekly_updated_at
  before update on public.load_priority_weekly_schedules
  for each row execute function public.lp_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Provenance link on daily entries (snapshot columns unchanged).
-- ---------------------------------------------------------------------------
alter table public.load_priority_entries
  add column if not exists source_weekly_schedule_id uuid
    references public.load_priority_weekly_schedules (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. Migrate existing door_configs × close_schedules → weekly_schedules, then
--    drop the old tables. Guarded so a re-run (tables already gone) is a no-op.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'load_priority_close_schedules'
  ) then
    insert into public.load_priority_weekly_schedules
      (facility_id, weekday, door_number, lane_number, carrier_label,
       close_time, zone, active, sort_order)
    select c.facility_id, s.day_of_week, c.door_number, c.default_lane_number,
           c.carrier_override, s.default_close_time, c.zone,
           (c.active and s.active), 0
      from public.load_priority_close_schedules s
      join public.load_priority_door_configs c on c.id = s.door_config_id
    on conflict (facility_id, weekday, door_number) do nothing;
  end if;
end $$;

drop table if exists public.load_priority_close_schedules;
drop table if exists public.load_priority_door_configs;

-- ---------------------------------------------------------------------------
-- RLS. Read = facility (viewers watch the TV). Weekly master = planners
-- (auth_can_plan). Zone ranges = managers (auth_is_manager).
-- ---------------------------------------------------------------------------
alter table public.load_priority_zones             enable row level security;
alter table public.load_priority_weekly_schedules  enable row level security;

drop policy if exists lp_zones_select on public.load_priority_zones;
create policy lp_zones_select on public.load_priority_zones
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists lp_zones_manage on public.load_priority_zones;
create policy lp_zones_manage on public.load_priority_zones
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_is_manager())
  with check (facility_id = public.auth_user_facility() and public.auth_is_manager());

drop policy if exists lp_weekly_select on public.load_priority_weekly_schedules;
create policy lp_weekly_select on public.load_priority_weekly_schedules
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists lp_weekly_manage on public.load_priority_weekly_schedules;
create policy lp_weekly_manage on public.load_priority_weekly_schedules
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_can_plan())
  with check (facility_id = public.auth_user_facility() and public.auth_can_plan());
