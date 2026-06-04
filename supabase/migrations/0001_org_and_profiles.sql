-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0001
-- Phase 2: Organization tables, profiles, auth bootstrap, and Row Level Security.
--
-- Scope is intentionally limited to what Authentication & Roles needs
-- (facilities, departments, shift_keys, profiles). Operational tables
-- (tasks, equipment, plans, …) arrive in later phases.
--
-- Apply via Supabase Dashboard → SQL Editor. Safe to re-run (idempotent).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Organization
-- ---------------------------------------------------------------------------
create table if not exists public.facilities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (facility_id, name)
);

create table if not exists public.shift_keys (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.facilities (id) on delete cascade,
  name         text not null,
  start_time   time not null,
  end_time     time not null,
  days_of_week text not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (facility_id, name)
);

-- ---------------------------------------------------------------------------
-- Profiles — links a Supabase Auth user to an application role + facility.
-- The role CHECK lists the Phase-2 roles; adding a role later is a one-line
-- migration (no application code change), per PRD §3 configurable roles.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null default '',
  email         text not null,
  role          text not null default 'viewer'
                  check (role in ('admin', 'supervisor', 'inbound_leader', 'outbound_leader', 'viewer')),
  facility_id   uuid references public.facilities (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists profiles_facility_idx on public.profiles (facility_id);

-- ---------------------------------------------------------------------------
-- Auth helper functions.
-- SECURITY DEFINER so RLS policies can read the caller's role/facility WITHOUT
-- recursing into the profiles RLS policies (the classic recursive-policy trap).
-- search_path is pinned to public to keep them injection-safe.
-- ---------------------------------------------------------------------------
create or replace function public.auth_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_user_facility()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select facility_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Auto-provision a profile when a new auth user is created. New users start as
-- 'viewer' (least privilege) in the default facility; an admin promotes them.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_facility uuid;
begin
  select id into default_facility
  from public.facilities
  where code = 'DFC 5523'
  limit 1;

  insert into public.profiles (id, email, full_name, facility_id, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    default_facility,
    'viewer'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security — enabled on every table (Engineering Standards §3).
-- ---------------------------------------------------------------------------
alter table public.facilities  enable row level security;
alter table public.departments enable row level security;
alter table public.shift_keys  enable row level security;
alter table public.profiles    enable row level security;

-- Profiles: a user reads their own profile; admins/supervisors read profiles in
-- their facility.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (
      facility_id = public.auth_user_facility()
      and public.auth_user_role() in ('admin', 'supervisor')
    )
  );

-- A user may edit their own profile but cannot change their role or facility.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.auth_user_role()
    and facility_id is not distinct from public.auth_user_facility()
  );

-- Admins fully manage profiles within their facility.
drop policy if exists profiles_admin_manage on public.profiles;
create policy profiles_admin_manage on public.profiles
  for all to authenticated
  using (
    public.auth_user_role() = 'admin'
    and facility_id = public.auth_user_facility()
  )
  with check (
    public.auth_user_role() = 'admin'
    and facility_id = public.auth_user_facility()
  );

-- Facilities / departments / shift_keys: readable by authenticated users in the
-- same facility; writable only by admins of that facility.
drop policy if exists facilities_select on public.facilities;
create policy facilities_select on public.facilities
  for select to authenticated
  using (id = public.auth_user_facility());

drop policy if exists facilities_admin_all on public.facilities;
create policy facilities_admin_all on public.facilities
  for all to authenticated
  using (id = public.auth_user_facility() and public.auth_user_role() = 'admin')
  with check (id = public.auth_user_facility() and public.auth_user_role() = 'admin');

drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists departments_admin_all on public.departments;
create policy departments_admin_all on public.departments
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_user_role() = 'admin')
  with check (facility_id = public.auth_user_facility() and public.auth_user_role() = 'admin');

drop policy if exists shift_keys_select on public.shift_keys;
create policy shift_keys_select on public.shift_keys
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists shift_keys_admin_all on public.shift_keys;
create policy shift_keys_admin_all on public.shift_keys
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_user_role() = 'admin')
  with check (facility_id = public.auth_user_facility() and public.auth_user_role() = 'admin');
