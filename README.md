# HR AI Platform

A subscription-based AI HR platform. A company subscribes once and gets
access to every HR tool in one application — organized into 14 categories,
where every tool maps back to a specific, documented HR problem.

This is **not** a generic HRMS. There is no generic "Analytics" page with
random charts, no module that exists just to exist. See
[`docs/problem-solution-matrix.md`](./docs/problem-solution-matrix.md) for
the full problem → tool catalog this app is built against.

This repository is the **application foundation**: navigation, auth,
organization setup, layout, and the configuration-driven category/tool
architecture. No individual AI tool has been built yet — every tool card
you see is `status: 'planned'` and links to a documented problem, not a
working feature.

---

## Architecture

```
Category → Subcategory → HR Problem → Tool
```

Every category in the sidebar, every card on the dashboard, and every
tool card on a category page renders from a single config file:
`client/src/config/categories.js`. Adding a new tool never means touching
routing, navigation, or layout code — you add an entry to that file (and
to the matrix doc) and it appears everywhere automatically.

```
hr-ai-platform/
├── client/                      # React + Vite + Tailwind CSS
│   └── src/
│       ├── config/categories.js # Category → Subcategory → Problem → Tool
│       ├── services/            # api.js, authService, aiService, subscriptionService, ...
│       ├── context/AuthContext.jsx
│       ├── components/
│       │   ├── layout/          # Sidebar, TopBar, AppLayout, AuthLayout
│       │   └── common/          # CategoryCard, ToolCard, ProtectedRoute, StatusBadge
│       └── pages/                # Landing, Login, Signup, OrganizationSetup,
│                                  # Dashboard, CategoryDetail, AIAssistant, Employees, Settings
├── server/                      # Node.js + Express
│   └── src/
│       ├── routes/               # organizations, employees, subscription, ai
│       ├── middleware/auth.js    # verifies Supabase JWTs
│       ├── config/supabase.js    # service-role Supabase client
│       └── services/             # aiService.js (placeholder AI seam), organizationLookup.js
├── docs/
│   ├── problem-solution-matrix.md
│   └── supabase-schema.sql       # run this in the Supabase SQL editor
├── .env.example
└── README.md
```

### Why this structure

- **Config-driven navigation.** `categories.js` is plain data — the 14
  categories are fixed per the product spec, but subcategories, problems,
  and tools are just array entries. No category list is hardcoded twice.
- **AI as a service layer, not a feature.** Both the client
  (`src/services/aiService.js`) and server (`src/services/aiService.js`)
  isolate all AI calls behind one function each (`ask` / `respond`).
  Today both are placeholders. Wiring in a real provider later — Anthropic
  or otherwise — means editing those two files, not the app.
- **Subscription as a mockable foundation.** `subscriptionService.js` on
  both sides reads/writes a `subscriptions` table with a `status` field.
  There's no payment provider yet; when one is added, only that service
  needs to change. One active subscription unlocks every category — there
  is no per-tool billing.
- **Express is the trust boundary.** The backend uses the Supabase
  service-role key and verifies every request's JWT itself
  (`middleware/auth.js`), rather than relying on the browser talking to
  Supabase directly with RLS policies. Simpler to reason about while the
  data model is still small.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + Tailwind CSS + React Router + Axios + Lucide React |
| Backend | Node.js + Express |
| Database / Auth / Storage | Supabase |
| AI integration | Service-layer seam (`aiService.js`), no provider wired in yet |

---

## Getting started

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`docs/supabase-schema.sql`](./docs/supabase-schema.sql)
   to create the `organizations`, `organization_members`, `subscriptions`,
   and `employees` tables.
3. From **Project Settings → API**, grab:
   - Project URL
   - `anon` public key
   - `service_role` secret key

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

Visit `http://localhost:5173`. You should see the landing page. Sign up,
confirm your email if your Supabase project requires it, log in, complete
organization setup, and you'll land on the dashboard's 14-category
directory.

Without valid Supabase credentials the frontend and backend both still
start and the landing/login/signup pages render — auth calls will simply
fail with a clear error until real credentials are added.

---

## What's built vs. what's next

**Built (this foundation):**
- Landing, login, signup, organization setup
- Protected app shell with sidebar (all 14 categories), top bar
- Dashboard as a directory of the 14 categories
- Category detail pages rendering subcategories → problems → tools
- Complete Payroll section under Administrative HR (6 problem/tool pairs)
- Employee foundation (list + add)
- Settings (organization, account, subscription status)
- AI Assistant placeholder wired through the service layer
- Mockable subscription status (trialing/active/inactive)

**Explicitly not built yet (by design):**
- Any working AI tool logic
- Real payroll calculation logic
- A payment provider integration
- Additional HR categories beyond the fixed 14

---

## Adding a new tool later

1. Confirm the problem against `docs/problem-solution-matrix.md` (add a
   row if it's new).
2. Add the matching entry to `client/src/config/categories.js` under the
   right category → subcategory, with `status: 'planned'`.
3. Build the tool as its own page/route, and flip its `status` to
   `'in-development'` or `'available'` when ready.

No sidebar, dashboard, or routing code needs to change for steps 1–2.
