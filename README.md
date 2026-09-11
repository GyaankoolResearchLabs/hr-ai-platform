# HR AI Platform

A subscription-based HR platform. A company subscribes once and gets
access to every HR tool in one application — organized into 15
categories, where every tool maps back to a specific, documented HR
problem — plus a full self-service dashboard for employees.

This is **not** a generic HRMS. There is no generic "Analytics" page with
random charts, no module that exists just to exist. See
[`docs/problem-solution-matrix.md`](./docs/problem-solution-matrix.md) for
the full problem → tool catalog this app is built against.

---

## What's built

### HR-side tool catalog

`client/src/config/categories.js` is the single source of truth for
navigation and the problem→solution catalog: **15 categories, 57 tools,
all `status: "available"`.**

Administrative HR (incl. Payroll), Recruitment, Employee Support,
Onboarding, Performance, Learning & Development, Workforce Planning,
Employee Engagement, HR Analytics, Compensation, Employee Relations,
HR Compliance, HR Technology, Strategic HR.

Every category/subcategory/problem/tool in the sidebar and on category
pages renders from that one config file — adding a tool never means
touching routing or layout code.

### Employee self-service dashboard

A separate, role-gated area (`/app/employee/*`) where an employee logs
in with their own account and only ever sees their own data:

| Page | What it does |
|---|---|
| My Profile | View own employee record |
| Attendance & Leave | Self clock-in/clock-out, view attendance history, submit leave requests |
| Payslips | View/download own published payslips |
| Reimbursements | Submit and track own expense claims |
| Learning | View assigned courses, track progress, mark complete |
| Documents | View own uploaded/verified HR documents |
| Notifications | Own notification feed (leave approvals, payslip publication, etc.) |
| Performance | View own goals and performance reviews |
| Full & Final Settlement | View own F&F settlement, once generated |

