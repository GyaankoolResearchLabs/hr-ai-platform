import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

// GET /api/organizations/me
router.get("/me", requireAuth, async (req, res) => {
  const organization = await getOrganizationForUser(req.user.id);
  if (!organization) return res.status(404).json({ message: "No organization found" });
  res.json(organization);
});

// POST /api/organizations - creates the org, makes the caller its owner,
// and starts a mock subscription (see routes/subscription.js).
router.post("/", requireAuth, async (req, res) => {
  const { name, industry, size } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Organization name is required" });
  }

  const existing = await getOrganizationForUser(req.user.id);
  if (existing) {
    return res.status(409).json({ message: "You already belong to an organization", organization: existing });
  }

  const { data: organization, error: orgError } = await supabaseAdmin
    .from("organizations")
    .insert({ name: name.trim(), industry: industry || null, size: size || null, owner_id: req.user.id })
    .select()
    .single();

  if (orgError) {
    return res.status(500).json({ message: "Could not create organization", detail: orgError.message });
  }

  const { error: memberError } = await supabaseAdmin
    .from("organization_members")
    .insert({ organization_id: organization.id, user_id: req.user.id, role: "owner" });

  if (memberError) {
    return res.status(500).json({ message: "Could not link owner to organization", detail: memberError.message });
  }

  // Foundation subscription record — see routes/subscription.js for how
  // this gets read back. Defaults to a 14-day trial; no payment provider
  // is wired up yet.
  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 14);

  await supabaseAdmin.from("subscriptions").insert({
    organization_id: organization.id,
    status: "trialing",
    plan: "all-access",
    renews_at: trialEnds.toISOString(),
  });

  res.status(201).json(organization);
});

// PATCH /api/organizations/me - update current organization details
router.patch("/me", requireAuth, async (req, res) => {
  const { name, industry, size } = req.body || {};

  const allowed = {};
  if (name && name.trim()) allowed.name = name.trim();
  if (industry !== undefined) allowed.industry = industry || null;
  if (size !== undefined) allowed.size = size || null;

  if (Object.keys(allowed).length === 0) {
    return res.status(400).json({ message: "No valid fields to update." });
  }

  const { data: updated, error } = await supabaseAdmin
    .from("organizations")
    .update(allowed)
    .eq("id", req.user.organization_id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ message: "Could not update organization.", detail: error.message });
  }

  res.json(updated);
});

export default router;
