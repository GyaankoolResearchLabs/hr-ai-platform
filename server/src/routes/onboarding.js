import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

import {
  getOnboardingJourneys,
  getOnboardingJourney,
  createOnboardingJourney,
  updateOnboardingJourneyStatus,
  createOnboardingTask,
  updateOnboardingTask,
  deleteOnboardingTask,
  getOnboardingJourneyProgress,
} from "../services/onboardingService.js";

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
        message: "Complete organization setup first",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "[Onboarding] Organization lookup error:",
      error
    );

    return res.status(500).json({
      message: "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   ORGANIZATION HELPER
========================================================= */

function getOrganizationId(req) {
  return req.organization?.id || null;
}

/* =========================================================
   GET ALL ONBOARDING JOURNEYS
   GET /api/onboarding/journeys
========================================================= */

router.get("/journeys", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    console.log("[Onboarding] GET journeys:", {
      organizationId,
      userId: req.user?.id,
    });

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization not found.",
      });
    }

    const journeys = await getOnboardingJourneys(
      organizationId
    );

    return res.status(200).json({
      journeys: journeys || [],
    });
  } catch (error) {
    console.error(
      "[Onboarding] Failed to get journeys:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to load onboarding journeys.",
    });
  }
});

/* =========================================================
   GET SINGLE ONBOARDING JOURNEY
   GET /api/onboarding/journeys/:id
========================================================= */

router.get(
  "/journeys/:id",
  async (req, res) => {
    try {
      const organizationId = getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message: "Organization not found.",
        });
      }

      const journey =
        await getOnboardingJourney(
          organizationId,
          req.params.id
        );

      if (!journey) {
        return res.status(404).json({
          message: "Onboarding journey not found.",
        });
      }

      return res.status(200).json({
        journey,
      });
    } catch (error) {
      console.error(
        "[Onboarding] Failed to get journey:",
        error
      );

      return res.status(500).json({
        message:
          error?.message ||
          "Failed to load onboarding journey.",
      });
    }
  }
);

/* =========================================================
   CREATE ONBOARDING JOURNEY
   POST /api/onboarding/journeys
========================================================= */

router.post(
  "/journeys",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const {
        employeeId,
        employee_id,
        joiningDate,
        joining_date,
      } = req.body || {};

      const finalEmployeeId =
        employeeId || employee_id;

      const finalJoiningDate =
        joiningDate || joining_date;

      console.log(
        "[Onboarding] CREATE journey:",
        {
          organizationId,
          employeeId: finalEmployeeId,
          joiningDate: finalJoiningDate,
          userId: req.user?.id,
        }
      );

      if (!organizationId) {
        return res.status(403).json({
          message: "Organization not found.",
        });
      }

      if (!finalEmployeeId) {
        return res.status(400).json({
          message: "Employee is required.",
        });
      }

      if (!finalJoiningDate) {
        return res.status(400).json({
          message: "Joining date is required.",
        });
      }

      const journey =
        await createOnboardingJourney({
          organizationId,
          employeeId: finalEmployeeId,
          joiningDate: finalJoiningDate,
        });

      return res.status(201).json({
        message:
          "Onboarding journey created successfully.",
        journey,
      });
    } catch (error) {
      console.error(
        "[Onboarding] Failed to create journey:",
        error
      );

      return res.status(500).json({
        message:
          error?.message ||
          "Failed to create onboarding journey.",
      });
    }
  }
);

/* =========================================================
   UPDATE JOURNEY STATUS
   PATCH /api/onboarding/journeys/:id/status
========================================================= */

router.patch(
  "/journeys/:id/status",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const { status } =
        req.body || {};

      if (!organizationId) {
        return res.status(403).json({
          message: "Organization not found.",
        });
      }

      if (!status) {
        return res.status(400).json({
          message: "Status is required.",
        });
      }

      const journey =
        await updateOnboardingJourneyStatus(
          organizationId,
          req.params.id,
          status
        );

      if (!journey) {
        return res.status(404).json({
          message:
            "Onboarding journey not found.",
        });
      }

      return res.status(200).json({
        message:
          "Journey status updated successfully.",
        journey,
      });
    } catch (error) {
      console.error(
        "[Onboarding] Failed to update journey status:",
        error
      );

      return res.status(500).json({
        message:
          error?.message ||
          "Failed to update journey status.",
      });
    }
  }
);

