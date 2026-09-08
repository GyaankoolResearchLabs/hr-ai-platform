import "dotenv/config";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildFixtureContext, teardownFixtureContext } from "../helpers/fixtures.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "../..");
const CONTEXT_FILE = path.join(SERVER_ROOT, "test", ".fixture-context.json");

export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:4000";

async function isServerUp() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await isServerUp()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| GLOBAL SETUP
|--------------------------------------------------------------------------
| 1. Reuse the already-running dev server if there is one (there is, in
|    this environment); otherwise spawn `node src/index.js` ourselves so
|    `npm test` is self-sufficient in a clean/CI checkout. Application
|    code is never modified or imported directly — the suite only ever
|    talks to it over real HTTP, exactly like a real client would.
| 2. Build the one shared fixture context (org + employees + resources)
|    and persist it to a temp file test files read back in their own
|    beforeAll.
| 3. Return a teardown that deletes the fixture data and stops the
|    server if this run started it.
|--------------------------------------------------------------------------
*/

export default async function globalSetup() {
  let spawnedServer = null;

  const alreadyUp = await isServerUp();

  if (!alreadyUp) {
    console.log(
      `[test setup] No server responding at ${BASE_URL} — spawning one for the test run...`
    );

    spawnedServer = spawn(process.execPath, ["src/index.js"], {
      cwd: SERVER_ROOT,
      stdio: "ignore",
      detached: false,
    });

    const up = await waitForServer();

    if (!up) {
      spawnedServer.kill();
      throw new Error(
        `Spawned server never became healthy at ${BASE_URL}/api/health.`
      );
    }

    console.log("[test setup] Spawned server is healthy.");
  } else {
    console.log(`[test setup] Reusing already-running server at ${BASE_URL}.`);
  }

  console.log("[test setup] Building fixture context (real Supabase)...");

  const context = await buildFixtureContext();

  fs.writeFileSync(CONTEXT_FILE, JSON.stringify(context, null, 2));

  console.log(
    `[test setup] Fixture context ready (run id: ${context.runId}, org: ${context.orgId}).`
  );

  return async function teardown() {
    console.log("[test teardown] Deleting fixture context...");

    await teardownFixtureContext(context).catch((error) => {
      console.error("[test teardown] Fixture cleanup failed:", error);
    });

    fs.rmSync(CONTEXT_FILE, { force: true });

    if (spawnedServer) {
      console.log("[test teardown] Stopping spawned server...");
      spawnedServer.kill();
    }

    console.log("[test teardown] Done.");
  };
}

export function loadFixtureContext() {
  return JSON.parse(fs.readFileSync(CONTEXT_FILE, "utf-8"));
}
