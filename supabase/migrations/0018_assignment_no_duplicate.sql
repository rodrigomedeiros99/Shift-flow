-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0018
-- Prevent duplicate ACTIVE assignments: one associate may hold only one active
-- (non-completed) assignment per daily plan. Completed rows are excluded so an
-- associate can be re-assigned after finishing a task, and history is never
-- blocked (request item #2).
--
-- The application also guards this in addAssignment / updateAssignment; this
-- partial unique index is the database safety net.
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1 (run first, on its own): find existing duplicate ACTIVE assignments.
-- The index in STEP 2 will FAIL if any duplicates remain, so clean them first.
-- Expect zero rows before proceeding.
-- ---------------------------------------------------------------------------
--   select daily_plan_id, associate_id, count(*) AS active_rows
--   from public.assignments
--   where status <> 'completed'
--   group by daily_plan_id, associate_id
--   having count(*) > 1;
--
-- To clean test data, keep the earliest active row per (plan, associate) and
-- delete the rest:
--   delete from public.assignments a
--   using (
--     select id,
--            row_number() over (
--              partition by daily_plan_id, associate_id
--              order by created_at, id
--            ) as rn
--     from public.assignments
--     where status <> 'completed'
--   ) dup
--   where a.id = dup.id and dup.rn > 1;

-- ---------------------------------------------------------------------------
-- STEP 2: enforce one active assignment per associate per plan.
-- ---------------------------------------------------------------------------
create unique index if not exists assignments_one_active_per_associate_uidx
  on public.assignments (daily_plan_id, associate_id)
  where status <> 'completed';
