# Supabase — Database Setup

SQL migrations for ShiftFlow. Apply them in order via **Supabase Dashboard → SQL
Editor** (Run). They are idempotent, so re-running is safe.

## Apply order

1. `migrations/0001_org_and_profiles.sql` — organization tables, `profiles`,
   the new-user trigger, helper functions, and Row Level Security.
2. `migrations/0002_seed_reference_data.sql` — facility **DFC 5523**, its
   departments, and shift keys (Key 1/2/3).

## Create your first admin

There is no public sign-up. Create users in **Authentication → Users → Add user**
(check **Auto Confirm User** so the account can log in immediately). The
`on_auth_user_created` trigger automatically creates a matching `profiles` row
with role `viewer` in facility DFC 5523.

Then promote yourself to admin in the SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

Roles: `admin`, `supervisor`, `inbound_leader`, `outbound_leader`, `viewer`.

## Email confirmation

`signInWithPassword` requires a confirmed email. Either keep **Auto Confirm
User** checked when adding users, or disable email confirmations under
**Authentication → Providers → Email** for internal use.

## Notes

- RLS is enabled on every table. Policies scope reads/writes to the user's
  facility; admins manage within their facility (see `0001`).
- The `service_role` key bypasses RLS and is used **server-side only**. Never
  expose it to the browser.
