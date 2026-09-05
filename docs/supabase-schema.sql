-- HR AI Platform — foundation schema
-- Run this in the Supabase SQL editor for your project.
-- Auth (users) is handled entirely by Supabase Auth; these tables cover
-- organizations, membership, the mock subscription, and the employee
-- foundation. Every future tool's tables should reference organization_id
-- the same way employees does.

create extension if not exists "uuid-ossp";

create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  industry text,
  size text,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member', -- 'owner' | 'admin' | 'member'
  created_at timestamptz not null default now(),
  unique (user_id) -- each user belongs to exactly one organization for now
);

create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  status text not null default 'inactive', -- 'active' | 'trialing' | 'inactive'
  plan text default 'all-access',
  renews_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id) -- one subscription per organization
);

create table if not exists employees (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  department text,
  title text,
  created_at timestamptz not null default now()
);

create unique index if not exists employees_organization_user_unique
  on employees (organization_id, user_id)
  where user_id is not null;

-- Row Level Security -------------------------------------------------------
-- The Express backend uses the Supabase service role key, which bypasses
-- RLS by design — the API layer is the trust boundary. RLS is still
-- enabled here so these tables are never queryable directly with the
-- public anon key from the browser.

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table subscriptions enable row level security;
alter table employees enable row level security;

-- No policies are added: with RLS enabled and no policies, the anon/public
-- key gets zero access, and only the service-role key (used server-side)
-- can read or write. Add scoped policies here later if you ever want the
-- client to talk to Supabase directly for a specific table.
