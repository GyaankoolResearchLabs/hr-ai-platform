import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    "[supabaseAdmin] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. " +
      "Copy server/.env.example to server/.env and fill in your Supabase project values. " +
      "Requests that touch the database will fail until this is configured."
  );
}

/**
 * Server-side Supabase client.
 *
 * Uses the service-role key for backend database operations.
 * Never expose this key to the React client.
 */
export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  serviceRoleKey || "placeholder-service-role-key",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Compatibility export.
 *
 * Some existing server services/routes import:
 *
 *   import { supabase } from "../config/supabase.js";
 *
 * Keep this alias so those existing modules continue working
 * without having to rewrite every import.
 */
export const supabase = supabaseAdmin;