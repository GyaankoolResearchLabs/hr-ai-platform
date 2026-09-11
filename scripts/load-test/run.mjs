import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import autocannon from "autocannon";

/*
|--------------------------------------------------------------------------
| LOAD/PERFORMANCE TEST — dev-only, not part of the app or CI
|--------------------------------------------------------------------------
|
| Mints real HR and employee sessions the same way server/test/ does
| (admin.generateLink + anon.verifyOtp), then runs autocannon against a
| small, safe set of READ endpoints against the locally running
| backend. See README.md for how/why to run this.
|--------------------------------------------------------------------------
*/

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Reuse the same server/.env this session's dev server already runs on.
dotenv.config({ path: path.resolve(__dirname, "../../server/.env") });

const BASE_URL = process.env.LOAD_TEST_BASE_URL || "http://localhost:4000";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_V__kjk7paeOG9P43WWo_iA_jO-8YFKF"; // same publishable key client/.env ships with

const HR_EMAIL = process.env.LOAD_TEST_HR_EMAIL;
const EMPLOYEE_EMAIL = process.env.LOAD_TEST_EMPLOYEE_EMAIL;

const CONNECTIONS = Number(process.env.LOAD_TEST_CONNECTIONS) || 10;
const DURATION = Number(process.env.LOAD_TEST_DURATION) || 15;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are required (reads server/.env — is it populated?)."
  );
  process.exit(1);
}

if (!HR_EMAIL || !EMPLOYEE_EMAIL) {
  console.error(
    "Set LOAD_TEST_HR_EMAIL and LOAD_TEST_EMPLOYEE_EMAIL to real accounts in your org " +
      "before running this (see README.md — this tool never invents test users)."
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function mintToken(email) {
  let lastError = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { data: linkData, error: linkError } =
        await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (linkError) throw linkError;

      const { data: verifyData, error: verifyError } =
        await anon.auth.verifyOtp({
          token_hash: linkData.properties.hashed_token,
          type: "magiclink",
        });
      if (verifyError) throw verifyError;

      return verifyData.session.access_token;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`mintToken(${email}) failed: ${lastError?.message}`);
}

async function healthCheck() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

function ms(value) {
  return `${Number(value).toFixed(1)}ms`;
}

async function runOne({ label, path: urlPath, token }) {
  const result = await autocannon({
    url: `${BASE_URL}${urlPath}`,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { Authorization: `Bearer ${token}` },
    method: "GET",
  });

  const non2xx =
    result.non2xx ??
    Object.entries(result.statusCodeStats || {})
      .filter(([code]) => Number(code) < 200 || Number(code) >= 300)
      .reduce((sum, [, stat]) => sum + stat.count, 0);

  return {
    label,
    path: urlPath,
    reqPerSec: result.requests.average,
    latencyAvg: result.latency.average,
    latencyP95: result.latency.p97_5 ?? result.latency.p95, // autocannon reports p97_5, closest to p95
    latencyP99: result.latency.p99,
    totalRequests: result.requests.total,
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx,
  };
}

async function main() {
  console.log(`Target: ${BASE_URL}`);
  console.log(`Connections: ${CONNECTIONS}, Duration: ${DURATION}s per endpoint\n`);

  const up = await healthCheck();
  if (!up) {
    console.error(
      `No server responding at ${BASE_URL}/api/health — start the backend first (npm run dev in server/).`
    );
    process.exit(1);
  }

  console.log("Minting real sessions...");
  const [hrToken, employeeToken] = await Promise.all([
    mintToken(HR_EMAIL),
    mintToken(EMPLOYEE_EMAIL),
  ]);
  console.log("Sessions ready.\n");

  const targets = [
    { label: "GET /api/employee/profile", path: "/api/employee/profile", token: employeeToken },
    { label: "GET /api/employee/payslips", path: "/api/employee/payslips", token: employeeToken },
    { label: "GET /api/employee/attendance", path: "/api/employee/attendance", token: employeeToken },
    { label: "GET /api/employees (HR list)", path: "/api/employees", token: hrToken },
    { label: "GET /api/payroll-runs (HR list)", path: "/api/payroll-runs", token: hrToken },
  ];

  const results = [];

  // Run sequentially, not in parallel — this is meant to be a small,
  // safe local check of each endpoint's own latency/throughput, not a
  // combined-load stress test.
  for (const target of targets) {
    console.log(`Running: ${target.label} ...`);
    const result = await runOne(target);
    results.push(result);
  }

  console.log("\n" + "=".repeat(100));
  console.log("RESULTS");
  console.log("=".repeat(100));

  const rows = results.map((r) => ({
    Endpoint: r.label,
    "Req/sec": r.reqPerSec.toFixed(1),
    "Avg latency": ms(r.latencyAvg),
    "p95 latency": ms(r.latencyP95),
    "p99 latency": ms(r.latencyP99),
    "Total reqs": r.totalRequests,
    Errors: r.errors,
    Timeouts: r.timeouts,
    "Non-2xx": r.non2xx,
  }));

  console.table(rows);

  const flagged = results.filter(
    (r) => r.latencyP95 > 500 || r.errors > 0 || r.timeouts > 0 || r.non2xx > 0
  );

  if (flagged.length) {
    console.log("\n⚠️  FLAGGED (p95 > 500ms, or any errors/timeouts/non-2xx):");
    flagged.forEach((r) =>
      console.log(
        `  - ${r.label}: p95=${ms(r.latencyP95)}, errors=${r.errors}, timeouts=${r.timeouts}, non2xx=${r.non2xx}`
      )
    );
  } else {
    console.log("\n✅ Nothing flagged — all endpoints under 500ms p95 with zero errors/timeouts/non-2xx.");
  }
}

main().catch((error) => {
  console.error("Load test failed:", error);
  process.exit(1);
});