/* =========================================================
   CREATE ONBOARDING TASK
   POST /api/onboarding/journeys/:id/tasks
========================================================= */

router.post(
  "/journeys/:id/tasks",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const {
        title,
        description,
        category,
        dueDate,
        due_date,
      } = req.body || {};

      if (!organizationId) {
        return res.status(403).json({
          message: "Organization not found.",
        });
      }

      if (!title?.trim()) {
        return res.status(400).json({
          message: "Task title is required.",
        });
      }

      const task =
        await createOnboardingTask({
          organizationId,
          journeyId: req.params.id,
          title: title.trim(),
          description:
            description || "",
          category:
            category || "General",
          dueDate:
            dueDate ||
            due_date ||
            null,
        });

      return res.status(201).json({
        message:
          "Onboarding task created successfully.",
        task,
      });
    } catch (error) {
      console.error(
        "[Onboarding] Failed to create task:",
        error
      );

      return res.status(500).json({
        message:
          error?.message ||
          "Failed to create onboarding task.",
      });
    }
  }
);

/* =========================================================
   UPDATE ONBOARDING TASK
   PATCH /api/onboarding/tasks/:id
========================================================= */

router.patch(
  "/tasks/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message: "Organization not found.",
        });
      }

      const allowedFields = [
        "title",
        "description",
        "category",
        "due_date",
        "dueDate",
        "status",
      ];

      const updates = {};

      for (const field of allowedFields) {
        if (
          Object.prototype.hasOwnProperty.call(
            req.body || {},
            field
          )
        ) {
          const databaseField =
            field === "dueDate"
              ? "due_date"
              : field;

          updates[databaseField] =
            req.body[field];
        }
      }

      if (
        Object.keys(updates).length === 0
      ) {
        return res.status(400).json({
          message:
            "No valid task updates were provided.",
        });
      }

      if (
        Object.prototype.hasOwnProperty.call(
          updates,
          "title"
        ) &&
        !String(updates.title || "").trim()
      ) {
        return res.status(400).json({
          message: "Task title cannot be empty.",
        });
      }

      const task =
        await updateOnboardingTask(
          organizationId,
          req.params.id,
          updates
        );

      if (!task) {
        return res.status(404).json({
          message:
            "Onboarding task not found.",
        });
      }

      return res.status(200).json({
        message:
          "Onboarding task updated successfully.",
        task,
      });
    } catch (error) {
      console.error(
        "[Onboarding] Failed to update task:",
        error
      );

      return res.status(500).json({
        message:
          error?.message ||
          "Failed to update onboarding task.",
      });
    }
  }
);

/* =========================================================
   DELETE ONBOARDING TASK
   DELETE /api/onboarding/tasks/:id
========================================================= */

router.delete(
  "/tasks/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message: "Organization not found.",
        });
      }

      await deleteOnboardingTask(
        organizationId,
        req.params.id
      );

      return res.status(200).json({
        message:
          "Onboarding task deleted successfully.",
      });
    } catch (error) {
      console.error(
        "[Onboarding] Failed to delete task:",
        error
      );

      return res.status(500).json({
        message:
          error?.message ||
          "Failed to delete onboarding task.",
      });
    }
  }
);

/* =========================================================
   JOURNEY PROGRESS
   GET /api/onboarding/journeys/:id/progress
========================================================= */

router.get(
  "/journeys/:id/progress",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message: "Organization not found.",
        });
      }

      const progress =
        await getOnboardingJourneyProgress(
          organizationId,
          req.params.id
        );

      return res.status(200).json({
        progress,
      });
    } catch (error) {
      console.error(
        "[Onboarding] Failed to get progress:",
        error
      );

      return res.status(500).json({
        message:
          error?.message ||
          "Failed to calculate onboarding progress.",
      });
    }
  }
);

/* =========================================================
   EXPORT ROUTER
========================================================= */

export default router;