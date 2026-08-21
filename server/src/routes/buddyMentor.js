import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

import {
  getBuddyAssignments,
  createBuddyAssignment,
  updateBuddyAssignment,
  deleteBuddyAssignment,
} from "../services/buddyMentorService.js";

const router = Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION
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
      "[BuddyMentor] Organization lookup error:",
      error
    );

    return res.status(500).json({
      message: "Could not determine organization.",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   HELPER
========================================================= */

function getOrganizationId(req) {
  return req.organization?.id || null;
}

/* =========================================================
   GET ALL BUDDY ASSIGNMENTS
   GET /api/buddy-mentor/assignments
========================================================= */

router.get("/assignments", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization not found.",
      });
    }

    const assignments =
      await getBuddyAssignments(
        organizationId
      );

    return res.status(200).json({
      assignments,
    });
  } catch (error) {
    console.error(
      "[BuddyMentor] Get assignments error:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to load buddy assignments.",
    });
  }
});

/* =========================================================
   ASSIGN BUDDY
   POST /api/buddy-mentor/assignments
========================================================= */

router.post("/assignments", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    const {
      newHireId,
      new_hire_id,
      buddyId,
      buddy_id,
      role = "buddy",
      notes = null,
    } = req.body || {};

    const finalNewHireId =
      newHireId || new_hire_id;

    const finalBuddyId =
      buddyId || buddy_id;

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization not found.",
      });
    }

    if (!finalNewHireId) {
      return res.status(400).json({
        message: "New hire is required.",
      });
    }

    if (!finalBuddyId) {
      return res.status(400).json({
        message: "Buddy is required.",
      });
    }

    const assignment =
      await createBuddyAssignment({
        organizationId,
        newHireId: finalNewHireId,
        buddyId: finalBuddyId,
        role,
        notes,
      });

    return res.status(201).json({
      message:
        "Buddy assigned successfully.",
      assignment,
    });
  } catch (error) {
    console.error(
      "[BuddyMentor] Create assignment error:",
      error
    );

    return res.status(400).json({
      message:
        error?.message ||
        "Failed to assign buddy.",
    });
  }
});

/* =========================================================
   UPDATE BUDDY ASSIGNMENT
   PATCH /api/buddy-mentor/assignments/:id
========================================================= */

router.patch(
  "/assignments/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message: "Organization not found.",
        });
      }

      const {
        buddyId,
        buddy_id,
        role,
        status,
        notes,
      } = req.body || {};

      const assignment =
        await updateBuddyAssignment({
          organizationId,
          assignmentId: req.params.id,
          buddyId:
            buddyId !== undefined
              ? buddyId
              : buddy_id,
          role,
          status,
          notes,
        });

      return res.status(200).json({
        message:
          "Buddy assignment updated successfully.",
        assignment,
      });
    } catch (error) {
      console.error(
        "[BuddyMentor] Update assignment error:",
        error
      );

      return res.status(400).json({
        message:
          error?.message ||
          "Failed to update buddy assignment.",
      });
    }
  }
);

/* =========================================================
   DELETE BUDDY ASSIGNMENT
   DELETE /api/buddy-mentor/assignments/:id
========================================================= */

router.delete(
  "/assignments/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message: "Organization not found.",
        });
      }

      await deleteBuddyAssignment({
        organizationId,
        assignmentId: req.params.id,
      });

      return res.status(200).json({
        message:
          "Buddy assignment removed successfully.",
      });
    } catch (error) {
      console.error(
        "[BuddyMentor] Delete assignment error:",
        error
      );

      return res.status(400).json({
        message:
          error?.message ||
          "Failed to remove buddy assignment.",
      });
    }
  }
);

export default router;