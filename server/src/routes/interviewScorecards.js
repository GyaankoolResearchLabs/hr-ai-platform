import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = express.Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION GUARD
========================================================= */

async function requireOrganization(req, res, next) {
  try {
    const organization = await getOrganizationForUser(
      req.user.id
    );

    if (!organization) {
      return res.status(403).json({
        message: "Complete organization setup first.",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "[Scorecards] Organization lookup error:",
      error
    );

    return res.status(500).json({
      message: "Could not determine organization.",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   GET ALL SCORECARDS
   GET /api/interview-scorecards
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId = req.organization.id;

    const { data, error } = await supabaseAdmin
      .from("interview_scorecards")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "[Scorecards] GET error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load interview scorecards.",
        error: error.message,
      });
    }

    return res.status(200).json(data || []);
  } catch (error) {
    console.error(
      "[Scorecards] GET exception:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to load interview scorecards.",
    });
  }
});

/* =========================================================
   CREATE SCORECARD
   POST /api/interview-scorecards
========================================================= */

router.post("/", async (req, res) => {
  try {
    const organizationId = req.organization.id;

    const {
      candidateName,
      candidateEmail,
      jobTitle,
      interviewerName,
      criteria = [],
      notes = "",
      status = "draft",
    } = req.body;

    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    if (!candidateName?.trim()) {
      return res.status(400).json({
        message: "Candidate name is required.",
      });
    }

    if (!jobTitle?.trim()) {
      return res.status(400).json({
        message: "Job title is required.",
      });
    }

    if (!interviewerName?.trim()) {
      return res.status(400).json({
        message: "Interviewer name is required.",
      });
    }

    if (!Array.isArray(criteria) || criteria.length === 0) {
      return res.status(400).json({
        message:
          "At least one evaluation criterion is required.",
      });
    }

    /* -----------------------------------------------------
       NORMALIZE CRITERIA
    ----------------------------------------------------- */

    const normalizedCriteria = criteria.map(
      (criterion) => ({
        id:
          criterion.id ||
          crypto.randomUUID(),

        name:
          criterion.name?.trim() ||
          "Untitled criterion",

        description:
          criterion.description?.trim() ||
          "",

        weight:
          Number(criterion.weight) > 0
            ? Number(criterion.weight)
            : 1,

        rating:
          criterion.rating === null ||
          criterion.rating === undefined
            ? null
            : Number(criterion.rating),

        feedback:
          criterion.feedback?.trim() ||
          "",
      })
    );

    /* -----------------------------------------------------
       INSERT
    ----------------------------------------------------- */

    const { data, error } = await supabaseAdmin
      .from("interview_scorecards")
      .insert({
        organization_id: organizationId,

        candidate_name:
          candidateName.trim(),

        candidate_email:
          candidateEmail?.trim() || null,

        job_title:
          jobTitle.trim(),

        interviewer_name:
          interviewerName.trim(),

        criteria:
          normalizedCriteria,

        notes:
          notes?.trim() || "",

        status:
          status || "draft",
      })
      .select()
      .single();

    if (error) {
      console.error(
        "[Scorecards] POST error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to create scorecard.",
        error: error.message,
      });
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error(
      "[Scorecards] POST exception:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to create scorecard.",
    });
  }
});

/* =========================================================
   UPDATE SCORECARD
   PATCH /api/interview-scorecards/:id
========================================================= */

router.patch("/:id", async (req, res) => {
  try {
    const organizationId = req.organization.id;

    const {
      candidateName,
      candidateEmail,
      jobTitle,
      interviewerName,
      criteria,
      notes,
      status,
    } = req.body;

    const updates = {};

    if (candidateName !== undefined) {
      updates.candidate_name =
        candidateName.trim();
    }

    if (candidateEmail !== undefined) {
      updates.candidate_email =
        candidateEmail?.trim() || null;
    }

    if (jobTitle !== undefined) {
      updates.job_title =
        jobTitle.trim();
    }

    if (interviewerName !== undefined) {
      updates.interviewer_name =
        interviewerName.trim();
    }

    if (criteria !== undefined) {
      updates.criteria =
        Array.isArray(criteria)
          ? criteria
          : [];
    }

    if (notes !== undefined) {
      updates.notes =
        notes?.trim() || "";
    }

    if (status !== undefined) {
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No changes were provided.",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("interview_scorecards")
      .update(updates)
      .eq("id", req.params.id)
      .eq(
        "organization_id",
        organizationId
      )
      .select()
      .single();

    if (error) {
      console.error(
        "[Scorecards] PATCH error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to update scorecard.",
        error: error.message,
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error(
      "[Scorecards] PATCH exception:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to update scorecard.",
    });
  }
});

/* =========================================================
   DELETE SCORECARD
   DELETE /api/interview-scorecards/:id
========================================================= */

router.delete("/:id", async (req, res) => {
  try {
    const organizationId = req.organization.id;

    const { data, error } = await supabaseAdmin
      .from("interview_scorecards")
      .delete()
      .eq("id", req.params.id)
      .eq(
        "organization_id",
        organizationId
      )
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(
        "[Scorecards] DELETE error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to delete scorecard.",
        error: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message:
          "Interview scorecard not found.",
      });
    }

    return res.status(200).json({
      success: true,
      id: data.id,
    });
  } catch (error) {
    console.error(
      "[Scorecards] DELETE exception:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to delete scorecard.",
    });
  }
});

export default router;