import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "[SUPABASE] SUPABASE_URL is missing from server/.env"
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "[SUPABASE] SUPABASE_SERVICE_ROLE_KEY is missing from server/.env"
  );
}

console.log(
  "[SUPABASE] URL:",
  supabaseUrl
);

console.log(
  "[SUPABASE] Service role key:",
  "FOUND"
);

/*
|--------------------------------------------------------------------------
| Backend Supabase client
|--------------------------------------------------------------------------
*/

export const supabaseAdmin =
  createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );

/*
|--------------------------------------------------------------------------
| Auth verification client
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| We use the same backend Supabase client for getUser(accessToken).
|
| We DO NOT use getClaims().
| We DO NOT decode the JWT ourselves.
| We DO NOT manually check exp.
|
*/

export const supabaseAuth =
  supabaseAdmin;

/*
|--------------------------------------------------------------------------
| Compatibility export
|--------------------------------------------------------------------------
*/

export const supabase =
  supabaseAdmin;