import axios from "axios";
import { supabase } from "./supabaseClient";

/* =========================================================
   API BASE URL
========================================================= */

const baseURL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api";

/* =========================================================
   AXIOS INSTANCE
========================================================= */

export const api = axios.create({
  baseURL,

  headers: {
    "Content-Type": "application/json",
  },
});

/* =========================================================
   REFRESH LOCK

   Prevent multiple requests from refreshing the same
   Supabase session simultaneously.
========================================================= */

let refreshPromise = null;

/* =========================================================
   GET CURRENT SESSION

   Always read directly from the Supabase client.

   Never read the access token from:
     localStorage
     sessionStorage
     custom token variables
========================================================= */

async function getCurrentSession() {
  try {
    const {
      data,
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error(
        "[API AUTH] getSession error:",
        error
      );

      return null;
    }

    return data?.session || null;
  } catch (error) {
    console.error(
      "[API AUTH] Unexpected getSession error:",
      error
    );

    return null;
  }
}

/* =========================================================
   REFRESH SESSION

   Single shared refresh operation.
========================================================= */

async function refreshSupabaseSession() {
  if (!refreshPromise) {
    console.log(
      "[API AUTH] Starting Supabase session refresh..."
    );

    refreshPromise =
      supabase.auth
        .refreshSession()
        .then(
          ({
            data,
            error,
          }) => {
            if (error) {
              console.error(
                "[API AUTH] Supabase refresh failed:",
                error
              );

              throw error;
            }

            const session =
              data?.session || null;

            console.log(
              "[API AUTH] Supabase refresh result:",
              session
                ? "SESSION RECEIVED"
                : "NO SESSION"
            );

            return session;
          }
        )
        .finally(() => {
          refreshPromise = null;
        });
  }

  return refreshPromise;
}

/* =========================================================
   GET VALID ACCESS TOKEN

   This is the ONLY place where API requests obtain their
   bearer token.
========================================================= */

async function getValidAccessToken() {
  let session =
    await getCurrentSession();

  if (!session) {
    console.warn(
      "[API AUTH] No Supabase session available."
    );

    return null;
  }

  let accessToken =
    session.access_token;

  if (!accessToken) {
    console.warn(
      "[API AUTH] Session contains no access token."
    );

    return null;
  }

  /* -------------------------------------------------------
     Decode expiration for diagnostics
  ------------------------------------------------------- */

  try {
    const parts =
      accessToken.split(".");

    if (parts.length === 3) {
      const payload =
        parts[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/");

      const padded =
        payload +
        "=".repeat(
          (4 -
            (payload.length % 4)) %
            4
        );

      const decoded =
        JSON.parse(
          atob(padded)
        );

      const now =
        Math.floor(
          Date.now() / 1000
        );

      const expiresAt =
        Number(
          decoded.exp || 0
        );

      console.log(
        "[API AUTH] Current JWT:",
        {
          sub:
            decoded.sub ||
            null,

          exp:
            expiresAt,

          now,

          secondsRemaining:
            expiresAt - now,
        }
      );

      /* ---------------------------------------------------
         Refresh 2 minutes before expiration
      --------------------------------------------------- */

      if (
        expiresAt &&
        expiresAt - now <= 120
      ) {
        console.log(
          "[API AUTH] JWT is near expiration. Refreshing..."
        );

        session =
          await refreshSupabaseSession();

        if (!session) {
          return null;
        }

        accessToken =
          session.access_token;
      }
    }
  } catch (error) {
    console.warn(
      "[API AUTH] Could not inspect JWT expiration:",
      error
    );
  }

  if (!accessToken) {
    return null;
  }

  console.log(
    "[API AUTH] Using Supabase access token."
  );

  console.log(
    "[API AUTH] Token length:",
    accessToken.length
  );

  return accessToken;
}

/* =========================================================
   REQUEST INTERCEPTOR

   IMPORTANT:
   We deliberately overwrite Authorization.

   If some old component puts an Authorization header into
   the request, it cannot replace the current Supabase token.
========================================================= */

api.interceptors.request.use(
  async (config) => {
    const token =
      await getValidAccessToken();

    if (!token) {
      console.warn(
        "[API AUTH] No valid access token available."
      );

      return config;
    }

    if (!config.headers) {
      config.headers = {};
    }

    /*
     * Force the current token.
     */
    config.headers.Authorization =
      `Bearer ${token}`;

    console.log(
      "[API AUTH] Authorization token attached."
    );

    return config;
  },

  (error) =>
    Promise.reject(error)
);

/* =========================================================
   RESPONSE INTERCEPTOR

   If backend returns 401:
     1. Refresh Supabase session.
     2. Get the new access token.
     3. Replace Authorization.
     4. Retry once.
========================================================= */

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest =
      error?.config;

    const status =
      error?.response?.status;

    if (
      status !== 401 ||
      !originalRequest
    ) {
      return Promise.reject(error);
    }

    /*
     * Prevent infinite retry loops.
     */
    if (
      originalRequest._authRetry
    ) {
      console.error(
        "[API AUTH] Second 401 received after authentication retry."
      );

      return Promise.reject(error);
    }

    originalRequest._authRetry =
      true;

    console.warn(
      "[API AUTH] Backend returned 401. Refreshing Supabase session..."
    );

    try {
      const session =
        await refreshSupabaseSession();

      if (!session) {
        console.error(
          "[API AUTH] No session after refresh."
        );

        return Promise.reject(error);
      }

      const newToken =
        session.access_token;

      if (!newToken) {
        console.error(
          "[API AUTH] Refreshed session contains no access token."
        );

        return Promise.reject(error);
      }

      if (!originalRequest.headers) {
        originalRequest.headers =
          {};
      }

      /*
       * IMPORTANT:
       * Explicitly replace the old Authorization header.
       */
      originalRequest.headers.Authorization =
        `Bearer ${newToken}`;

      console.log(
        "[API AUTH] Retrying request with refreshed Supabase token."
      );

      return api.request(
        originalRequest
      );
    } catch (refreshError) {
      console.error(
        "[API AUTH] Authentication retry failed:",
        refreshError
      );

      return Promise.reject(error);
    }
  }
);

/* =========================================================
   SUPABASE AUTH STATE LISTENER

   Keep the browser Supabase client healthy when tokens are
   refreshed automatically.
========================================================= */

supabase.auth.onAuthStateChange(
  (event, session) => {
    console.log(
      "[API AUTH] Supabase auth event:",
      event
    );

    if (session?.access_token) {
      console.log(
        "[API AUTH] Supabase session currently has an access token."
      );
    }
  }
);

export default api;