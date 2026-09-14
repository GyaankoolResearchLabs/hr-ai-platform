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

## Findings (10 connections, 15s/endpoint, against the live dev Supabase project)

### Original run — before the fix

| Endpoint | Req/sec | Avg latency | p95 latency | p99 latency | Total reqs | Errors | Timeouts | Non-2xx |
|---|---|---|---|---|---|---|---|---|
| `GET /api/employee/profile` | 12.8 | 770.0ms | 1350.0ms | 2816.0ms | 192 | 0 | 0 | 0 |
| `GET /api/employee/payslips` | 7.9 | 1207.4ms | 2478.0ms | 2539.0ms | 119 | 0 | 0 | 0 |
| `GET /api/employee/attendance` | 13.6 | 721.0ms | 974.0ms | 1979.0ms | 204 | 0 | 0 | 0 |
| `GET /api/employees` (HR list) | 7.9 | 1224.7ms | 2463.0ms | 3743.0ms | 118 | 0 | 0 | 0 |
| `GET /api/payroll-runs` (HR list) | 19.9 | 495.8ms | 722.0ms | 2887.0ms | 298 | 0 | 0 | 0 |

**Zero errors, zero timeouts, zero non-2xx responses across all five
endpoints** — the app didn't break under this load. But **every
endpoint's p95 exceeded the 500ms threshold**, some by a lot (up to
~2.5s). That was flagged.

### Likely cause: not a missing index or a classic N+1 — sequential, uncached Supabase round-trips per request

Traced the request path for the worst offenders. Every authenticated
request went through 2-3 **sequential, un-cached** Supabase queries
before the response was built, none of them parallelized:

1. `requireAuth` (`server/src/middleware/auth.js`) → JWT signature
   verification itself is fast (JWKS is loaded from
   `SUPABASE_JWKS_JSON` once and cached in memory, not fetched
   per-request) — but it was immediately followed by
   `getOrganizationMembership(userId)`, a real query against
   `organization_members`, awaited before anything else ran.
2. For employee routes, `resolveEmployee`
   (`server/src/middleware/resolveEmployee.js`) then ran a second
   query against `employees` to resolve the caller's own record.
3. The route handler itself then ran its own query (or, for
   `GET /api/employee/profile`, a third query — `resolveManager()` —
   if the employee has a manager set).

None of these were batched into a single query (e.g. a join), none
were cached (even briefly) across requests from the same user, and
each was a real network round-trip to the hosted Supabase project —
not a local DB. At low/no concurrency the added latency per request
was just the sum of those round-trips; under even modest concurrent
load (10 connections) they compounded, and p95/p99 ballooned further —
consistent with requests queuing against Supabase's connection/request
handling rather than any single query being pathologically slow. `GET
/api/employees`'s handler also does a synchronous write
(`auditEmployeeAction` — see the warning above) on every call, which
explains why it stayed the slowest even after the fix below.

### Fix applied: short-lived (7s) in-memory cache for membership/employee resolution

Added `server/src/utils/shortLivedCache.js` — a small TTL `Map` cache —
and wrapped `getOrganizationMembership()`
(`middleware/auth.js`) and `resolveEmployeeForUser()`
(`services/employeeIdentityService.js`) with it. **JWT
signature/expiry verification is never cached** — it's still checked
fresh on every request; only the "given an already-valid user, what's
their role/employee record" step is short-circuited on a cache hit.

Chosen over combining the two lookups into a single joined query:
`organization_members` and `employees` aren't foreign-keyed to each
other (both independently reference `auth.users.id`), so a real join
would have meant a new Postgres RPC function or a schema change —
more invasive for less benefit, since it would only merge 1 of the 2-3
round-trips, where the cache short-circuits up to 2 of them on a hit.

**Risk accepted, and how it's bounded:** a role change, an employee
unlink, or an invite revocation can now take up to 7 seconds to apply
to an already-live session — acceptable for this app's threat model
(an internal HR tool, not a security-critical caching decision on
token validity itself). To shrink that window further,
`routes/employeeInvitations.js`'s accept handler and
`routes/employees.js`'s `DELETE /:id` proactively evict the affected
user's cache entries right after the write, so the TTL is a safety-net
upper bound rather than the only protection in the two places this app
currently changes membership/employee-links. The cache is a single
in-memory `Map`, correct as long as the server runs as one process
(it does today) — see the file's own comments for the multi-instance
caveat.

### Re-run after the fix

| Endpoint | Req/sec | Avg latency | p95 latency | p99 latency | Total reqs | Errors | Timeouts | Non-2xx |
|---|---|---|---|---|---|---|---|---|
| `GET /api/employee/profile` | 20.3 (+59%) | 486.6ms (-37%) | 1242.0ms (-8%) | 1443.0ms | 305 | 0 | 0 | 0 |
| `GET /api/employee/payslips` | 25.4 (+222%) | 388.5ms (-68%) | 775.0ms (-69%) | 849.0ms | 381 | 0 | 0 | 0 |
| `GET /api/employee/attendance` | 33.9 (+149%) | 292.4ms (-59%) | 521.0ms (-46%) | 551.0ms | 509 | 0 | 0 | 0 |
| `GET /api/employees` (HR list) | 10.3 (+30%) | 952.5ms (-22%) | 1361.0ms (-45%) | 1500.0ms | 154 | 0 | 0 | 0 |
| `GET /api/payroll-runs` (HR list) | 35.5 (+78%) | 274.7ms (-45%) | 567.0ms (-21%) | 893.0ms | 532 | 0 | 0 | 0 |

Zero errors/timeouts/non-2xx maintained. Throughput roughly doubled to
tripled on the employee-facing endpoints, and latency dropped
significantly across the board. `GET /api/employees` improved the
least, consistent with it still paying for its own synchronous
audit-log write on every call — a separate, already-documented finding,
not something this fix touches. Two endpoints (`attendance`,
`payroll-runs`) now sit close to the 500ms p95 threshold rather than
multiple seconds over it; the others are meaningfully better but still
above it — the remaining cost is presumably each endpoint's own
data query plus general network latency to the hosted Supabase
project, which this fix didn't target.
