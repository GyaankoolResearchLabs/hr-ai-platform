# Load test (dev-only)

A small, local load/performance check against the running backend. **Not
part of the app, not run in CI** — it generates real HTTP traffic (and,
for `GET /api/employees`, real audit-log rows — see below) against
whatever Supabase project `server/.env` points at, so it's meant to be
run deliberately by a developer, never automatically.

## Tool: autocannon

Chosen over k6 because it's Node-native — `npm install` inside this
directory and it's ready, no separate binary/runtime to install. k6
would be the better choice for larger, scripted, multi-stage load
scenarios; for a handful of GET endpoints at modest concurrency,
autocannon's simplicity wins.

## What it hits

Five **read** endpoints only — no writes are included, to avoid
generating real data:

| Endpoint | Auth |
|---|---|
| `GET /api/employee/profile` | employee token |
| `GET /api/employee/payslips` | employee token |
| `GET /api/employee/attendance` | employee token |
| `GET /api/employees` | HR token |
| `GET /api/payroll-runs` | HR token |

Each is run **sequentially** (not concurrently with the others) at a
modest concurrency/duration — this checks each endpoint's own
latency/throughput, it is not a combined-load stress test.

**Heads up on `GET /api/employees`**: despite being a read endpoint at
the API level, its handler (`server/src/routes/employees.js`) writes
an audit-log row (`auditEmployeeAction`) on every single call. Running
this tool against it *will* create that many rows in `audit_logs`.
Keep `LOAD_TEST_CONNECTIONS`/`LOAD_TEST_DURATION` modest (the defaults
below already are) if you want to limit that.

Sessions are minted the same way `server/test/` does — real Supabase
magic-link + OTP verification against real accounts you specify, never
synthetic tokens.

## Running it

```bash
cd scripts/load-test
npm install

# Backend must already be running (npm run dev in server/)

LOAD_TEST_HR_EMAIL=<a real HR/owner account email in your org> \
LOAD_TEST_EMPLOYEE_EMAIL=<a real employee-role account email> \
npm start
```

Optional env overrides:

- `LOAD_TEST_BASE_URL` — defaults to `http://localhost:4000`
- `LOAD_TEST_CONNECTIONS` — concurrent connections per endpoint, defaults to `10`
- `LOAD_TEST_DURATION` — seconds per endpoint, defaults to `15`

It reads `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from
`server/.env` automatically (same file the app and `server/test/`
already use) — nothing to configure there.

## Output

A results table (requests/sec, avg/p95/p99 latency, total requests,
errors, timeouts, non-2xx count) per endpoint, plus a flagged list for
anything with p95 latency over 500ms or any errors/timeouts/non-2xx
responses.

## Findings (last run: 10 connections, 15s/endpoint, against the live dev Supabase project)

| Endpoint | Req/sec | Avg latency | p95 latency | p99 latency | Total reqs | Errors | Timeouts | Non-2xx |
|---|---|---|---|---|---|---|---|---|
| `GET /api/employee/profile` | 12.8 | 770.0ms | 1350.0ms | 2816.0ms | 192 | 0 | 0 | 0 |
| `GET /api/employee/payslips` | 7.9 | 1207.4ms | 2478.0ms | 2539.0ms | 119 | 0 | 0 | 0 |
| `GET /api/employee/attendance` | 13.6 | 721.0ms | 974.0ms | 1979.0ms | 204 | 0 | 0 | 0 |
| `GET /api/employees` (HR list) | 7.9 | 1224.7ms | 2463.0ms | 3743.0ms | 118 | 0 | 0 | 0 |
| `GET /api/payroll-runs` (HR list) | 19.9 | 495.8ms | 722.0ms | 2887.0ms | 298 | 0 | 0 | 0 |

**Zero errors, zero timeouts, zero non-2xx responses across all five
endpoints** — the app doesn't break under this load. But **every
endpoint's p95 exceeds the 500ms threshold**, some by a lot (up to
~2.5s). That's flagged.

### Likely cause: not a missing index or a classic N+1 — sequential, uncached Supabase round-trips per request

Traced the request path for the worst offenders. Every authenticated
request goes through 2-3 **sequential, un-cached** Supabase queries
before the response is built, none of them parallelized:

1. `requireAuth` (`server/src/middleware/auth.js`) → JWT signature
   verification itself is fast (JWKS is loaded from
   `SUPABASE_JWKS_JSON` once and cached in memory, not fetched
   per-request) — but it's immediately followed by
   `getOrganizationMembership(userId)`, a real query against
   `organization_members`, awaited before anything else runs.
2. For employee routes, `resolveEmployee`
   (`server/src/middleware/resolveEmployee.js`) then runs a second
   query against `employees` to resolve the caller's own record.
3. The route handler itself then runs its own query (or, for
   `GET /api/employee/profile`, a third query — `resolveManager()` —
   if the employee has a manager set).

None of these are batched into a single query (e.g. a join), none are
cached (even briefly) across requests from the same user, and each is
a real network round-trip to the hosted Supabase project — not a local
DB. At low/no concurrency the added latency per request is just the
sum of those round-trips; under even modest concurrent load (10
connections) they compound, and p95/p99 balloon further — consistent
with requests queuing against Supabase's connection/request handling
rather than any single query being pathologically slow. `GET
/api/employees`'s handler also does a fourth synchronous write
(`auditEmployeeAction` — see the warning above) on every call, which
likely explains why it's among the slowest despite being one of the
simpler queries.

This isn't a "add an index" fix — it's an architectural pattern (every
authenticated request re-resolves org membership and employee identity
from scratch, sequentially, with no caching) that doesn't scale well
under concurrency. Not fixed here — it would mean changing
`middleware/auth.js` and `middleware/resolveEmployee.js` (e.g. a
short-lived in-memory or request-scoped cache for the
membership/employee lookups, or combining them into fewer round
trips), which is out of scope for a load-test pass. Flagging for a
deliberate follow-up rather than a quick patch.
