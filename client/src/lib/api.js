import axios from "axios";
import { supabase } from "./supabaseClient";

const baseURL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api";

export const api = axios.create({
  baseURL,
});

/* =========================================================
   SESSION REFRESH LOCK

   Prevent multiple API requests from trying to refresh
   the Supabase session at the same time.
========================================================= */

let refreshPromise = null;

async function getValidAccessToken() {
  try {
    /* -------------------------------------------------------
       Get current session
    ------------------------------------------------------- */

    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error(
        "[API AUTH] getSession failed:",
        sessionError,
      );

      return null;
    }

    let session = sessionData?.session;

    console.log(
      "[API AUTH] Current session:",
      session ? "FOUND" : "MISSING",
    );

    if (!session) {
      return null;
    }

    /* -------------------------------------------------------
       Check token expiry

       expires_at is Unix timestamp in seconds.
       Refresh slightly before expiry to avoid race conditions.
    ------------------------------------------------------- */

    const now = Math.floor(
      Date.now() / 1000,
    );

    const expiresAt =
      Number(session.expires_at || 0);

    const secondsRemaining =
      expiresAt - now;

    console.log(
      "[API AUTH] Token seconds remaining:",
      secondsRemaining,
    );

    /* -------------------------------------------------------
       Refresh if expired or about to expire
    ------------------------------------------------------- */

    if (
      !expiresAt ||
      secondsRemaining <= 60
    ) {
      console.log(
        "[API AUTH] Token expired/near expiry. Refreshing session...",
      );

      if (!refreshPromise) {
        refreshPromise =
          supabase.auth
            .refreshSession()
            .finally(() => {
              refreshPromise = null;
            });
      }

      const {
        data: refreshedData,
        error: refreshError,
      } = await refreshPromise;

      if (refreshError) {
        console.error(
          "[API AUTH] Session refresh failed:",
          refreshError,
        );

        return null;
      }

      session =
        refreshedData?.session;

      console.log(
        "[API AUTH] Session refreshed:",
        session ? "YES" : "NO",
      );
    }

    const token =
      session?.access_token;

    console.log(
      "[API AUTH] Access token:",
      token ? "FOUND" : "MISSING",
    );

    return token || null;
  } catch (error) {
    console.error(
      "[API AUTH] Unexpected authentication error:",
      error,
    );

    return null;
  }
}

/* =========================================================
   REQUEST INTERCEPTOR

   Always attach a valid/current Supabase access token.
========================================================= */

api.interceptors.request.use(
  async (config) => {
    const token =
      await getValidAccessToken();

    if (token) {
      config.headers =
        config.headers || {};

      config.headers.Authorization =
        `Bearer ${token}`;
    } else {
      console.warn(
        "[API AUTH] No valid access token available.",
      );
    }

    return config;
  },
  (error) =>
    Promise.reject(error),
);

/* =========================================================
   RESPONSE INTERCEPTOR

   If backend says 401, refresh once and retry the request
   using the new access token.
========================================================= */

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest =
      error.config;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._authRetry
    ) {
      return Promise.reject(error);
    }

    originalRequest._authRetry = true;

    console.warn(
      "[API AUTH] Received 401. Refreshing Supabase session and retrying request...",
    );

    try {
      if (!refreshPromise) {
        refreshPromise =
          supabase.auth
            .refreshSession()
            .finally(() => {
              refreshPromise = null;
            });
      }

      const {
        data,
        error: refreshError,
      } = await refreshPromise;

      if (refreshError) {
        console.error(
          "[API AUTH] Retry refresh failed:",
          refreshError,
        );

        return Promise.reject(
          error,
        );
      }

      const newToken =
        data?.session?.access_token;

      if (!newToken) {
        console.error(
          "[API AUTH] Refresh succeeded but no access token was returned.",
        );

        return Promise.reject(
          error,
        );
      }

      originalRequest.headers =
        originalRequest.headers || {};

      originalRequest.headers.Authorization =
        `Bearer ${newToken}`;

      console.log(
        "[API AUTH] Retrying request with refreshed token.",
      );

      return api(
        originalRequest,
      );
    } catch (refreshError) {
      console.error(
        "[API AUTH] Failed to retry request:",
        refreshError,
      );

      return Promise.reject(
        error,
      );
    }
  },
);

export default api;