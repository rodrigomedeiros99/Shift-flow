-- ============================================================================
-- ShiftFlow DFC 5523 — One-time PRE-PRODUCTION cleanup
-- Date: 2026-06-19
--
-- Purpose: remove ALL fake/test OPERATIONAL data before the Vercel production
-- deployment, leaving configuration, settings, profiles, auth users, RLS, the
-- schema, and migration history untouched.
--
-- This DELETES EVERY ROW from the operational tables below (pre-production, all
-- of their data is test data). It does NOT drop tables and does NOT touch:
--   facilities, departments, shift_keys, task_types (incl. UPH settings),
--   equipment_types, dock_doors, shift_keys.productive_hours, profiles, and
--   auth.users (admin and all auth users are preserved).
--
-- Safety:
--   * Wrapped in a single transaction (BEGIN … COMMIT) — all-or-nothing.
--   * Deletes in FK-safe order (children before parents). Every plan-child table
--     references associates with ON DELETE RESTRICT, so associates is deleted
--     LAST, after all of its references are gone.
--   * A verification SELECT runs INSIDE the transaction (before COMMIT) and must
--     show 0 for every table.
--
-- DRY RUN: change the final `COMMIT;` to `ROLLBACK;` to preview the zero-count
-- verification without persisting anything. Switch it back to COMMIT to apply.
--
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================================

begin;

-- 1) Notifications (child of daily_plans / profiles / facilities).
delete from public.notifications;

-- 2) Per-plan UPH calculation snapshots (child of daily_plans, task_types).
delete from public.plan_uph_calculations;

-- 3) Per-plan staffing needs (child of daily_plans, task_types).
delete from public.plan_staffing_needs;

-- 4) Per-plan active dock doors (child of daily_plans, dock_doors).
delete from public.plan_dock_doors;

-- 5) Live activity history (child of daily_plans; associates RESTRICT).
delete from public.activity_history;

-- 6) Board assignments (child of daily_plans; associates RESTRICT).
delete from public.assignments;

-- 7) Special assignments — overtime / middle mile / ICQA / training
--    (child of daily_plans; associates RESTRICT).
delete from public.special_assignments;

-- 8) Not-available / call-off / vacation / STO records
--    (child of daily_plans; associates RESTRICT).
delete from public.call_offs;

-- 9) Frozen planned-assignment history (associates RESTRICT).
delete from public.planned_assignment_history;

-- 10) Audit log of test actions (daily_plan / profiles SET NULL).
delete from public.audit_logs;

-- 11) Test planning templates (template_items cascade from plan_templates,
--     but deleted explicitly first for clarity).
delete from public.template_items;
delete from public.plan_templates;

-- 12) Daily plans (drafts, published, closed) — all child rows now removed.
delete from public.daily_plans;

-- 13) Associate certifications (child of associates).
delete from public.associate_certifications;

-- 14) Associates (deleted LAST — every RESTRICT reference above is now gone).
delete from public.associates;

-- ---------------------------------------------------------------------------
-- Verification (inside the transaction): every count must be 0.
-- ---------------------------------------------------------------------------
select 'associates'                 as table_name, count(*) as remaining from public.associates
union all select 'associate_certifications',    count(*) from public.associate_certifications
union all select 'daily_plans',                 count(*) from public.daily_plans
union all select 'assignments',                 count(*) from public.assignments
union all select 'planned_assignment_history',  count(*) from public.planned_assignment_history
union all select 'activity_history',            count(*) from public.activity_history
union all select 'special_assignments',         count(*) from public.special_assignments
union all select 'call_offs',                   count(*) from public.call_offs
union all select 'plan_staffing_needs',         count(*) from public.plan_staffing_needs
union all select 'plan_uph_calculations',       count(*) from public.plan_uph_calculations
union all select 'plan_dock_doors',             count(*) from public.plan_dock_doors
union all select 'notifications',               count(*) from public.notifications
union all select 'audit_logs',                  count(*) from public.audit_logs
union all select 'plan_templates',              count(*) from public.plan_templates
union all select 'template_items',              count(*) from public.template_items
order by table_name;

-- Change to ROLLBACK; for a dry run (preview the 0 counts without persisting).
commit;
