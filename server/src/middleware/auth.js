import "dotenv/config";
import { supabaseAdmin } from "../config/supabase.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

/* =========================================================
   SUPABASE TOKEN VERIFICATION

   IMPORTANT:
   Do NOT use:
       supabaseAdmin.auth.getClaims(token)

   We verify the access token directly against Supabase Auth.
   This avoids the JWT-expired issue we are currently seeing
   from the auth-js getClaims() path.
========================================================= */

async function verifySupabaseAccessToken(token) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase server authentication environment variables are missing."
    );
  }

  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/user`,
    {
      method: "GET",

      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const responseText = await response.text();

  let data = null;

  try {
    data = responseText
      ? JSON.parse(responseText)
      : null;
  } catch {
    data = null;
  }

  console.log(
    "[AUTH] Supabase Auth verification status:",
    response.status
  );

  if (!response.ok) {
    console.error(
      "[AUTH] Supabase Auth rejected access token:",
      data || responseText
    );

    return null;
  }

  if (!data?.id) {
    console.error(
      "[AUTH] Supabase Auth returned no authenticated user."
    );

    return null;
  }

  return data;
}

/* =========================================================
   ORGANIZATION LOOKUP
========================================================= */

async function getOrganizationMembership(userId) {
  const {
    data: membership,
    error,
  } = await supabaseAdmin
    .from("organization_members")
    .select(
      "organization_id, role"
    )
    .eq(
      "user_id",
      userId
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[AUTH] Organization membership lookup failed:",
      error
    );

    throw error;
  }

  return membership;
}

/* =========================================================
   REQUIRE AUTH
========================================================= */

export async function requireAuth(
  req,
  res,
  next
) {
  try {
    /* -------------------------------------------------------
       Read bearer token
    ------------------------------------------------------- */

    const authHeader =
      req.headers.authorization || "";

    const token =
      authHeader.startsWith("Bearer ")
        ? authHeader
            .slice(7)
            .trim()
        : null;

    console.log(
      "[AUTH] Authorization header:",
      authHeader
        ? "PRESENT"
        : "MISSING"
    );

    console.log(
      "[AUTH] Token:",
      token
        ? `PRESENT (${token.length} chars)`
        : "MISSING"
    );

    if (!token) {
      return res.status(401).json({
        message:
          "Missing bearer token",
      });
    }

    /* -------------------------------------------------------
       Basic JWT structure check
    ------------------------------------------------------- */

    const jwtParts =
      token.split(".");

    if (jwtParts.length !== 3) {
      console.error(
        "[AUTH] Invalid JWT structure."
      );

      return res.status(401).json({
        message:
          "Invalid authentication token",
      });
    }

    /* -------------------------------------------------------
       Decode payload ONLY for diagnostics.

       This does NOT establish trust.

       Supabase Auth /user endpoint below is what actually
       verifies the token.
    ------------------------------------------------------- */

    let decodedPayload = null;

    try {
      const payload =
        jwtParts[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/");

      const padded =
        payload +
        "=".repeat(
          (4 -
            (payload.length % 4)) %
            4
        );

      decodedPayload =
        JSON.parse(
          Buffer.from(
            padded,
            "base64"
          ).toString("utf8")
        );
    } catch (decodeError) {
      console.warn(
        "[AUTH] Could not decode JWT payload for diagnostics:",
        decodeError
      );
    }

    if (decodedPayload) {
      const now =
        Math.floor(
          Date.now() / 1000
        );

      const exp =
        Number(
          decodedPayload.exp || 0
        );

      const iat =
        Number(
          decodedPayload.iat || 0
        );

      console.log(
        "[AUTH] JWT diagnostic:",
        {
          sub:
            decodedPayload.sub ||
            null,

          iat,

          exp,

          now,

          secondsRemaining:
            exp - now,

          iss:
            decodedPayload.iss ||
            null,

          aud:
            decodedPayload.aud ||
            null,
        }
      );
    }

    /* -------------------------------------------------------
       VERIFY AGAINST SUPABASE AUTH

       This is the important part.
    ------------------------------------------------------- */

    const authenticatedUser =
      await verifySupabaseAccessToken(
        token
      );

    if (!authenticatedUser) {
      return res.status(401).json({
        message:
          "Invalid or expired session",
      });
    }

    const userId =
      authenticatedUser.id;

    console.log(
      "[AUTH] Supabase authenticated user:",
      userId
    );

    console.log(
      "[AUTH] Supabase authenticated email:",
      authenticatedUser.email ||
        "none"
    );

    /* -------------------------------------------------------
       Organization membership
    ------------------------------------------------------- */

    const membership =
      await getOrganizationMembership(
        userId
      );

    if (
      !membership?.organization_id
    ) {
      console.warn(
        "[AUTH] User does not belong to an organization:",
        userId
      );

      return res.status(403).json({
        message:
          "User is not associated with an organization.",
      });
    }

    /* -------------------------------------------------------
       Build req.user
    ------------------------------------------------------- */

    req.user = {
      id: userId,

      email:
        authenticatedUser.email ||
        null,

      organization_id:
        membership.organization_id,

      organization_role:
        membership.role,

      /*
       * Keep useful Supabase user information available to
       * existing routes without changing their behavior.
       */
      user_metadata:
        authenticatedUser.user_metadata ||
        {},

      app_metadata:
        authenticatedUser.app_metadata ||
        {},

      aud:
        authenticatedUser.aud ||
        null,

      role:
        authenticatedUser.role ||
        null,

      confirmed_at:
        authenticatedUser.confirmed_at ||
        null,

      created_at:
        authenticatedUser.created_at ||
        null,
    };

    console.log(
      "[AUTH] Authentication successful."
    );

    console.log(
      "[AUTH] User ID:",
      req.user.id
    );

    console.log(
      "[AUTH] Organization ID:",
      req.user.organization_id
    );

    console.log(
      "[AUTH] Organization role:",
      req.user.organization_role
    );

    next();
  } catch (error) {
    console.error(
      "[AUTH] Unexpected authentication error:",
      error
    );

    return res.status(401).json({
      message:
        "Authentication failed",
    });
  }
}