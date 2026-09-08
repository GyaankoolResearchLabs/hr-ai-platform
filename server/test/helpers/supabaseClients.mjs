import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

/*
|--------------------------------------------------------------------------
| TEST SUPABASE CLIENTS
|--------------------------------------------------------------------------
|
| Same project the app itself and every manual E2E pass this session
| used (server/.env's SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — there
| is no second/staging Supabase project available. See test/README.md
| for why real Supabase was chosen over mocking, and how fixture
| isolation keeps this safe to run against.
|--------------------------------------------------------------------------
*/

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Same publishable/anon key the client app ships with (client/.env).
const ANON_KEY = "sb_publishable_V__kjk7paeOG9P43WWo_iA_jO-8YFKF";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are required to run the test suite (see server/.env)."
  );
}

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/*
|--------------------------------------------------------------------------
| MINT A REAL SESSION
|--------------------------------------------------------------------------
| Same magic-link mint pattern used for every manual E2E pass this
| session: admin.generateLink() + anon.verifyOtp() produces a real,
| fully-signed Supabase JWT for the given user — not a synthetic token.
| Retries a few times since Supabase occasionally returns an
| "otp_expired" error on the very next call after generateLink.
|--------------------------------------------------------------------------
*/

export async function mintSession(email) {
  let lastError = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
        });

      if (linkError) {
        throw linkError;
      }

      const { data: verifyData, error: verifyError } =
        await supabaseAnon.auth.verifyOtp({
          token_hash: linkData.properties.hashed_token,
          type: "magiclink",
        });

      if (verifyError) {
        throw verifyError;
      }

      return verifyData.session;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `mintSession(${email}) failed after retries: ${lastError?.message}`
  );
}
