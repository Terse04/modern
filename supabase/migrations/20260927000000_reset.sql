-- =============================================================================
-- 20260927000000_reset.sql
-- DESTRUCTIVE BASELINE RESET
-- =============================================================================
-- WHY THIS EXISTS
--   Three files have been applied to this project in an unknown order:
--     - supabase/schema.sql                     (profiles.id text, permissive RLS)
--     - supabase/migrations/001_initial_schema.sql (profiles.id uuid, strict RLS)
--     - supabase/admin_migration.sql            (platform_settings jsonb variant)
--
--   They disagree on primary key types, column names, and policy NAMES. Because
--   the policy names differ, `drop policy if exists` in one file never removed
--   the other's policies. Postgres ORs together permissive RLS policies, so the
--   "Anyone can insert/update profile ... using (true)" policy from schema.sql
--   is still active alongside the strict policies from the migration.
--
--   Net effect on the live project: anonymous clients with the publishable key
--   can UPDATE any profile row, including setting is_admin = true on themselves.
--
-- WHAT THIS SCRIPT DOES
--   Drops and recreates the public schema. This is the only reliable way to
--   guarantee no residue from the three conflicting files (policies, grants,
--   publication membership, triggers, functions, and the odd constraint all go).
--
-- WHAT YOU LOSE
--   Everything in the public schema. As of this writing the project contains:
--     profiles ......... 1 row  (one real signup)
--     rooms ............ 0 rows
--     tracks ........... 0 rows
--     queue_items ...... 0 rows
--     chat_messages .... 0 rows
--     room_members ..... 6 rows (all orphans: text user_ids pointing at
--                                'late-night-coding', a room that does not exist)
--   The single profile is re-seedable by signing up again. The 6 orphan rows
--   are junk. A backup INSERT of the surviving profile is included below,
--   commented out.
--
-- auth.users is NOT touched. Supabase Auth accounts and sessions survive.
-- =============================================================================

-- ─── Safety: refuse to run if unexpected data is present ───────────────────
-- This guard aborts the reset if the tables hold more than the known-safe
-- amounts. If it fires, COPY THE DATA OUT before proceeding.
do $$
declare
  n_profiles bigint;
  n_rooms   bigint;
  n_tracks  bigint;
begin
  if to_regclass('public.profiles') is not null then
    select count(*) into n_profiles from public.profiles;
    if n_profiles > 25 then
      raise exception
        'ABORT: public.profiles has % rows (> 25). Export your data before resetting.',
        n_profiles;
    end if;
  end if;

  if to_regclass('public.rooms') is not null then
    select count(*) into n_rooms from public.rooms;
    if n_rooms > 25 then
      raise exception
        'ABORT: public.rooms has % rows (> 25). Export your data before resetting.',
        n_rooms;
    end if;
  end if;

  if to_regclass('public.tracks') is not null then
    select count(*) into n_tracks from public.tracks;
    if n_tracks > 50 then
      raise exception
        'ABORT: public.tracks has % rows (> 50). Export your data before resetting.',
        n_tracks;
    end if;
  end if;
end $$;

-- ─── Preserve the one real profile, if you want to re-seed it ──────────────
-- Uncomment and adjust BEFORE running the reset, or capture the INSERT
-- statement from this file's output. The trigger in 20260927000300 recreates
-- the profile on next sign-in, so this is optional.
--
-- select 'INSERT INTO public.profiles (id, auth_user_id, username, name, avatar) VALUES'
--   || ' (' || quote_literal(id) || ', ' || quote_literal(auth_user_id::text) || ', '
--   || quote_literal(username) || ', ' || quote_literal(name) || ', '
--   || quote_literal(avatar) || ');'
-- from public.profiles;

-- ─── Nuke it ───────────────────────────────────────────────────────────────
drop schema public cascade;
create schema public;

-- Restore Supabase's default grants. `drop schema` removed these.
grant usage on schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;

-- Supabase's own helper schema (used by the auth admin UI). Recreated by
-- `drop schema public cascade`? No - it is separate, but be explicit.
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- =============================================================================
-- Done. Continue with:
--   20260927000100_core_schema.sql
--   20260927000200_rls_policies.sql
--   20260927000300_functions_triggers.sql
-- =============================================================================
