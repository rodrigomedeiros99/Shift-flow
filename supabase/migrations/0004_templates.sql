-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0004
-- Phase 4: Planning templates (reusable plans) with RLS.
--
-- Adds plan_templates (header) and template_items (line items). Templates are
-- scoped by department (which encodes inbound vs outbound) and shift key, and
-- reference the configurable task_types / dock_doors / equipment_types from
-- Phase 3 — nothing operational is hardcoded.
--
-- Write access is granted to "planners" (admin, supervisor, inbound_leader,
-- outbound_leader) — the leaders who build daily plans (roadmap Phase 4).
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Authorization helper: who may manage templates (any planning leader).
-- SECURITY DEFINER to avoid recursing into RLS (see migration 0001).
-- ---------------------------------------------------------------------------
create or replace function public.auth_can_plan()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.auth_user_role() in
      ('admin', 'supervisor', 'inbound_leader', 'outbound_leader'),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Plan templates (header). One per facility/department/key/name.
-- Archived via active=false to preserve historical integrity (never deleted).
-- ---------------------------------------------------------------------------
create table if not exists public.plan_templates (
  id            uuid primary key default gen_random_uuid(),
  facility_id   uuid not null references public.facilities (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete restrict,
  shift_key_id  uuid not null references public.shift_keys (id) on delete restrict,
  name          text not null,
  active        boolean not null default true,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (facility_id, department_id, shift_key_id, name)
);

create index if not exists plan_templates_facility_active_idx
  on public.plan_templates (facility_id, active);

-- ---------------------------------------------------------------------------
-- Template items (line items). Each row is a planned slot:
--   task + equipment + (optional) dock door + how many people.
-- ---------------------------------------------------------------------------
create table if not exists public.template_items (
  id                   uuid primary key default gen_random_uuid(),
  template_id          uuid not null references public.plan_templates (id) on delete cascade,
  task_type_id         uuid references public.task_types (id) on delete restrict,
  dock_door_id         uuid references public.dock_doors (id) on delete set null,
  default_equipment_id uuid references public.equipment_types (id) on delete set null,
  people_needed        integer not null default 1 check (people_needed >= 1),
  sort_order           integer not null default 0,
  notes                text
);

create index if not exists template_items_template_sort_idx
  on public.template_items (template_id, sort_order);

-- ---------------------------------------------------------------------------
-- Row Level Security: read = any authenticated user in the facility;
-- write = planners (auth_can_plan) in the facility.
-- ---------------------------------------------------------------------------
alter table public.plan_templates enable row level security;
alter table public.template_items enable row level security;

-- plan_templates
drop policy if exists plan_templates_select on public.plan_templates;
create policy plan_templates_select on public.plan_templates
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists plan_templates_manage on public.plan_templates;
create policy plan_templates_manage on public.plan_templates
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_can_plan())
  with check (facility_id = public.auth_user_facility() and public.auth_can_plan());

-- template_items (scoped via the parent template's facility)
drop policy if exists template_items_select on public.template_items;
create policy template_items_select on public.template_items
  for select to authenticated
  using (
    exists (
      select 1 from public.plan_templates t
      where t.id = template_id and t.facility_id = public.auth_user_facility()
    )
  );

drop policy if exists template_items_manage on public.template_items;
create policy template_items_manage on public.template_items
  for all to authenticated
  using (
    public.auth_can_plan()
    and exists (
      select 1 from public.plan_templates t
      where t.id = template_id and t.facility_id = public.auth_user_facility()
    )
  )
  with check (
    public.auth_can_plan()
    and exists (
      select 1 from public.plan_templates t
      where t.id = template_id and t.facility_id = public.auth_user_facility()
    )
  );
