import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/*
 * =========================================================
 * SUPABASE CONFIGURATION
 * =========================================================
 */

if (!supabaseUrl) {
  throw new Error(
    "[supabaseClient] VITE_SUPABASE_URL is missing."
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "[supabaseClient] VITE_SUPABASE_ANON_KEY is missing."
  );
}

console.log(
  "[supabaseClient] Supabase URL:",
  supabaseUrl
);

console.log(
  "[supabaseClient] Supabase anon/publishable key:",
  supabaseAnonKey
    ? "FOUND"
    : "MISSING"
);

/*
 * =========================================================
 * FETCH WITH TIMEOUT
 * =========================================================
 *
 * Prevents Supabase requests from hanging forever.
 *
 * This is especially important for the Auth endpoint:
 *
 * /auth/v1/token?grant_type=password
 *
 * =========================================================
 */

const SUPABASE_REQUEST_TIMEOUT = 15000;

const fetchWithTimeout = async (
  input,
  init = {}
) => {
  const controller =
    new AbortController();

  const timeoutId = setTimeout(() => {
    console.error(
      "[supabaseClient] Request timed out:",
      input
    );

    controller.abort();
  }, SUPABASE_REQUEST_TIMEOUT);

  try {
    const response = await fetch(
      input,
      {
        ...init,
        signal:
          init.signal ||
          controller.signal,
      }
    );

    return response;
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "Supabase request timed out after 15 seconds."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

/*
 * =========================================================
 * SUPABASE CLIENT
 * =========================================================
 */

export const supabase =
  createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        /*
         * Keep the session in browser storage.
         */
        persistSession: true,

        /*
         * Automatically refresh access tokens.
         */
        autoRefreshToken: true,

        /*
         * We are using normal email/password
         * authentication, so don't force PKCE.
         */
        flowType: "implicit",

        /*
         * Prevent Supabase from trying to interpret
         * OAuth/PKCE URL parameters during normal
         * application startup.
         */
        detectSessionInUrl: false,
      },

      global: {
        fetch:
          fetchWithTimeout,

        headers: {
          "X-Client-Info":
            "hr-ai-platform",
        },
      },
    }
  );

/*
 * =========================================================
 * CLIENT READY
 * =========================================================
 */

console.log(
  "[supabaseClient] Supabase client initialized successfully."
);