# Backend test suite

## Framework

**Vitest** + **supertest**. Vitest was chosen over Jest because the codebase
is native ESM (`"type": "module"` in `package.json`, no build step) — Vitest
runs ESM natively with zero config, where Jest needs extra transform config
to do the same. supertest is the standard choice for HTTP-level assertions
against an Express-shaped API.

## Test-data strategy: real Supabase, isolated fixtures — not mocked

There is no second/staging Supabase project for this app — `server/.env`'s
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` point at the same project used
for every manual E2E pass throughout this project's development (Meera
Joshi, Divya Iyer, the real HR owner account all live there).

Two options were available:

1. **Mock `@supabase/supabase-js`** entirely and assert on what the app code
   *tries* to query.
2. **Use the real Supabase project**, with test data fully isolated from
   real data.

This suite uses **option 2**, because the properties being tested — JWT
verification, the `employees.user_id` / `employees.email` resolution
fallback, ownership scoping via `.eq("employee_id", ...)`, the
`.is("user_id", null)` race guard on invite acceptance, the
`unique(user_id)` constraint on `organization_members` — are exactly the
kind of behavior that depends on how Postgres and Supabase Auth actually
behave, not on how I assume they behave. Mocking the client would only ever
prove the app code calls the methods I expected it to call, which is a much
weaker guarantee for a suite whose entire purpose is verifying security
properties.

**How isolation is kept safe:** every test run creates one throwaway
organization (`Test Org <runId>`), tagged with a random 8-character run id,
with its own HR owner and two employees (`empA`, `empB`), all with
`@example.test` emails that can never collide with real accounts. Every
row created lives under that one organization; a global teardown deletes
every row it created (children before parents) and every auth user it
created, in `globalSetup`'s returned teardown function — nothing outside
that fixture context is ever touched or deleted.

**Trade-off, stated plainly:** this makes the suite an integration suite,
not a hermetic/offline unit suite. It requires real network access to
Supabase and takes several seconds per run (auth admin API calls aren't
instant). `test/middleware/resolveEmployee.test.mjs` is the one exception —
those are true mocked unit tests of the middleware's own control flow,
fast and deterministic, complementing (not replacing) the real integration
coverage in `test/security/requireEmployee.integration.test.mjs`.

## Server under test

The suite never imports `src/index.js` directly (it calls `app.listen()`
unconditionally at module load with no guard — importing it would either
double-bind port 4000 or require modifying application code to add one,
which this task explicitly ruled out). Instead, `globalSetup.mjs`:

- Reuses an already-running dev server if `GET /api/health` responds.
- Otherwise spawns `node src/index.js` as a child process for the run and
  kills it afterward.

Either way, the suite only ever talks to the app over real HTTP, exactly
like the real frontend does.

## What's covered

- `middleware/resolveEmployee.test.mjs` — mocked unit tests of the
  middleware's control flow (401/400/403/200 cases, error status
  passthrough, and that it never reads a client-supplied employee id).
- `security/requireEmployee.integration.test.mjs` — the same middleware,
  for real: no token, garbage token, a real session with no linked
  employee record, and a real successful resolution.
- `security/ownership-isolation.test.mjs` — every `employee/*` (and
  employee-facing `/me`) route that takes a resource id in the URL,
  table-driven: employee A's real token against employee B's real
  resource id must 404, never 403 or 200. Includes control checks that
  the owning employee *can* reach their own resource, and that list
  endpoints never leak another employee's rows.
- `security/role-gating.test.mjs` — the 4 previously-unprotected HR-only
  writes in `attendanceLeave.js` (`POST /attendance`, `POST /balances`,
  `POST /requests`, `PUT /requests/:id`): 403 for an employee-role caller,
  success for HR/owner.
- `security/invitations.test.mjs` — invite creation, rejecting a
  mismatched-email accept, a successful accept (verifying
  `employees.user_id` and the `organization_members` row directly against
  the database, not just the HTTP response), and rejecting a double-accept.

## Running

```
npm test
```

from `server/`. Requires `server/.env` to be populated (same file the app
itself already uses).
