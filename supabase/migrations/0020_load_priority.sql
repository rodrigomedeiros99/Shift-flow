-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0020
-- Load Priority Board (new module).
--
-- Tells outbound loaders which dock door/trailer to load first, by close time.
-- Separate from Labor TV Mode. Doors are identified by a self-contained text
-- `door_number` (NOT the inbound public.dock_doors registry) so outbound loading
-- doors (e.g. 704–755) need no prior dock-door config and door naming stays
-- flexible per facility.
--
-- Tables:
--   load_priority_door_configs     — configurable door setup (zone, lane, carrier)
--   load_priority_close_schedules  — default close time per door per weekday
--   load_priority_boards           — a daily board (date + shift key)
--   load_priority_entries          — daily door priorities (SNAPSHOTS)
--
-- Daily entries snapshot lane/carrier/zone/close-time so past boards never
-- change when config is later edited.
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger (create once; reused by the tables below).
-- ---------------------------------------------------------------------------
create or replace function public.lp_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. load_priority_door_configs — the configurable door setup.
--    zone is stored PER DOOR (ranges are configured by assignment, not hardcoded).
--    carrier_override, when set, is shown instead of the lane number.
-- ---------------------------------------------------------------------------
create table if not exists public.load_priority_door_configs (
  id                  uuid primary key default gen_random_uuid(),
  facility_id         uuid not null references public.facilities (id) on delete cascade,
  door_number         text not null,
  zone                smallint not null check (zone >= 1),
  default_lane_number text,
  carrier_override    text,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (facility_id, door_number)
);

create index if not exists lp_door_configs_facility_idx
  on public.load_priority_door_configs (facility_id);

drop trigger if exists lp_door_configs_updated_at on public.load_priority_door_configs;
create trigger lp_door_configs_updated_at
  before update on public.load_priority_door_configs
  for each row execute function public.lp_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. load_priority_close_schedules — default close time per door per weekday.
--    day_of_week: 0 = Sunday … 6 = Saturday (matches JS Date.getDay()).
-- ---------------------------------------------------------------------------
create table if not exists public.load_priority_close_schedules (
  id                 uuid primary key default gen_random_uuid(),
  facility_id        uuid not null references public.facilities (id) on delete cascade,
  door_config_id     uuid not null references public.load_priority_door_configs (id) on delete cascade,
  day_of_week        smallint not null check (day_of_week between 0 and 6),
  default_close_time time not null,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (door_config_id, day_of_week)
);

create index if not exists lp_close_schedules_config_idx
  on public.load_priority_close_schedules (door_config_id);

drop trigger if exists lp_close_schedules_updated_at on public.load_priority_close_schedules;
create trigger lp_close_schedules_updated_at
  before update on public.load_priority_close_schedules
  for each row execute function public.lp_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. load_priority_boards — one daily board per shift key + date.
-- ---------------------------------------------------------------------------
create table if not exists public.load_priority_boards (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.facilities (id) on delete cascade,
  shift_key_id uuid not null references public.shift_keys (id) on delete restrict,
  board_date   date not null,
  status       text not null default 'draft'
                 check (status in ('draft', 'published', 'closed')),
  created_by   uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (facility_id, shift_key_id, board_date)
);

create index if not exists lp_boards_facility_date_idx
  on public.load_priority_boards (facility_id, board_date);

drop trigger if exists lp_boards_updated_at on public.load_priority_boards;
create trigger lp_boards_updated_at
  before update on public.load_priority_boards
  for each row execute function public.lp_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. load_priority_entries — the daily door priorities. Everything shown on the
--    board is snapshotted here so later config edits never rewrite history.
-- ---------------------------------------------------------------------------
create table if not exists public.load_priority_entries (
  id                    uuid primary key default gen_random_uuid(),
  board_id              uuid not null references public.load_priority_boards (id) on delete cascade,
  facility_id           uuid not null references public.facilities (id) on delete cascade,
  door_number           text not null,
  zone                  smallint not null check (zone >= 1),
  lane_number_snapshot  text,
  carrier_label_snapshot text,
  close_time            time,
  status                text not null default 'open' check (status in ('open', 'closed')),
  closed_at             timestamptz,
  closed_by             uuid references public.profiles (id) on delete set null,
  notes                 text,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (board_id, door_number)
);

create index if not exists lp_entries_board_idx
  on public.load_priority_entries (board_id);

drop trigger if exists lp_entries_updated_at on public.load_priority_entries;
create trigger lp_entries_updated_at
  before update on public.load_priority_entries
  for each row execute function public.lp_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS. Read = anyone in the facility (viewers watch the TV). Config (door setup +
-- close schedules) = managers (auth_is_manager). Boards + entries = planners
-- (auth_can_plan). Facility scoped via auth_user_facility().
-- ---------------------------------------------------------------------------
alter table public.load_priority_door_configs    enable row level security;
alter table public.load_priority_close_schedules enable row level security;
alter table public.load_priority_boards          enable row level security;
alter table public.load_priority_entries         enable row level security;

-- door_configs -------------------------------------------------------------
drop policy if exists lp_door_configs_select on public.load_priority_door_configs;
create policy lp_door_configs_select on public.load_priority_door_configs
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists lp_door_configs_manage on public.load_priority_door_configs;
create policy lp_door_configs_manage on public.load_priority_door_configs
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_is_manager())
  with check (facility_id = public.auth_user_facility() and public.auth_is_manager());

-- close_schedules ----------------------------------------------------------
drop policy if exists lp_close_schedules_select on public.load_priority_close_schedules;
create policy lp_close_schedules_select on public.load_priority_close_schedules
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists lp_close_schedules_manage on public.load_priority_close_schedules;
create policy lp_close_schedules_manage on public.load_priority_close_schedules
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_is_manager())
  with check (facility_id = public.auth_user_facility() and public.auth_is_manager());

-- boards -------------------------------------------------------------------
drop policy if exists lp_boards_select on public.load_priority_boards;
create policy lp_boards_select on public.load_priority_boards
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists lp_boards_manage on public.load_priority_boards;
create policy lp_boards_manage on public.load_priority_boards
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_can_plan())
  with check (facility_id = public.auth_user_facility() and public.auth_can_plan());

-- entries ------------------------------------------------------------------
drop policy if exists lp_entries_select on public.load_priority_entries;
create policy lp_entries_select on public.load_priority_entries
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists lp_entries_manage on public.load_priority_entries;
create policy lp_entries_manage on public.load_priority_entries
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_can_plan())
  with check (facility_id = public.auth_user_facility() and public.auth_can_plan());

-- ---------------------------------------------------------------------------
-- Realtime: stream board + entry changes so the TV updates live (same
-- publication TV/Live/Notifications use). Idempotent add.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'load_priority_boards'
  ) then
    execute 'alter publication supabase_realtime add table public.load_priority_boards';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'load_priority_entries'
  ) then
    execute 'alter publication supabase_realtime add table public.load_priority_entries';
  end if;
end $$;
