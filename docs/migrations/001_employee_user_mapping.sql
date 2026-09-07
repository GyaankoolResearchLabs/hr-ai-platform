-- 001 — Employee ↔ user account mapping
-- Run this in the Supabase SQL editor for your project.
-- Links an employees row to a Supabase auth user so employees can sign in
-- to the employee portal, and adds the invitation table that drives the
-- linking flow (server/src/routes/employeeInvitations.js).
--
-- Safe to re-run: every statement is idempotent.

create extension if not exists "uuid-ossp";

-- employees.user_id ---------------------------------------------------------
-- Nullable: employee records are created by HR long before (or without) the
-- person ever having a login. Set once, when the invitation is accepted.

alter table employees
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- One auth user maps to at most one employee record. Partial index so the
-- many un-linked employees (user_id is null) do not collide.

create unique index if not exists employees_user_id_unique
  on employees (user_id)
  where user_id is not null;

create unique index if not exists employees_organization_user_unique
  on employees (organization_id, user_id)
  where user_id is not null;

-- employee_invitations ------------------------------------------------------
-- status: 'pending' | 'accepted' | 'cancelled' | 'expired'

create table if not exists employee_invitations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  email text not null,
  token text not null unique,
  status text not null default 'pending',
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_invitations_organization_idx
  on employee_invitations (organization_id);

create index if not exists employee_invitations_employee_idx
  on employee_invitations (employee_id);

-- At most one live invitation per employee.

create unique index if not exists employee_invitations_pending_unique
  on employee_invitations (employee_id)
  where status = 'pending';

-- Row Level Security -------------------------------------------------------
-- The Express backend uses the Supabase service role key, which bypasses
-- RLS by design — the API layer is the trust boundary. RLS is still
-- enabled here so this table is never queryable directly with the
-- public anon key from the browser. Invitation tokens especially must
-- never be readable by the client.

alter table employee_invitations enable row level security;

-- No policies are added: with RLS enabled and no policies, the anon/public
-- key gets zero access, and only the service-role key (used server-side)
-- can read or write.
