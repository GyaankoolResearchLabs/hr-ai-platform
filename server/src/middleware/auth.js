import { supabaseAdmin } from "../config/supabase.js";

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    console.log(
      "[AUTH] Authorization header:",
      authHeader ? "PRESENT" : "MISSING"
    );

    console.log(
      "[AUTH] Token:",
      token ? `PRESENT (${token.length} chars)` : "MISSING"
    );

    // ---------------------------------------------------------
    // 1. Make sure a bearer token exists
    // ---------------------------------------------------------

    if (!token) {
      return res.status(401).json({
        message: "Missing bearer token",
      });
    }

    // ---------------------------------------------------------
    // 2. Validate the Supabase session
    // ---------------------------------------------------------

    const { data, error } =
      await supabaseAdmin.auth.getUser(token);

    if (error) {
      console.error(
        "[AUTH] Supabase getUser error:",
        error
      );

      return res.status(401).json({
        message: "Invalid or expired session",
      });
    }

    if (!data?.user) {
      console.error(
        "[AUTH] Supabase returned no user"
      );

      return res.status(401).json({
        message: "Invalid or expired session",
      });
    }

    const user = data.user;

    console.log(
      "[AUTH] Authenticated user:",
      user.id
    );

    // ---------------------------------------------------------
    // 3. Find the user's organization
    // ---------------------------------------------------------
    //
    // Your application stores the relationship in:
    //
    // organization_members
    //
    // user_id         -> authenticated user
    // organization_id -> organization they belong to
    //
    // ---------------------------------------------------------

    const {
      data: membership,
      error: membershipError,
    } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error(
        "[AUTH] Organization membership lookup failed:",
        membershipError
      );

      return res.status(500).json({
        message: "Could not determine organization.",
        detail: membershipError.message,
      });
    }

    // ---------------------------------------------------------
    // 4. Attach organization information to req.user
    // ---------------------------------------------------------

    if (!membership?.organization_id) {
      console.warn(
        "[AUTH] User does not belong to an organization:",
        user.id
      );

      return res.status(403).json({
        message: "User is not associated with an organization.",
      });
    }

    req.user = {
      ...user,
      organization_id: membership.organization_id,
      organization_role: membership.role,
    };

    console.log(
      "[AUTH] Organization ID:",
      membership.organization_id
    );

    console.log(
      "[AUTH] Organization role:",
      membership.role
    );

    // ---------------------------------------------------------
    // 5. Continue to the requested route
    // ---------------------------------------------------------

    next();
  } catch (error) {
    console.error(
      "[AUTH] Unexpected authentication error:",
      error
    );

    return res.status(401).json({
      message: "Authentication failed",
    });
  }
}