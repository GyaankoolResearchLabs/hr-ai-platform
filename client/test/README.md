# Frontend test suite

## Framework

**Vitest** + **React Testing Library**, jsdom environment. Vitest was
chosen to match the backend suite (`server/test/`) — same runner, same
config shape, one mental model across the repo — and because it needs
zero extra config for this Vite project (it shares Vite's own
transform pipeline). React Testing Library is the standard choice for
testing React components the way a user actually interacts with them
(render, find by role/text, click) rather than reaching into
implementation details.

Playwright was considered but isn't needed for this suite: everything
below is verifiable at the component level with a mocked service/API
layer. (Ad-hoc Playwright-driven checks against the real running app
were used during development to verify these same fixes live — see
recent commit messages — but that's a manual verification technique,
not a checked-in suite.)

## What's covered

- `RequireEmployeeRole.test.jsx` / `RequireHRRole.test.jsx` — the
  client-side half of the role-separation security model (the
  server-side half — `requireHRRole` / `resolveEmployee` — is covered
  by `server/test/`). Confirms each guard redirects the wrong role and
  renders the guarded content for the right one, including the
  not-yet-loaded (`undefined`) organization case.
- `NotificationBell.test.jsx` — unread count badge (including the "9+"
  cap), and that marking a notification read/all-read updates the UI
  optimistically and rolls back if the request fails.
- `PayrollCostAnalytics.raceGuard.test.jsx` — a regression test for the
  stale-response race that hit `AttendanceLeaveTracker.jsx`,
  `TrainingComplianceTracker.jsx`, `InvestigationTracker.jsx` and this
  page: a filter-driven load re-fires on every filter change, and
  without a guard, an earlier (slower) response resolving after a
  later (faster) one can silently overwrite the correct, newer data.
  The test mocks a slow-then-fast pair of distinguishable responses
  and asserts only the fast one ever renders — verified to actually
  fail (times out) if the `loadRequestIdRef` guard in
  `PayrollCostAnalytics.jsx` is removed, so this is a real regression
  test, not one that would pass regardless.
- `EmployeeAttendanceLeave.test.jsx` — a template for future
  employee-self-service page tests: mock the page's own service
  module (not the raw `api` client), assert the three
  clock-in/clocked-in/clocked-out UI states, and confirm a real button
  click flows through the mocked service into the updated UI
  (including the failure path).

This is not full coverage of every component — it's the areas that
matter most given this project's history (the role-security model, the
exact bug class that has recurred four times, and one concrete example
of the self-service page pattern).

## Running

```
npm test
```

from `client/`. No real backend or network calls — every test mocks
the relevant service/context module.
