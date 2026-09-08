import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTEXT_FILE = path.join(__dirname, "..", ".fixture-context.json");

export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:4000";

/*
|--------------------------------------------------------------------------
| LOAD FIXTURE CONTEXT
|--------------------------------------------------------------------------
| Reads the fixture context globalSetup.mjs wrote to disk. Test files
| call this in their own beforeAll rather than importing globalSetup.mjs
| directly (Vitest runs globalSetup in a separate context from test
| files — this file-based handoff is the supported pattern).
|--------------------------------------------------------------------------
*/

export function loadFixtureContext() {
  return JSON.parse(fs.readFileSync(CONTEXT_FILE, "utf-8"));
}
