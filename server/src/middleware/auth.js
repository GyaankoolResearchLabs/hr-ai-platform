import "dotenv/config";
import crypto from "node:crypto";
import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   SUPABASE CONFIG
========================================================= */

const SUPABASE_URL = process.env.SUPABASE_URL;

const SUPABASE_JWT_ISSUER = SUPABASE_URL
  ? `${SUPABASE_URL}/auth/v1`
  : null;

const JWKS_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`
  : null;

/* =========================================================
   JWKS CACHE
========================================================= */

let jwksCache = null;
let jwksFetchedAt = 0;

const JWKS_CACHE_DURATION = 24 * 60 * 60 * 1000;

/* =========================================================
   LOCAL JWKS
========================================================= */

function getLocalJwks() {
  const raw = process.env.SUPABASE_JWKS_JSON;

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!parsed || !Array.isArray(parsed.keys)) {
      console.error(
        "[AUTH] SUPABASE_JWKS_JSON exists but is invalid."
      );

      return null;
    }

    console.log(
      "[AUTH] Using Supabase JWKS from server environment."
    );

    return parsed;
  } catch (error) {
    console.error(
      "[AUTH] Failed to parse SUPABASE_JWKS_JSON:",
      error.message
    );

    return null;
  }
}

/* =========================================================
   BASE64URL DECODER
========================================================= */

function decodeBase64Url(value) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded =
    normalized +
    "=".repeat(
      (4 - (normalized.length % 4)) % 4
    );

  return Buffer.from(padded, "base64");
}

/* =========================================================
   JWT DECODER
========================================================= */

function decodeJwt(token) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid JWT structure.");
  }

  const header = JSON.parse(
    decodeBase64Url(parts[0]).toString("utf8")
  );

  const payload = JSON.parse(
    decodeBase64Url(parts[1]).toString("utf8")
  );

  return {
    header,
    payload,
    signature: parts[2],
  };
}

/* =========================================================
   REMOTE FETCH WITH TIMEOUT
========================================================= */

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 5000
) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        `Request timed out after ${timeoutMs}ms: ${url}`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/* =========================================================
   GET SUPABASE JWKS
========================================================= */

async function getSupabaseJwks() {
  const now = Date.now();

  /* -------------------------------------------------------
     1. Memory cache
  ------------------------------------------------------- */

  if (
    jwksCache &&
    now - jwksFetchedAt < JWKS_CACHE_DURATION
  ) {
    return jwksCache;
  }

  /* -------------------------------------------------------
     2. Local environment JWKS
  ------------------------------------------------------- */

  const localJwks = getLocalJwks();

  if (localJwks) {
    jwksCache = localJwks;
    jwksFetchedAt = now;

    return localJwks;
  }

  /* -------------------------------------------------------
     3. Remote Supabase JWKS fallback
  ------------------------------------------------------- */

  if (!JWKS_URL) {
    throw new Error(
      "SUPABASE_URL is missing from server environment."
    );
  }

  console.warn(
    "[AUTH] Local JWKS unavailable. Fetching Supabase JWKS..."
  );

  const response = await fetchWithTimeout(
    JWKS_URL,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
    5000
  );

  if (!response.ok) {
    throw new Error(
      `Supabase JWKS request failed with status ${response.status}.`
    );
  }

  const data = await response.json();

  if (!data || !Array.isArray(data.keys)) {
    throw new Error(
      "Supabase JWKS response is invalid."
    );
  }

  jwksCache = data;
  jwksFetchedAt = now;

  console.log(
    "[AUTH] Supabase JWKS loaded successfully."
  );

  return data;
}

/* =========================================================
   VERIFY JWT WITH JWK
========================================================= */

function verifyWithJwk(
  token,
  decoded,
  jwk
) {
  if (!jwk) {
    return false;
  }

  const algorithm = decoded.header?.alg;

  const publicKey = crypto.createPublicKey({
    key: jwk,
    format: "jwk",
  });

  const signingInput = token
    .split(".")
    .slice(0, 2)
    .join(".");

  const signature = decodeBase64Url(
    decoded.signature
  );

  /* -------------------------------------------------------
     ES256
  ------------------------------------------------------- */

  if (algorithm === "ES256") {
    return crypto.verify(
      "SHA256",
      Buffer.from(signingInput),
      {
        key: publicKey,
        dsaEncoding: "ieee-p1363",
      },
      signature
    );
  }

  /* -------------------------------------------------------
     ES384
  ------------------------------------------------------- */

  if (algorithm === "ES384") {
    return crypto.verify(
      "SHA384",
      Buffer.from(signingInput),
      {
        key: publicKey,
        dsaEncoding: "ieee-p1363",
      },
      signature
    );
  }

  /* -------------------------------------------------------
     ES512
  ------------------------------------------------------- */

  if (algorithm === "ES512") {
    return crypto.verify(
      "SHA512",
      Buffer.from(signingInput),
      {
        key: publicKey,
        dsaEncoding: "ieee-p1363",
      },
      signature
    );
  }

  /* -------------------------------------------------------
     RS256
  ------------------------------------------------------- */

  if (algorithm === "RS256") {
    return crypto.verify(
      "RSA-SHA256",
      Buffer.from(signingInput),
      publicKey,
      signature
    );
  }

  /* -------------------------------------------------------
     RS384
  ------------------------------------------------------- */

  if (algorithm === "RS384") {
    return crypto.verify(
      "RSA-SHA384",
      Buffer.from(signingInput),
      publicKey,
      signature
    );
  }

  /* -------------------------------------------------------
     RS512
  ------------------------------------------------------- */

  if (algorithm === "RS512") {
    return crypto.verify(
      "RSA-SHA512",
      Buffer.from(signingInput),
      publicKey,
      signature
    );
  }

  console.error(
    "[AUTH] Unsupported JWT algorithm:",
    algorithm
  );

  return false;
}

/* =========================================================
   VERIFY JWT SIGNATURE
========================================================= */

async function verifyJwtSignature(
  token,
  decoded
) {
  const algorithm = decoded.header?.alg;
  const kid = decoded.header?.kid;

  /* -------------------------------------------------------
     HS256
  ------------------------------------------------------- */

  if (algorithm === "HS256") {
    const jwtSecret =
      process.env.SUPABASE_JWT_SECRET;

    if (!jwtSecret) {
      console.error(
        "[AUTH] HS256 detected but SUPABASE_JWT_SECRET is missing."
      );

      return false;
    }

    const signingInput = token
      .split(".")
      .slice(0, 2)
      .join(".");

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          jwtSecret
        )
        .update(signingInput)
        .digest("base64url");

    const actualSignature =
      decoded.signature;

    const expectedBuffer =
      Buffer.from(expectedSignature);

    const actualBuffer =
      Buffer.from(actualSignature);

    if (
      expectedBuffer.length !==
      actualBuffer.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      expectedBuffer,
      actualBuffer
    );
  }

  /* -------------------------------------------------------
     Asymmetric JWT
  ------------------------------------------------------- */

  const jwks =
    await getSupabaseJwks();

  let key = jwks.keys.find(
    (item) =>
      item.kid === kid
  );

  /* -------------------------------------------------------
     Handle key rotation
  ------------------------------------------------------- */

  if (!key) {
    console.warn(
      "[AUTH] JWT signing key not found in current JWKS.",
      {
        kid,
        algorithm,
      }
    );

    /*
     * If we're using environment JWKS, don't repeatedly
     * hit Supabase. The environment value should be updated
     * if Supabase rotates the signing key.
     */

    if (process.env.SUPABASE_JWKS_JSON) {
      console.error(
        "[AUTH] Current SUPABASE_JWKS_JSON does not contain JWT kid:",
        kid
      );

      return false;
    }

    jwksCache = null;
    jwksFetchedAt = 0;

    const refreshed =
      await getSupabaseJwks();

    key = refreshed.keys.find(
      (item) =>
        item.kid === kid
    );

    if (!key) {
      console.error(
        "[AUTH] JWT signing key still not found:",
        kid
      );

      return false;
    }
  }

  return verifyWithJwk(
    token,
    decoded,
    key
  );
}

/* =========================================================
   VALIDATE JWT CLAIMS
========================================================= */

function validateJwtClaims(payload) {
  if (!payload) {
    return {
      valid: false,
      reason: "JWT payload missing.",
    };
  }

  if (!payload.sub) {
    return {
      valid: false,
      reason: "JWT subject missing.",
    };
  }

  const now =
    Math.floor(Date.now() / 1000);

  const exp =
    Number(payload.exp || 0);

  if (!exp) {
    return {
      valid: false,
      reason: "JWT expiration missing.",
    };
  }

  if (exp <= now) {
    return {
      valid: false,
      reason: "JWT expired.",
    };
  }

  if (
    SUPABASE_JWT_ISSUER &&
    payload.iss &&
    payload.iss !== SUPABASE_JWT_ISSUER
  ) {
    return {
      valid: false,
      reason: "JWT issuer is invalid.",
    };
  }

  const audience =
    payload.aud;

  const validAudience =
    audience === "authenticated" ||
    (
      Array.isArray(audience) &&
      audience.includes("authenticated")
    );

  if (!validAudience) {
    return {
      valid: false,
      reason: "JWT audience is invalid.",
    };
  }

  return {
    valid: true,
  };
}

/* =========================================================
   ORGANIZATION MEMBERSHIP
========================================================= */

async function getOrganizationMembership(
  userId
) {
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
       Bearer token
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
       Decode JWT
    ------------------------------------------------------- */

    let decoded;

    try {
      decoded =
        decodeJwt(token);
    } catch (error) {
      console.error(
        "[AUTH] JWT decoding failed:",
        error.message
      );

      return res.status(401).json({
        message:
          "Invalid authentication token",
      });
    }

    const {
      header,
      payload,
    } = decoded;

    /* -------------------------------------------------------
       Diagnostics
    ------------------------------------------------------- */

    const now =
      Math.floor(Date.now() / 1000);

    const exp =
      Number(payload.exp || 0);

    console.log(
      "[AUTH] JWT diagnostic:",
      {
        sub:
          payload.sub || null,

        iat:
          Number(payload.iat || 0),

        exp,

        now,

        secondsRemaining:
          exp - now,

        iss:
          payload.iss || null,

        aud:
          payload.aud || null,

        alg:
          header.alg || null,

        kid:
          header.kid || null,
      }
    );

    /* -------------------------------------------------------
       Validate claims
    ------------------------------------------------------- */

    const claims =
      validateJwtClaims(payload);

    if (!claims.valid) {
      console.error(
        "[AUTH] JWT claim validation failed:",
        claims.reason
      );

      return res.status(401).json({
        message:
          "Invalid or expired session",
      });
    }

    /* -------------------------------------------------------
       Verify signature
    ------------------------------------------------------- */

    let signatureValid = false;

    try {
      signatureValid =
        await verifyJwtSignature(
          token,
          decoded
        );
    } catch (verificationError) {
      console.error(
        "[AUTH] JWT signature verification error:",
        verificationError
      );

      return res.status(401).json({
        message:
          "Authentication verification failed",
      });
    }

    if (!signatureValid) {
      console.error(
        "[AUTH] JWT signature is invalid."
      );

      return res.status(401).json({
        message:
          "Invalid authentication token",
      });
    }

    console.log(
      "[AUTH] JWT signature verified successfully."
    );

    /* -------------------------------------------------------
       Organization membership
    ------------------------------------------------------- */

    const userId =
      payload.sub;

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
      id:
        userId,

      email:
        payload.email ||
        null,

      organization_id:
        membership.organization_id,

      organization_role:
        membership.role ||
        null,

      user_metadata:
        payload.user_metadata ||
        {},

      app_metadata:
        payload.app_metadata ||
        {},

      aud:
        payload.aud ||
        null,

      role:
        payload.role ||
        null,

      confirmed_at:
        payload.confirmed_at ||
        null,

      created_at:
        payload.created_at ||
        null,
    };

    /* -------------------------------------------------------
       Success
    ------------------------------------------------------- */

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