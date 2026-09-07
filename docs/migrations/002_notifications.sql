-- 002 — Employee notifications
-- Run this in the Supabase SQL editor for your project.
-- A minimal, centralized notification table so employee-facing actions
-- (leave request approved/rejected, and future triggers) can surface an
-- in-app notification. Matches the existing schema conventions.
--
-- Safe to re-run: every statement is idempotent.

create extension if not exists "uuid-ossp";

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_employee_idx
  on notifications (employee_id, created_at desc);

create index if not exists notifications_employee_unread_idx
  on notifications (employee_id)
  where read_at is null;

-- Row Level Security -------------------------------------------------------
-- The Express backend uses the Supabase service role key, which bypasses
-- RLS by design — the API layer is the trust boundary. RLS is still
-- enabled here so this table is never queryable directly with the
-- public anon key from the browser.

alter table notifications enable row level security;

-- No policies are added: with RLS enabled and no policies, the anon/public
-- key gets zero access, and only the service-role key (used server-side)
-- can read or write.
