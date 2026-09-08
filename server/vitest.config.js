import { defineConfig } from "vitest/config";

/*
|--------------------------------------------------------------------------
| VITEST CONFIG
|--------------------------------------------------------------------------
|
| Security-critical backend test suite. See test/README.md for the
| testing strategy (real Supabase, isolated fixtures) and why it was
| chosen over mocking.
|
| globalSetup runs once, in a single process, before any test file —
| that's where the shared fixture organization/employees/sessions are
| created (and torn down after the whole run). Test files themselves
| run sequentially (fileParallelism: false) so they never race each
| other while sharing that one fixture context.
|--------------------------------------------------------------------------
*/

export default defineConfig({
  test: {
    globalSetup: ["./test/setup/globalSetup.mjs"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    include: ["test/**/*.test.mjs"],
  },
});
