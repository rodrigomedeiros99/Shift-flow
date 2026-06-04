-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0002
-- Seed baseline reference data for the initial facility.
--
-- These are operational defaults documented in PRD §4 / §10, not hardcoded in
-- application source. Idempotent — safe to re-run.
-- ============================================================================

-- Facility -------------------------------------------------------------------
insert into public.facilities (name, code)
values ('Home Depot DFC 5523', 'DFC 5523')
on conflict (code) do nothing;

-- Departments ----------------------------------------------------------------
insert into public.departments (facility_id, name)
select f.id, d.name
from public.facilities f
cross join (values ('Inbound'), ('Outbound'), ('ICQA'), ('Transportation'), ('Support')) as d(name)
where f.code = 'DFC 5523'
on conflict (facility_id, name) do nothing;

-- Shift keys (PRD §4 default schedules) --------------------------------------
insert into public.shift_keys (facility_id, name, start_time, end_time, days_of_week)
select f.id, k.name, k.start_time::time, k.end_time::time, k.days_of_week
from public.facilities f
cross join (values
  ('Key 1', '08:00', '18:30', 'Mon-Thu'),
  ('Key 2', '19:30', '05:30', 'Mon-Thu'),
  ('Key 3', '08:00', '20:30', 'Fri-Sun')
) as k(name, start_time, end_time, days_of_week)
where f.code = 'DFC 5523'
on conflict (facility_id, name) do nothing;