Each employee route is backed by its own Express route
(`server/src/routes/employee*.js`) that resolves the caller's employee
record from their verified JWT and scopes every query to it — an
employee can never read or act on another employee's data (enforced
end-to-end, see [Security model](#security-model) and the test suite).

### Invitation / identity-mapping flow

An `employees` row (created by HR) and a Supabase Auth user account
start out unlinked. `POST /api/employee-invitations` (HR-only) creates
an invitation; the invitee accepts it (matching email required) via
`POST /api/employee-invitations/.../accept`, which links
`employees.user_id` to their auth user and creates their
`organization_members` row with role `employee`. An invitation can't be
accepted by a mismatched email or accepted twice. Until accepted, the
employee identity middleware falls back to matching on verified email
so a not-yet-linked employee still isn't locked out mid-flow.

### Security model

- **Role separation.** `organization_members.role` is `owner` / an
  HR role, or `employee`. `RequireHRRole` (client) redirects an
  employee-role account away from the entire HR sidebar/tool catalog to
  their own dashboard; `RequireEmployeeRole` is the mirror guard for
  `/app/employee/*`. Enforcement is server-side too — HR-only write
  endpoints check role, not just the client route guard.
- **Ownership isolation.** Every `employee/*` route resolves the caller
  to their own `employees` row from their JWT
  (`middleware/resolveEmployee.js`) and scopes queries to it; a
  client-supplied id is never trusted. Reaching for another employee's
  resource returns 404, not 403 — existence isn't leaked either.
- **Express is the trust boundary.** The backend uses the Supabase
  service-role key and verifies every request's JWT itself
  (`middleware/auth.js`), rather than relying on the browser talking to
  Supabase directly with RLS policies.

---

## Architecture

```
Category → Subcategory → HR Problem → Tool
```

```
hr-ai-platform/
├── client/                          # React + Vite + Tailwind CSS
│   └── src/
│       ├── config/categories.js     # Category → Subcategory → Problem → Tool
│       ├── services/                # api.js, authService, employee*Service.js, ...
│       ├── context/AuthContext.jsx
│       ├── components/
│       │   ├── layout/              # Sidebar, TopBar, AppLayout, AuthLayout
│       │   └── common/              # RequireHRRole, RequireEmployeeRole, ProtectedRoute, ...
│       └── pages/                   # HR tool pages + Employee* self-service pages
│   └── test/                        # Vitest + RTL frontend test suite
├── server/                          # Node.js + Express
│   └── src/
│       ├── routes/                  # 60+ route files: HR tool catalog + employee*.js
│       ├── middleware/
│       │   ├── auth.js              # verifies Supabase JWTs
│       │   └── resolveEmployee.js   # JWT -> caller's own employee record
│       ├── config/supabase.js       # service-role Supabase client
│       └── services/
│   └── test/                        # Vitest + supertest backend security suite
├── .github/workflows/test.yml       # CI: backend tests + client build, on push/PR to main
├── docs/
│   ├── problem-solution-matrix.md
│   └── supabase-schema.sql          # run this in the Supabase SQL editor
├── .env.example
└── README.md
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + Tailwind CSS + React Router + Axios + Lucide React |
| Backend | Node.js + Express |
| Database / Auth / Storage | Supabase |
| Backend tests | Vitest + supertest, against a real isolated-fixture Supabase project (see below) |
| Frontend tests | Vitest + React Testing Library, jsdom (see below) |
| CI | GitHub Actions — backend + frontend test suites, and a client build, on every push/PR to `main` |

---

## Getting started

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`docs/supabase-schema.sql`](./docs/supabase-schema.sql).
3. From **Project Settings → API**, grab the Project URL, `anon` public
   key, and `service_role` secret key.

### 2. Configure environment variables

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Fill in `client/.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:4000/api
```

Fill in `server/.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

### 3. Install and run

```bash
# Backend
cd server
npm install
npm run dev        # http://localhost:4000

# Frontend (in a second terminal)
cd client
npm install
npm run dev         # http://localhost:5173
```

Visit `http://localhost:5173`. Sign up, confirm your email if your
Supabase project requires it, log in, complete organization setup, and
you'll land on the dashboard's category directory. HR-role accounts see
the full tool catalog; an employee-role account (after accepting an
invitation) lands on the Employee Dashboard instead.

---

## Backend test suite

```bash
cd server
npm test
```

Vitest + supertest, prioritizing the security-critical logic: JWT
resolution (`resolveEmployee`), ownership isolation across every
`employee/*` route, role-gating on HR-only write endpoints, and the
invite/accept flow. Runs against a real Supabase project with fully
isolated, tagged fixture data (created and torn down per run) rather
than a mocked client — see [`server/test/README.md`](./server/test/README.md)
for the full rationale and what's covered.

## Frontend test suite

```bash
cd client
npm test
```

Vitest + React Testing Library, jsdom — component-level, no real
backend or network calls. Prioritizes the client-side half of the
role-security model (`RequireEmployeeRole` / `RequireHRRole`), a
regression test for the stale-response race that has hit four
different pages, `NotificationBell`, and one employee self-service
page as a template for future page tests — see
[`client/test/README.md`](./client/test/README.md) for the full
rationale and what's covered.

## CI

[`.github/workflows/test.yml`](./.github/workflows/test.yml) runs on
every push and pull request to `main`: the backend test suite, the
frontend test suite, and a `vite build` of the client as a compile
sanity check. The backend job needs `SUPABASE_URL`
and `SUPABASE_SERVICE_ROLE_KEY` configured as **repository secrets**
(Settings → Secrets and variables → Actions) pointing at the same
Supabase project `server/.env` uses — no credentials are stored in the
workflow file itself.

---

## Adding a new tool later

1. Confirm the problem against `docs/problem-solution-matrix.md` (add a
   row if it's new).
2. Add the matching entry to `client/src/config/categories.js` under the
   right category → subcategory, with `status: 'planned'`.
3. Build the tool as its own page/route, and flip its `status` to
   `'in-development'` or `'available'` when ready.

No sidebar, dashboard, or routing code needs to change for steps 1–2.
