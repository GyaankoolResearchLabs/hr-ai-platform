import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| SUPABASE CONFIG
|--------------------------------------------------------------------------
|
| IMPORTANT:
| - SUPABASE_URL is safe to use for the Auth endpoint.
| - SUPABASE_ANON_KEY is used for password authentication.
| - NEVER send SUPABASE_SERVICE_ROLE_KEY to the browser.
|
*/

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

const AUTH_TIMEOUT_MS = 15000;

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function cleanEmail(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function cleanPassword(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value;
}

/*
|--------------------------------------------------------------------------
| TIMEOUT
|--------------------------------------------------------------------------
*/

function createTimeoutSignal(timeoutMs = AUTH_TIMEOUT_MS) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,

    clear() {
      clearTimeout(timeoutId);
    },
  };
}

/*
|--------------------------------------------------------------------------
| CONFIG VALIDATION
|--------------------------------------------------------------------------
*/

function validateSupabaseConfig() {
  if (!SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL is missing from server environment."
    );
  }

  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      "SUPABASE_ANON_KEY is missing from server environment."
    );
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/auth/login
|--------------------------------------------------------------------------
|
| Browser
|    ↓
| Express
|    ↓
| Supabase Auth REST API
|    ↓
| Access + refresh token
|    ↓
| Browser
|
|--------------------------------------------------------------------------
*/

router.post("/login", async (req, res) => {
  const timeout = createTimeoutSignal();

  try {
    validateSupabaseConfig();

    const email = cleanEmail(
      req.body?.email
    );

    const password = cleanPassword(
      req.body?.password
    );

    console.log(
      "[SERVER AUTH] Login request received."
    );

    console.log(
      "[SERVER AUTH] Email:",
      email || "MISSING"
    );

    console.log(
      "[SERVER AUTH] Password supplied:",
      password ? "YES" : "NO"
    );

    /*
    |--------------------------------------------------------------------------
    | VALIDATION
    |--------------------------------------------------------------------------
    */

    if (!email) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    if (!password) {
      return res.status(400).json({
        message: "Password is required.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | SUPABASE AUTH ENDPOINT
    |--------------------------------------------------------------------------
    */

    const endpoint =
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`;

    console.log(
      "[SERVER AUTH] Authenticating with Supabase..."
    );

    const response = await fetch(
      endpoint,
      {
        method: "POST",

        headers: {
          apikey: SUPABASE_ANON_KEY,

          Authorization:
            `Bearer ${SUPABASE_ANON_KEY}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          email,
          password,
        }),

        signal: timeout.signal,
      }
    );

    /*
    |--------------------------------------------------------------------------
    | READ RESPONSE
    |--------------------------------------------------------------------------
    */

    const responseText =
      await response.text();

    let responseData = null;

    try {
      responseData =
        responseText
          ? JSON.parse(responseText)
          : null;
    } catch {
      responseData = {
        message:
          responseText ||
          "Invalid response from Supabase.",
      };
    }

    /*
    |--------------------------------------------------------------------------
    | SUPABASE AUTH ERROR
    |--------------------------------------------------------------------------
    */

    if (!response.ok) {
      console.error(
        "[SERVER AUTH] Supabase authentication failed:",
        {
          status: response.status,
          statusText: response.statusText,
          message:
            responseData?.msg ||
            responseData?.message ||
            responseData?.error_description ||
            responseData?.error ||
            "Unknown Supabase authentication error.",
        }
      );

      const message =
        responseData?.msg ||
        responseData?.message ||
        responseData?.error_description ||
        responseData?.error ||
        "Invalid email or password.";

      /*
      |--------------------------------------------------------------------------
      | Do not expose unnecessary Supabase internals.
      |--------------------------------------------------------------------------
      */

      if (
        response.status >= 400 &&
        response.status < 500
      ) {
        return res.status(response.status).json({
          message,
        });
      }

      return res.status(401).json({
        message:
          "Invalid email or password.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | VALIDATE ACCESS TOKEN
    |--------------------------------------------------------------------------
    */

    if (!responseData?.access_token) {
      console.error(
        "[SERVER AUTH] Supabase returned no access token."
      );

      return res.status(401).json({
        message:
          "Authentication succeeded but no access token was returned.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | VALIDATE REFRESH TOKEN
    |--------------------------------------------------------------------------
    */

    if (!responseData?.refresh_token) {
      console.error(
        "[SERVER AUTH] Supabase returned no refresh token."
      );

      return res.status(401).json({
        message:
          "Authentication succeeded but no refresh token was returned.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | USER
    |--------------------------------------------------------------------------
    */

    const user =
      responseData?.user || null;

    console.log(
      "[SERVER AUTH] Supabase authentication successful."
    );

    console.log(
      "[SERVER AUTH] User ID:",
      user?.id || "UNKNOWN"
    );

    /*
    |--------------------------------------------------------------------------
    | RETURN SESSION
    |--------------------------------------------------------------------------
    |
    | Only authentication data is returned.
    |
    | NEVER return:
    | - SUPABASE_SERVICE_ROLE_KEY
    | - environment variables
    | - password
    |
    */

    const session = {
      access_token:
        responseData.access_token,

      refresh_token:
        responseData.refresh_token,

      expires_in:
        responseData.expires_in,

      expires_at:
        responseData.expires_at,

      token_type:
        responseData.token_type || "bearer",

      user,
    };

    console.log(
      "[SERVER AUTH] Returning session to client."
    );

    return res.status(200).json({
      session,
      user,
    });
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | TIMEOUT
    |--------------------------------------------------------------------------
    */

    if (
      error?.name === "AbortError"
    ) {
      console.error(
        "[SERVER AUTH] Supabase login timed out after",
        `${AUTH_TIMEOUT_MS}ms.`
      );

      return res.status(504).json({
        message:
          "Supabase authentication timed out. Please try again.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | NETWORK / UNEXPECTED ERROR
    |--------------------------------------------------------------------------
    */

    console.error(
      "[SERVER AUTH] Unexpected login error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to complete login. Please try again.",
    });
  } finally {
    timeout.clear();
  }
});

export default router;