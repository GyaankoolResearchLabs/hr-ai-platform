-- 003 — Platform admin monitoring system
-- Run this in the Supabase SQL editor for your project.
--
-- Adds two tables that back the operator-only monitoring system at
-- /platform-admin/logs (server/src/routes/platformAdmin.js). Both are
-- completely separate from every business/HR table and from the
-- organization_role model:
--
--   platform_admins     — the allow-list gating access to the system.
--                          Checked by middleware/requirePlatformAdmin.js,
--                          which is independent of organization_role.
--   platform_error_logs — captured server-side errors, login failures,
--                          and reported client-side errors.
--
-- Safe to re-run: every statement is idempotent, except the seed insert,
-- which is guarded with "on conflict do nothing".

create extension if not exists "uuid-ossp";

-- platform_admins ------------------------------------------------------------
-- Deliberately tiny and flat: no roles, no permissions column. Being a row
-- in this table is the entire authorization check.

create table if not exists platform_admins (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  added_at timestamptz not null default now(),
  added_by text
);

-- Seed the initial platform admin.

insert into platform_admins (email, added_by)
values ('shettysusheen@gmail.com', 'migration:003_platform_admin')
on conflict (email) do nothing;

-- platform_error_logs ---------------------------------------------------------
-- event_type: 'login_failure' | 'unhandled_exception' | 'invalid_token' |
--             'validation_error' | 'client_error' | ... (free text, not an
--             enum, so a new capture point never needs a migration first).

create table if not exists platform_error_logs (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  event_type text not null,
  route text,
  method text,
  user_id uuid,
  user_email text,
  message text,
  stack text,
  context jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text
);

create index if not exists platform_error_logs_created_at_idx
  on platform_error_logs (created_at desc);

create index if not exists platform_error_logs_event_type_idx
  on platform_error_logs (event_type);

create index if not exists platform_error_logs_user_email_idx
  on platform_error_logs (user_email);

-- Row Level Security -------------------------------------------------------
-- Same convention as every other table in this repo: the Express backend
-- uses the service-role key, which bypasses RLS by design. RLS is enabled
-- here with no policies so neither table is ever readable with the public
-- anon key from the browser — this data (error detail, stack traces, the
-- admin allow-list itself) must never be reachable directly from Supabase,
-- only through the platform-admin-gated API.

alter table platform_admins enable row level security;
alter table platform_error_logs enable row level security;

-- No policies are added: with RLS enabled and no policies, the anon/public
-- key gets zero access, and only the service-role key (used server-side)
-- can read or write.
