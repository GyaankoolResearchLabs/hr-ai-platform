import { supabase } from "../lib/supabaseClient";

/*
 * =========================================================
 * AUTH SERVICE
 *
 * Single source of truth for Supabase authentication.
 *
 * Important:
 * - Always passes a real string email to Supabase.
 * - Validates the JWT itself instead of trusting only
 *   session.expires_at.
 * - Refreshes expired / nearly expired access tokens.
 * - Keeps the rest of the application independent from
 *   Supabase session-storage details.
 * =========================================================
 */

let refreshPromise = null;

/* =========================================================
   HELPERS
========================================================= */

function normalizeEmail(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function normalizePassword(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value;
}

/*
 * Decode the JWT payload without verifying it.
 *
 * This is ONLY used to inspect exp locally.
 * Actual authentication is still performed by Supabase.
 */
function decodeJwtPayload(token) {
  try {
    if (
      typeof token !== "string" ||
      !token
    ) {
      return null;
    }

    const parts = token.split(".");

    if (parts.length !== 3) {
      return null;
    }

    const base64Url = parts[1];

    const base64 = base64Url
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded =
      base64 +
      "=".repeat(
        (4 - (base64.length % 4)) % 4
      );

    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map(
          (char) =>
            "%" +
            ("00" +
              char.charCodeAt(0).toString(16))
              .slice(-2)
        )
        .join("")
    );

    return JSON.parse(json);
  } catch (error) {
    console.warn(
      "[AUTH SERVICE] Could not decode JWT:",
      error
    );

    return null;
  }
}

function getTokenExpiry(token) {
  const payload =
    decodeJwtPayload(token);

  const exp = Number(
    payload?.exp || 0
  );

  return Number.isFinite(exp)
    ? exp
    : 0;
}

function getTokenSecondsRemaining(token) {
  const exp =
    getTokenExpiry(token);

  if (!exp) {
    return 0;
  }

  return (
    exp -
    Math.floor(Date.now() / 1000)
  );
}

/* =========================================================
   REFRESH SESSION
========================================================= */

