import { supabaseAdmin } from "../config/supabase.js";
import { getCached, setCached } from "../utils/shortLivedCache.js";

/*
|--------------------------------------------------------------------------
| PLATFORM ADMIN CHECK
|--------------------------------------------------------------------------
|
| Checks a verified user's email against the platform_admins table — an
| allow-list completely independent of organization_role. This is what
| middleware/requirePlatformAdmin.js calls.
|
| SECURITY NOTE:
|
| This table can change (an admin added/removed) and this gates access to
| sensitive error detail, so correctness matters more than speed here. The
| TTL below is intentionally very short (a few seconds) — just enough to
| absorb the case of a single user hammering the logs page with requests,
| not a "good enough" staleness window the way the org-membership cache in
| middleware/auth.js is. A removed admin is locked out within seconds, not
| minutes.
|--------------------------------------------------------------------------
*/

const PLATFORM_ADMIN_CACHE_TTL_MS = 3000;
const PLATFORM_ADMIN_CACHE_KEY_PREFIX = "platform-admin:";

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/**
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function isPlatformAdmin(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  const cacheKey = `${PLATFORM_ADMIN_CACHE_KEY_PREFIX}${normalizedEmail}`;
  const cached = getCached(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const { data, error } = await supabaseAdmin
    .from("platform_admins")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error(
      "[PlatformAdmin] Allow-list lookup failed:",
      error
    );

    // Fail closed: a lookup error must never be treated as "is an admin".
    return false;
  }

  const result = Boolean(data);

  setCached(cacheKey, result, PLATFORM_ADMIN_CACHE_TTL_MS);

  return result;
}

export default isPlatformAdmin;
