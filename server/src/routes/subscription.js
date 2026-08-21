import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

/**
 * GET /api/subscription/status
 *
 * Foundation implementation: reads the single `subscriptions` row created
 * for the org at signup (routes/organizations.js). One subscription
 * unlocks every category and tool — there is no per-tool or per-category
 * plan, so this endpoint is intentionally the only thing the frontend
 * checks (see subscriptionService.isActive on the client).
 *
 * No payment provider is integrated yet. Swap the query below for a real
 * billing lookup (Stripe, Razorpay, etc.) without changing the response
 * shape and the rest of the app keeps working.
 */
router.get("/status", requireAuth, async (req, res) => {
  const organization = await getOrganizationForUser(req.user.id);
  if (!organization) {
    return res.status(403).json({ message: "Complete organization setup first" });
  }

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("status, plan, renews_at")
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ message: "Could not load subscription", detail: error.message });
  }

  if (!data) {
    return res.json({ status: "inactive", plan: null, renewsAt: null });
  }

  res.json({ status: data.status, plan: data.plan, renewsAt: data.renews_at });
});

export default router;
