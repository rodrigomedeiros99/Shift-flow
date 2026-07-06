-- ---------------------------------------------------------------------------
-- 0019_special_assignment_ib_support.sql
--
-- Cross-department support (Change Request):
--   * IB Support (ib_support)       — Outbound associates supporting Inbound.
--   * OB Support (support_outbound) — Inbound associates supporting Outbound.
--
-- STEP 1 extends the special_assignments.type CHECK constraint to allow the new
-- `ib_support` value. STEP 2 adds a partial unique index so an associate can
-- only hold ONE active special assignment per plan (the duplicate safety net,
-- mirroring assignments 0018). Run STEP 1 → (cleanup if needed) → STEP 2.
-- ---------------------------------------------------------------------------

-- STEP 1 — allow the new support type -----------------------------------------
-- The original inline CHECK is auto-named `special_assignments_type_check`.
alter table public.special_assignments
  drop constraint if exists special_assignments_type_check;

alter table public.special_assignments
  add constraint special_assignments_type_check
  check (type in ('overtime', 'middle_mile', 'icqa_support',
                  'training', 'support_outbound', 'ib_support'));

-- STEP 2 — one special assignment per associate per plan -----------------------
-- If the index below fails with 23505, there is a duplicate in test data. Find
-- it, then clean it (keeps the OLDEST row), then re-run the CREATE INDEX.
--
--   -- find duplicates:
--   select daily_plan_id, associate_id, count(*)
--     from public.special_assignments
--    group by daily_plan_id, associate_id
--   having count(*) > 1;
--
--   -- clean duplicates (keep oldest):
--   delete from public.special_assignments s
--   using (
--     select id, row_number() over (
--              partition by daily_plan_id, associate_id
--              order by created_at, id) as rn
--       from public.special_assignments) dup
--   where s.id = dup.id and dup.rn > 1;

create unique index if not exists special_assignments_one_per_associate_uidx
  on public.special_assignments (daily_plan_id, associate_id);
