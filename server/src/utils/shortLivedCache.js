/*
|--------------------------------------------------------------------------
| SHORT-LIVED IN-MEMORY CACHE
|--------------------------------------------------------------------------
|
| A tiny TTL cache for per-request identity lookups that otherwise run
| on every single authenticated request (organization membership,
| employee resolution) even though the underlying data barely ever
| changes mid-session.
|
| SECURITY NOTE — read this before reusing this for anything else:
|
| This is intentionally NOT used anywhere near JWT verification. Token
| signature/expiry checks stay fully live on every request — this
| cache only shortcuts "given an already-valid, authenticated user,
| what's their role / employee record", never "is this token still
| valid". A stolen or expired token is still rejected in real time
| regardless of this cache.
|
| The TTL bounds how long a user can keep acting under a role/link
| that HR just changed (a role downgrade, an employee record deleted,
| an invite revoked). Callers that WRITE one of these should call
| evict()/evictPrefix() for the affected user right after the write,
| so the TTL is a safety-net upper bound rather than the only
| protection — see routes/employeeInvitations.js and routes/employees.js
| for the eviction call sites.
|
| Single in-memory Map — correct as long as the server runs as one
| process (it does today; no deployment config in this repo describes
| multiple instances). If this is ever deployed behind a load
| balancer with more than one instance, the TTL bound still holds per
| instance, but an eviction on one instance won't clear another's
| cache entry until its own TTL expires — worth revisiting at that
| point, not blocking today.
|--------------------------------------------------------------------------
*/

const store = new Map();

/**
 * @param {string} key
 * @returns {any | undefined} the cached value, or undefined if missing/expired
 */
export function getCached(key) {
  const entry = store.get(key);

  if (!entry) {
    return undefined;
  }

  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return undefined;
  }

  return entry.value;
}

/**
 * @param {string} key
 * @param {any} value
 * @param {number} ttlMs
 */
export function setCached(key, value, ttlMs) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Evict one exact key — call this right after writing a change that
 * the cached value would otherwise serve stale for up to its TTL.
 *
 * @param {string} key
 */
export function evictCached(key) {
  store.delete(key);
}

/**
 * Evict every cached key starting with `prefix` — useful when a
 * write affects a user across more than one cache namespace/key
 * shape (e.g. evicting all entries for a given user id regardless of
 * which organization key they were cached under).
 *
 * @param {string} prefix
 */
export function evictCachedPrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}
