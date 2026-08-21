import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = express.Router();

router.use(requireAuth);

/* =========================================================
   ORGANIZATION
========================================================= */

async function requireOrganization(req, res, next) {
  try {
    const organization =
      await getOrganizationForUser(req.user.id);

    if (!organization) {
      return res.status(403).json({
        message:
          "Complete organization setup first.",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "[HiringPipeline] Organization lookup error:",
      error
    );

    return res.status(500).json({
      message:
        "Could not determine organization.",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   CONSTANTS
========================================================= */

const PIPELINE_STAGES = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
  "Rejected",
];

/* =========================================================
   GET CANDIDATES
   GET /api/hiring-pipeline
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId =
      req.organization.id;

    const {
      stage,
      search,
    } = req.query;

    let query = supabaseAdmin
      .from("hiring_pipeline_candidates")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .order("created_at", {
        ascending: false,
      });

    if (
      stage &&
      PIPELINE_STAGES.includes(stage)
    ) {
      query = query.eq(
        "stage",
        stage
      );
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      console.error(
        "[HiringPipeline] GET error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load hiring pipeline.",
        error: error.message,
      });
    }

    let candidates = data || [];

    /* -----------------------------------------------------
       SEARCH
    ----------------------------------------------------- */

    if (search?.trim()) {
      const term =
        search.trim().toLowerCase();

      candidates =
        candidates.filter(
          (candidate) =>
            candidate.candidate_name
              ?.toLowerCase()
              .includes(term) ||
            candidate.candidate_email
              ?.toLowerCase()
              .includes(term) ||
            candidate.job_title
              ?.toLowerCase()
              .includes(term)
        );
    }

    /* -----------------------------------------------------
       PIPELINE COUNTS
    ----------------------------------------------------- */

    const counts =
      PIPELINE_STAGES.reduce(
        (result, currentStage) => {
          result[currentStage] =
            candidates.filter(
              (candidate) =>
                candidate.stage ===
                currentStage
            ).length;

          return result;
        },
        {}
      );

    return res.status(200).json({
      candidates,
      counts,
      total: candidates.length,
      stages: PIPELINE_STAGES,
    });
  } catch (error) {
    console.error(
      "[HiringPipeline] GET exception:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to load hiring pipeline.",
    });
  }
});

/* =========================================================
   GET ONE CANDIDATE
   GET /api/hiring-pipeline/:id
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("hiring_pipeline_candidates")
      .select("*")
      .eq(
        "id",
        req.params.id
      )
      .eq(
        "organization_id",
        req.organization.id
      )
      .maybeSingle();

    if (error) {
      console.error(
        "[HiringPipeline] GET ONE error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load candidate.",
        error: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message:
          "Candidate not found.",
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error(
      "[HiringPipeline] GET ONE exception:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to load candidate.",
    });
  }
});

/* =========================================================
   CREATE CANDIDATE
   POST /api/hiring-pipeline
========================================================= */

router.post("/", async (req, res) => {
  try {
    const {
      candidateName,
      candidateEmail,
      jobTitle,
      stage = "Applied",
      notes = "",
    } = req.body;

    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    if (!candidateName?.trim()) {
      return res.status(400).json({
        message:
          "Candidate name is required.",
      });
    }

    if (!jobTitle?.trim()) {
      return res.status(400).json({
        message:
          "Job title is required.",
      });
    }

    if (
      !PIPELINE_STAGES.includes(stage)
    ) {
      return res.status(400).json({
        message:
          "Invalid pipeline stage.",
      });
    }

    /* -----------------------------------------------------
       INSERT
    ----------------------------------------------------- */

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("hiring_pipeline_candidates")
      .insert({
        organization_id:
          req.organization.id,

        candidate_name:
          candidateName.trim(),

        candidate_email:
          candidateEmail?.trim() ||
          null,

        job_title:
          jobTitle.trim(),

        stage,

        notes:
          notes?.trim() || "",

        created_by:
          req.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error(
        "[HiringPipeline] CREATE error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to create candidate.",
        error: error.message,
      });
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error(
      "[HiringPipeline] CREATE exception:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to create candidate.",
    });
  }
});

/* =========================================================
   UPDATE CANDIDATE
   PATCH /api/hiring-pipeline/:id
========================================================= */

router.patch("/:id", async (req, res) => {
  try {
    const {
      candidateName,
      candidateEmail,
      jobTitle,
      stage,
      notes,
    } = req.body;

    const updates = {};

    if (
      candidateName !== undefined
    ) {
      if (!candidateName.trim()) {
        return res.status(400).json({
          message:
            "Candidate name cannot be empty.",
        });
      }

      updates.candidate_name =
        candidateName.trim();
    }

    if (
      candidateEmail !== undefined
    ) {
      updates.candidate_email =
        candidateEmail?.trim() ||
        null;
    }

    if (
      jobTitle !== undefined
    ) {
      if (!jobTitle.trim()) {
        return res.status(400).json({
          message:
            "Job title cannot be empty.",
        });
      }

      updates.job_title =
        jobTitle.trim();
    }

    if (stage !== undefined) {
      if (
        !PIPELINE_STAGES.includes(stage)
      ) {
        return res.status(400).json({
          message:
            "Invalid pipeline stage.",
        });
      }

      updates.stage = stage;
    }

    if (notes !== undefined) {
      updates.notes =
        notes?.trim() || "";
    }

    if (
      Object.keys(updates).length === 0
    ) {
      return res.status(400).json({
        message:
          "No changes were provided.",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("hiring_pipeline_candidates")
      .update(updates)
      .eq(
        "id",
        req.params.id
      )
      .eq(
        "organization_id",
        req.organization.id
      )
      .select()
      .single();

    if (error) {
      console.error(
        "[HiringPipeline] UPDATE error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to update candidate.",
        error: error.message,
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error(
      "[HiringPipeline] UPDATE exception:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to update candidate.",
    });
  }
});

/* =========================================================
   MOVE CANDIDATE
   PATCH /api/hiring-pipeline/:id/stage
========================================================= */

router.patch(
  "/:id/stage",
  async (req, res) => {
    try {
      const { stage } =
        req.body;

      if (
        !PIPELINE_STAGES.includes(stage)
      ) {
        return res.status(400).json({
          message:
            "Invalid pipeline stage.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "hiring_pipeline_candidates"
        )
        .update({
          stage,
        })
        .eq(
          "id",
          req.params.id
        )
        .eq(
          "organization_id",
          req.organization.id
        )
        .select()
        .single();

      if (error) {
        console.error(
          "[HiringPipeline] STAGE error:",
          error
        );

        return res.status(500).json({
          message:
            "Failed to move candidate.",
          error: error.message,
        });
      }

      return res.status(200).json(data);
    } catch (error) {
      console.error(
        "[HiringPipeline] STAGE exception:",
        error
      );

      return res.status(500).json({
        message:
          error?.message ||
          "Failed to move candidate.",
      });
    }
  }
);

/* =========================================================
   DELETE CANDIDATE
   DELETE /api/hiring-pipeline/:id
========================================================= */

router.delete("/:id", async (req, res) => {
  try {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        "hiring_pipeline_candidates"
      )
      .delete()
      .eq(
        "id",
        req.params.id
      )
      .eq(
        "organization_id",
        req.organization.id
      )
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(
        "[HiringPipeline] DELETE error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to delete candidate.",
        error: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message:
          "Candidate not found.",
      });
    }

    return res.status(200).json({
      success: true,
      id: data.id,
    });
  } catch (error) {
    console.error(
      "[HiringPipeline] DELETE exception:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to delete candidate.",
    });
  }
});

export default router;