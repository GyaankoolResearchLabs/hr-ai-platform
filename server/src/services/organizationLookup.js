import { supabaseAdmin } from "../config/supabase.js";

/**
 * Get the organization associated with an authenticated user.
 *
 * Current model:
 * - A user belongs to at most one organization.
 * - Membership is stored in organization_members.
 * - The organization itself is stored in organizations.
 */
export async function getOrganizationForUser(userId) {
  if (!userId) {
    console.error(
      "[ORG LOOKUP] Missing userId"
    );

    return null;
  }

  console.log(
    "[ORG LOOKUP] Looking up organization for user:",
    userId
  );

  /*
   * =========================================================
   * 1. FIND MEMBERSHIP
   * =========================================================
   */

  const {
    data: membership,
    error: membershipError,
  } = await supabaseAdmin
    .from("organization_members")
    .select(
      "organization_id, role"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    console.error(
      "[ORG LOOKUP] Membership query failed:",
      membershipError
    );

    return null;
  }

  if (!membership) {
    console.log(
      "[ORG LOOKUP] No organization membership found for user:",
      userId
    );

    /*
     * Fallback:
     *
     * If the organization was created with owner_id but
     * the membership row somehow wasn't created, find it
     * directly through owner_id.
     *
     * This makes the organization lookup more resilient.
     */

    const {
      data: ownedOrganization,
      error: ownerLookupError,
    } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("owner_id", userId)
      .maybeSingle();

    if (ownerLookupError) {
      console.error(
        "[ORG LOOKUP] Owner organization lookup failed:",
        ownerLookupError
      );

      return null;
    }

    if (!ownedOrganization) {
      console.log(
        "[ORG LOOKUP] User does not own an organization."
      );

      return null;
    }

    console.log(
      "[ORG LOOKUP] Organization found through owner_id:",
      ownedOrganization.id
    );

    return {
      ...ownedOrganization,
      role: "owner",
    };
  }

  console.log(
    "[ORG LOOKUP] Membership found:",
    membership
  );

  /*
   * =========================================================
   * 2. FIND ORGANIZATION
   * =========================================================
   */

  const {
    data: organization,
    error: organizationError,
  } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .eq(
      "id",
      membership.organization_id
    )
    .maybeSingle();

  if (organizationError) {
    console.error(
      "[ORG LOOKUP] Organization query failed:",
      organizationError
    );

    return null;
  }

  if (!organization) {
    console.error(
      "[ORG LOOKUP] Membership exists but organization was not found:",
      membership.organization_id
    );

    return null;
  }

  console.log(
    "[ORG LOOKUP] Organization found:",
    organization.id
  );

  return {
    ...organization,
    role: membership.role,
  };
}