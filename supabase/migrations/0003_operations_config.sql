-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0003
-- Phase 3: Operational configuration tables (workforce + operations) with RLS.
--
-- Adds equipment_types, task_types, dock_doors, associates, and
-- associate_certifications. Also widens write access on departments/shift_keys
-- to supervisors (Phase 3 goal: "supervisors/admins configure operational data").
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Authorization helper: who may manage configuration (admin or supervisor).
-- SECURITY DEFINER to avoid recursing into RLS (see migration 0001).
-- ---------------------------------------------------------------------------
create or replace function public.auth_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_user_role() in ('admin', 'supervisor'), false);
$$;

-- ---------------------------------------------------------------------------
-- Equipment types (Clamp, Pacer, EPJ, …)
-- ---------------------------------------------------------------------------
create table if not exists public.equipment_types (
  id                     uuid primary key default gen_random_uuid(),
  facility_id            uuid not null references public.facilities (id) on delete cascade,
  name                   text not null,
  certification_required boolean not null default true,
  active                 boolean not null default true,
  created_at             timestamptz not null default now(),
  unique (facility_id, name)
);

-- ---------------------------------------------------------------------------
-- Task types (CL, FLR, Unload, Put Away, …) — department-scoped, configurable.
-- ---------------------------------------------------------------------------
create table if not exists public.task_types (
  id                   uuid primary key default gen_random_uuid(),
  facility_id          uuid not null references public.facilities (id) on delete cascade,
  department_id        uuid not null references public.departments (id) on delete restrict,
  name                 text not null,
  default_equipment_id uuid references public.equipment_types (id) on delete set null,
  active               boolean not null default true,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  unique (facility_id, department_id, name)
);

create index if not exists task_types_dept_active_idx
  on public.task_types (department_id, active);

-- ---------------------------------------------------------------------------
-- Dock doors (inbound) — configurable, never hardcoded.
-- ---------------------------------------------------------------------------
create table if not exists public.dock_doors (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  door_number text not null,
  active      boolean not null default true,
  notes       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (facility_id, door_number)
);

create index if not exists dock_doors_facility_active_idx
  on public.dock_doors (facility_id, active);

-- ---------------------------------------------------------------------------
-- Associates (the workforce). Never hard-deleted — use active/inactive.
-- ---------------------------------------------------------------------------
create table if not exists public.associates (
  id             uuid primary key default gen_random_uuid(),
  facility_id    uuid not null references public.facilities (id) on delete cascade,
  first_name     text not null,
  last_name      text not null,
  employee_id    text,
  department_id  uuid not null references public.departments (id) on delete restrict,
  default_key_id uuid not null references public.shift_keys (id) on delete restrict,
  active         boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists associates_facility_active_idx
  on public.associates (facility_id, active);
create index if not exists associates_department_idx
  on public.associates (department_id);

-- Employee IDs are unique within a facility when provided.
create unique index if not exists associates_facility_employee_id_uniq
  on public.associates (facility_id, employee_id)
  where employee_id is not null;

-- ---------------------------------------------------------------------------
-- Associate certifications (many-to-many associate ↔ equipment).
-- ---------------------------------------------------------------------------
create table if not exists public.associate_certifications (
  id           uuid primary key default gen_random_uuid(),
  associate_id uuid not null references public.associates (id) on delete cascade,
  equipment_id uuid not null references public.equipment_types (id) on delete cascade,
  certified    boolean not null default true,
  certified_at timestamptz not null default now(),
  unique (associate_id, equipment_id)
);

create index if not exists associate_certifications_associate_idx
  on public.associate_certifications (associate_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: read = any authenticated user in the facility;
-- write = managers (admin/supervisor) in the facility.
-- ---------------------------------------------------------------------------
alter table public.equipment_types          enable row level security;
alter table public.task_types               enable row level security;
alter table public.dock_doors               enable row level security;
alter table public.associates               enable row level security;
alter table public.associate_certifications enable row level security;

-- equipment_types
drop policy if exists equipment_types_select on public.equipment_types;
create policy equipment_types_select on public.equipment_types
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists equipment_types_manage on public.equipment_types;
create policy equipment_types_manage on public.equipment_types
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_is_manager())
  with check (facility_id = public.auth_user_facility() and public.auth_is_manager());

-- task_types
drop policy if exists task_types_select on public.task_types;
create policy task_types_select on public.task_types
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists task_types_manage on public.task_types;
create policy task_types_manage on public.task_types
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_is_manager())
  with check (facility_id = public.auth_user_facility() and public.auth_is_manager());

-- dock_doors
drop policy if exists dock_doors_select on public.dock_doors;
create policy dock_doors_select on public.dock_doors
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists dock_doors_manage on public.dock_doors;
create policy dock_doors_manage on public.dock_doors
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_is_manager())
  with check (facility_id = public.auth_user_facility() and public.auth_is_manager());

-- associates
drop policy if exists associates_select on public.associates;
create policy associates_select on public.associates
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists associates_manage on public.associates;
create policy associates_manage on public.associates
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_is_manager())
  with check (facility_id = public.auth_user_facility() and public.auth_is_manager());

-- associate_certifications (scoped via the parent associate's facility)
drop policy if exists associate_certifications_select on public.associate_certifications;
create policy associate_certifications_select on public.associate_certifications
  for select to authenticated
  using (
    exists (
      select 1 from public.associates a
      where a.id = associate_id and a.facility_id = public.auth_user_facility()
    )
  );

drop policy if exists associate_certifications_manage on public.associate_certifications;
create policy associate_certifications_manage on public.associate_certifications
  for all to authenticated
  using (
    public.auth_is_manager()
    and exists (
      select 1 from public.associates a
      where a.id = associate_id and a.facility_id = public.auth_user_facility()
    )
  )
  with check (
    public.auth_is_manager()
    and exists (
      select 1 from public.associates a
      where a.id = associate_id and a.facility_id = public.auth_user_facility()
    )
  );

-- ---------------------------------------------------------------------------
-- Widen departments / shift_keys writes from admin-only to managers, so
-- supervisors can configure them too (Phase 3 goal). Facilities stay admin-only.
-- ---------------------------------------------------------------------------
drop policy if exists departments_admin_all on public.departments;
drop policy if exists departments_manage on public.departments;
create policy departments_manage on public.departments
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_is_manager())
  with check (facility_id = public.auth_user_facility() and public.auth_is_manager());

drop policy if exists shift_keys_admin_all on public.shift_keys;
drop policy if exists shift_keys_manage on public.shift_keys;
create policy shift_keys_manage on public.shift_keys
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_is_manager())
  with check (facility_id = public.auth_user_facility() and public.auth_is_manager());