async function refreshSession() {
  /*
   * Prevent several simultaneous API requests from
   * triggering several refresh requests.
   */
  if (!refreshPromise) {
    refreshPromise =
      (async () => {
        console.log(
          "[AUTH SERVICE] Refreshing Supabase session..."
        );

        const {
          data,
          error,
        } =
          await supabase.auth.refreshSession();

        if (error) {
          console.error(
            "[AUTH SERVICE] Session refresh failed:",
            error
          );

          throw error;
        }

        const session =
          data?.session || null;

        if (!session?.access_token) {
          throw new Error(
            "Supabase refresh returned no access token."
          );
        }

        console.log(
          "[AUTH SERVICE] Session refresh successful."
        );

        console.log(
          "[AUTH SERVICE] New JWT seconds remaining:",
          getTokenSecondsRemaining(
            session.access_token
          )
        );

        return session;
      })().finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

/* =========================================================
   GET CURRENT VALID SESSION
========================================================= */

async function getSession() {
  try {
    console.log(
      "[AUTH SERVICE] Getting current Supabase session..."
    );

    const {
      data,
      error,
    } =
      await supabase.auth.getSession();

    if (error) {
      console.error(
        "[AUTH SERVICE] getSession failed:",
        error
      );

      return null;
    }

    let session =
      data?.session || null;

    if (!session) {
      console.log(
        "[AUTH SERVICE] No Supabase session."
      );

      return null;
    }

    const token =
      session.access_token;

    const secondsRemaining =
      getTokenSecondsRemaining(token);

    console.log(
      "[AUTH SERVICE] Actual JWT seconds remaining:",
      secondsRemaining
    );

    /*
     * IMPORTANT:
     *
     * Do NOT trust only session.expires_at.
     *
     * The previous bug was exactly this:
     *
     * session.expires_at looked valid,
     * but access_token.exp was already expired.
     */

    if (
      !token ||
      secondsRemaining <= 60
    ) {
      console.log(
        "[AUTH SERVICE] JWT expired or near expiry. Forcing refresh..."
      );

      try {
        session =
          await refreshSession();
      } catch (refreshError) {
        console.error(
          "[AUTH SERVICE] Unable to refresh expired session:",
          refreshError
        );

        return null;
      }
    }

    if (!session?.access_token) {
      console.warn(
        "[AUTH SERVICE] Valid session has no access token."
      );

      return null;
    }

    const finalSecondsRemaining =
      getTokenSecondsRemaining(
        session.access_token
      );

    if (
      finalSecondsRemaining <= 0
    ) {
      console.error(
        "[AUTH SERVICE] Refreshed JWT is still expired."
      );

      return null;
    }

    console.log(
      "[AUTH SERVICE] Valid session available."
    );

    console.log(
      "[AUTH SERVICE] Final JWT seconds remaining:",
      finalSecondsRemaining
    );

    return session;
  } catch (error) {
    console.error(
      "[AUTH SERVICE] getSession unexpected error:",
      error
    );

    return null;
  }
}

/* =========================================================
   SIGN IN
========================================================= */

async function signIn(
  emailOrCredentials,
  passwordArgument
) {
  try {
    /*
     * Support BOTH:
     *
     * signIn(email, password)
     *
     * and
     *
     * signIn({ email, password })
     *
     * This prevents the undefined-email bug regardless
     * of which existing Login.jsx calling convention
     * is currently being used.
     */

    let email = "";
    let password = "";

    if (
      emailOrCredentials &&
      typeof emailOrCredentials ===
        "object"
    ) {
      email =
        normalizeEmail(
          emailOrCredentials.email
        );

      password =
        normalizePassword(
          emailOrCredentials.password
        );
    } else {
      email =
        normalizeEmail(
          emailOrCredentials
        );

      password =
        normalizePassword(
          passwordArgument
        );
    }

    console.log(
      "[AUTH SERVICE] Sign-in requested."
    );

    console.log(
      "[AUTH SERVICE] Email:",
      email || "MISSING"
    );

    console.log(
      "[AUTH SERVICE] Password supplied:",
      password ? "YES" : "NO"
    );

    /*
     * NEVER allow undefined/null to reach
     * signInWithPassword().
     */

    if (!email) {
      throw new Error(
        "Email is required."
      );
    }

    if (!password) {
      throw new Error(
        "Password is required."
      );
    }

    /*
     * Supabase requires these exact fields.
     */
    const credentials = {
      email,
      password,
    };

    console.log(
      "[AUTH SERVICE] Sending valid Supabase password credentials."
    );

    const {
      data,
      error,
    } =
      await supabase.auth.signInWithPassword(
        credentials
      );

    if (error) {
      console.error(
        "[AUTH SERVICE] Supabase sign-in failed:",
        error
      );

      throw error;
    }

    const session =
      data?.session || null;

    if (!session) {
      throw new Error(
        "Login succeeded but Supabase returned no session."
      );
    }

    if (!session.access_token) {
      throw new Error(
        "Login succeeded but no access token was returned."
      );
    }

    console.log(
      "[AUTH SERVICE] Sign-in successful."
    );

    console.log(
      "[AUTH SERVICE] User ID:",
      session.user?.id
    );

    console.log(
      "[AUTH SERVICE] Email:",
      session.user?.email
    );

    console.log(
      "[AUTH SERVICE] JWT seconds remaining:",
      getTokenSecondsRemaining(
        session.access_token
      )
    );

    return {
      session,
      user:
        data?.user ||
        session.user ||
        null,
    };
  } catch (error) {
    console.error(
      "[AUTH SERVICE] Sign-in error:",
      error
    );

    throw error;
  }
}

/* =========================================================
   SIGN OUT
========================================================= */

async function signOut() {
  try {
    console.log(
      "[AUTH SERVICE] Signing out..."
    );

    const {
      error,
    } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "[AUTH SERVICE] Sign-out failed:",
        error
      );

      throw error;
    }

    console.log(
      "[AUTH SERVICE] Sign-out successful."
    );
  } catch (error) {
    console.error(
      "[AUTH SERVICE] Sign-out error:",
      error
    );

    throw error;
  }
}

/* =========================================================
   AUTH STATE LISTENER
========================================================= */

function onAuthStateChange(
  callback
) {
  const {
    data,
  } =
    supabase.auth.onAuthStateChange(
      (
        event,
        session
      ) => {
        console.log(
          "[AUTH SERVICE] Auth event:",
          event
        );

        console.log(
          "[AUTH SERVICE] Session:",
          session
            ? "PRESENT"
            : "MISSING"
        );

        if (
          typeof callback ===
          "function"
        ) {
          callback(
            session || null,
            event
          );
        }
      }
    );

  return (
    data?.subscription || null
  );
}

/* =========================================================
   GET ACCESS TOKEN
========================================================= */

async function getAccessToken() {
  const session =
    await getSession();

  return (
    session?.access_token ||
    null
  );
}

/* =========================================================
   EXPORT
========================================================= */

export const authService = {
  signIn,
  signOut,
  getSession,
  getAccessToken,
  refreshSession,
  onAuthStateChange,
};

export default authService;