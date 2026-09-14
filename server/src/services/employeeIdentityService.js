import { supabaseAdmin } from "../config/supabase.js";
import { getCached, setCached, evictCached } from "../utils/shortLivedCache.js";

/*
|--------------------------------------------------------------------------
| EMPLOYEE RESOLUTION CACHE
|--------------------------------------------------------------------------
|
| Short-lived (see utils/shortLivedCache.js for the security notes on
| what this is and isn't safe to cache). Only a successful resolution
| is ever cached - never the "not linked" case, for the same reason
| requireAuth's membership cache doesn't cache a miss: that's exactly
| the pre-invite-accept window, and caching it would delay a
| just-completed accept from taking effect.
|--------------------------------------------------------------------------
*/

const EMPLOYEE_CACHE_TTL_MS = 7000;
const EMPLOYEE_CACHE_KEY_PREFIX = "employee-resolution:";

function employeeCacheKey(organizationId, userId) {
  return `${EMPLOYEE_CACHE_KEY_PREFIX}${organizationId}:${userId}`;
}

/**
 * Call right after linking/unlinking employees.user_id, or deleting
 * an employee row, so the change applies before the TTL would
 * otherwise expire on its own.
 */
export function evictEmployeeResolutionCache(organizationId, userId) {
  if (!organizationId || !userId) {
    return;
  }

  evictCached(employeeCacheKey(organizationId, userId));
}

function createIdentityError(message, status = 403) {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;

  return error;
}

export async function resolveEmployeeForUser({
  organizationId,
  userId,
  email,
} = {}) {
  if (!organizationId) {
    throw createIdentityError(
      "Organization context is required.",
      400,
    );
  }

  if (!userId) {
    throw createIdentityError(
      "Authenticated user is required.",
      401,
    );
  }

  const cacheKey = employeeCacheKey(organizationId, userId);
  const cached = getCached(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  const {
    data: linkedEmployee,
    error: linkedError,
  } = await supabaseAdmin
    .from("employees")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (linkedError && linkedError.code !== "42703") {
    throw linkedError;
  }

  if (linkedEmployee) {
    setCached(cacheKey, linkedEmployee, EMPLOYEE_CACHE_TTL_MS);
    return linkedEmployee;
  }

  if (!normalizedEmail) {
    throw createIdentityError(
      "This user is not linked to an employee record.",
      403,
    );
  }

  const { data, error } =
    await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("organization_id", organizationId)
      .ilike("email", normalizedEmail)
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createIdentityError(
      "This user is not linked to an employee record.",
      403,
    );
  }

  // Pre-link (email-fallback) match - not cached, since the very
  // next successful request is likely the accept flow completing the
  // real user_id link, which must be picked up immediately.
  return data;
}

export default resolveEmployeeForUser;
