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

## Deployment

The client and server deploy as two separate services against the same
Supabase project: **client/ → Netlify**, **server/ → Render**. Nothing in
either is hardcoded to `localhost` — both read their API/CORS origin from
environment variables, with a `localhost` value used only as a local-dev
fallback when that variable isn't set (see `client/src/lib/api.js` and
`server/src/index.js`).

### Server → Render

[`render.yaml`](./render.yaml) at the repo root is a Render Blueprint for
this — "New +" → "Blueprint" in the Render dashboard, point it at this
repo, and it pre-fills the settings below (every secret is left blank on
purpose; Render prompts you to fill each one in). To configure a plain Web
Service by hand instead, use:

| Setting | Value |
|---|---|
| Root directory | `server` |
| Build command | `npm install` |
| Start command | `npm start` (runs `node src/index.js`, see `server/package.json`) |
| Health check path | `/api/health` |

Render sets `PORT` itself — `server/src/index.js` already reads
`process.env.PORT` (falling back to `4000` only when unset, for local
dev) and binds to `0.0.0.0`, so nothing needs to change for that. It also
sits behind Render's reverse proxy, which `app.set("trust proxy", 1)` in
`index.js` accounts for.

**Environment variables to enter in Render's dashboard** (see
`server/.env.example` for what each one does and which are required vs.
feature-gated/optional):

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` — used by `POST /api/auth/login`; without it every
  login attempt fails, not just wrong-password ones.
- `CLIENT_ORIGIN` — your Netlify site's exact URL (e.g.
  `https://your-app.netlify.app`), no trailing slash. Gates CORS and is
  used to build links in outgoing emails.

Optional (only the specific feature using one fails without it):
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (AI Course Generator only)
- `RESEND_API_KEY`, `EMAIL_FROM`
- `INTEGRATION_ENCRYPTION_KEY`
- `SUPABASE_JWT_SECRET`, `SUPABASE_JWKS_JSON`

Leave unset (or `false`) in production:
- `ESCALATION_TEST_MODE` — gates a destructive test-only cleanup
  endpoint.

### Client → Netlify

[`netlify.toml`](./netlify.toml) at the repo root configures this
automatically when you connect the repo as a Netlify site — base
directory `client`, build command `npm run build`, publish directory
`dist` (Vite's default output — confirmed unchanged in
`client/vite.config.js`, so Netlify's own default publish setting of
`dist` would also work even without the toml file). To configure by hand
instead, use the same three values in Netlify's UI.

`netlify.toml` also adds the SPA fallback redirect
(`/* → /index.html`) this app needs: it's a client-side-routed app
(`react-router-dom`'s `BrowserRouter`), so without that rule, a hard
refresh or direct link to anything but `/` (e.g. `/app/dashboard`,
`/platform-admin/logs`) 404s on Netlify's static host.

**Environment variables to enter in Netlify's dashboard** (Site settings
→ Build & deploy → Environment) — these are read at **build** time by
Vite, so setting/changing one requires a rebuild, not just a redeploy:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` — your Render service's URL **with the `/api` suffix**,
  e.g. `https://hr-ai-platform-api.onrender.com/api`.

### Deploy order

Deploy the server first, note its Render URL, then set `VITE_API_URL` to
it before/while deploying the client. Once the client has a real URL,
set `CLIENT_ORIGIN` on the server to that and redeploy the server (or
just set both up front if you already know the Netlify subdomain you'll
use — Netlify lets you pick one before the first deploy).

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

## Load test (dev-only)

```bash
cd scripts/load-test
npm install
LOAD_TEST_HR_EMAIL=<hr-account-email> LOAD_TEST_EMPLOYEE_EMAIL=<employee-account-email> npm start
```

A small local autocannon check against a handful of read endpoints,
against whatever Supabase project `server/.env` points at — **not run
in CI**, since it generates real traffic (and, for one endpoint, real
audit-log rows). See
[`scripts/load-test/README.md`](./scripts/load-test/README.md) for
what it hits, current findings, and full usage.

## Platform monitoring (internal / operator-only — not customer-facing)

> This section documents an internal operator tool. It is not part of the
> product any customer account can see or reach, and is not referenced
> from anywhere in the customer-facing app or its navigation.

Every unhandled server exception, every login failure, every invalid/expired
auth token, and any client-side crash the React error boundary catches is
captured — server-side only — into `platform_error_logs`
(`docs/migrations/003_platform_admin.sql`), completely separate from every
business table. The end user only ever sees a fixed, generic error message;
full detail (message, stack trace, route, caller) goes to this table.

Viewable at `/platform-admin/logs` — a URL only operators should know, not
linked from any nav/sidebar. Access is enforced entirely server-side by
`middleware/requirePlatformAdmin.js`, which checks the caller's
Supabase-verified email against the `platform_admins` table — an allow-list
completely independent of `organization_role`. Anyone not on that list
(including every customer HR/owner account) gets a 404 from every
`/api/platform-admin/*` route, indistinguishable from a route that doesn't
exist, rather than a 403 that would reveal the system is there at all.

To add or remove a platform admin, insert/delete a row in `platform_admins`
directly in the Supabase SQL editor — there is intentionally no UI for it.

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
