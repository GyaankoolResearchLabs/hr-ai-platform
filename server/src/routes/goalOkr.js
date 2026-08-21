import express from "express";

import { requireAuth } from "../middleware/auth.js";

import {
  getGoalsAndOkrs,
  getGoalOrOkr,
  createGoalOrOkr,
  updateGoalOrOkr,
  deleteGoalOrOkr,
} from "../services/goalOkrService.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| AUTHENTICATION
|--------------------------------------------------------------------------
|
| Organization is NEVER taken from the frontend.
|
| requireAuth validates the Supabase session and attaches:
|
| req.user.organization_id
|
| Every Goal/OKR operation is therefore automatically scoped to the
| authenticated user's organization.
|
*/

router.use(requireAuth);

/* =========================================================
   GET ALL GOALS / OKRS

   GET /api/goal-okr
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    if (!organizationId) {
      return res.status(403).json({
        message: "User is not associated with an organization.",
      });
    }

    const goals = await getGoalsAndOkrs(
      organizationId,
    );

    return res.status(200).json({
      goals: goals || [],
    });
  } catch (error) {
    console.error(
      "[GoalOKR] GET failed:",
      error,
    );

    return res.status(
      error?.statusCode || 500,
    ).json({
      message:
        error?.message ||
        "Failed to load goals and OKRs.",
    });
  }
});

/* =========================================================
   GET SINGLE GOAL / OKR

   GET /api/goal-okr/:id
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const organizationId =
      req.user.organization_id;

    if (!organizationId) {
      return res.status(403).json({
        message:
          "User is not associated with an organization.",
      });
    }

    const goal = await getGoalOrOkr(
      organizationId,
      req.params.id,
    );

    return res.status(200).json({
      goal,
    });
  } catch (error) {
    console.error(
      "[GoalOKR] GET single failed:",
      error,
    );

    return res.status(
      error?.statusCode || 500,
    ).json({
      message:
        error?.message ||
        "Failed to load goal.",
    });
  }
});

/* =========================================================
   CREATE GOAL / OKR

   POST /api/goal-okr
========================================================= */

router.post("/", async (req, res) => {
  try {
    const organizationId =
      req.user.organization_id;

    if (!organizationId) {
      return res.status(403).json({
        message:
          "User is not associated with an organization.",
      });
    }

    const {
      employeeId,
      employee_id,
      title,
      description,
      type,
      category,
      startDate,
      start_date,
      dueDate,
      due_date,
      targetValue,
      target_value,
      unit,
      progress,
      status,
    } = req.body || {};

    const finalEmployeeId =
      employeeId || employee_id;

    const finalStartDate =
      startDate ||
      start_date ||
      null;

    const finalDueDate =
      dueDate ||
      due_date ||
      null;

    const finalTargetValue =
      targetValue ??
      target_value ??
      null;

    if (!finalEmployeeId) {
      return res.status(400).json({
        message: "Employee is required.",
      });
    }

    if (!title?.trim()) {
      return res.status(400).json({
        message: "Goal title is required.",
      });
    }

    if (
      finalStartDate &&
      finalDueDate &&
      finalDueDate < finalStartDate
    ) {
      return res.status(400).json({
        message:
          "Due date cannot be before the start date.",
      });
    }

    let finalProgress = Number(
      progress ?? 0,
    );

    if (!Number.isFinite(finalProgress)) {
      finalProgress = 0;
    }

    finalProgress = Math.min(
      100,
      Math.max(0, finalProgress),
    );

    let finalStatus =
      status || "not_started";

    if (finalProgress === 100) {
      finalStatus = "completed";
    } else if (
      finalProgress > 0 &&
      finalStatus === "not_started"
    ) {
      finalStatus = "in_progress";
    }

    const goal =
      await createGoalOrOkr({
        organizationId,

        employeeId:
          finalEmployeeId,

        title:
          title.trim(),

        description:
          description?.trim() || null,

        type:
          type || "goal",

        category:
          category?.trim() || null,

        startDate:
          finalStartDate,

        dueDate:
          finalDueDate,

        targetValue:
          finalTargetValue === "" ||
          finalTargetValue === null ||
          finalTargetValue === undefined
            ? null
            : Number(finalTargetValue),

        unit:
          unit?.trim() || null,

        progress:
          finalProgress,

        status:
          finalStatus,
      });

    return res.status(201).json({
      message:
        "Goal created successfully.",

      goal,
    });
  } catch (error) {
    console.error(
      "[GoalOKR] CREATE failed:",
      error,
    );

    return res.status(
      error?.statusCode || 500,
    ).json({
      message:
        error?.message ||
        "Failed to create goal.",
    });
  }
});

/* =========================================================
   UPDATE GOAL / OKR

   PATCH /api/goal-okr/:id
========================================================= */

router.patch(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        req.user.organization_id;

      if (!organizationId) {
        return res.status(403).json({
          message:
            "User is not associated with an organization.",
        });
      }

      const body = req.body || {};

      const updates = {};

      /* -----------------------------------------------------
         EMPLOYEE
      ----------------------------------------------------- */

      if (
        Object.prototype.hasOwnProperty.call(
          body,
          "employeeId",
        )
      ) {
        updates.employee_id =
          body.employeeId;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          body,
          "employee_id",
        )
      ) {
        updates.employee_id =
          body.employee_id;
      }

      /* -----------------------------------------------------
         FIELD MAPPING
      ----------------------------------------------------- */

      const fieldMap = {
        title: "title",
        description: "description",
        type: "type",
        category: "category",

        startDate: "start_date",
        start_date: "start_date",

        dueDate: "due_date",
        due_date: "due_date",

        targetValue: "target_value",
        target_value: "target_value",

        unit: "unit",
        progress: "progress",
        status: "status",
      };

      for (
        const [
          requestField,
          databaseField,
        ] of Object.entries(fieldMap)
      ) {
        if (
          Object.prototype.hasOwnProperty.call(
            body,
            requestField,
          )
        ) {
          updates[databaseField] =
            body[requestField];
        }
      }

      /* -----------------------------------------------------
         TITLE
      ----------------------------------------------------- */

      if (
        updates.title !== undefined
      ) {
        updates.title =
          String(
            updates.title,
          ).trim();

        if (!updates.title) {
          return res.status(400).json({
            message:
              "Goal title cannot be empty.",
          });
        }
      }

      /* -----------------------------------------------------
         DESCRIPTION
      ----------------------------------------------------- */

      if (
        updates.description !==
        undefined
      ) {
        updates.description =
          updates.description
            ? String(
                updates.description,
              ).trim()
            : null;
      }

      /* -----------------------------------------------------
         CATEGORY
      ----------------------------------------------------- */

      if (
        updates.category !==
        undefined
      ) {
        updates.category =
          updates.category
            ? String(
                updates.category,
              ).trim()
            : null;
      }

      /* -----------------------------------------------------
         UNIT
      ----------------------------------------------------- */

      if (
        updates.unit !== undefined
      ) {
        updates.unit =
          updates.unit
            ? String(
                updates.unit,
              ).trim()
            : null;
      }

      /* -----------------------------------------------------
         PROGRESS
      ----------------------------------------------------- */

      if (
        updates.progress !==
        undefined
      ) {
        let nextProgress =
          Number(
            updates.progress,
          );

        if (
          !Number.isFinite(
            nextProgress,
          )
        ) {
          nextProgress = 0;
        }

        updates.progress =
          Math.min(
            100,
            Math.max(
              0,
              nextProgress,
            ),
          );

        if (
          updates.progress ===
          100
        ) {
          updates.status =
            "completed";
        } else if (
          updates.progress > 0 &&
          !updates.status
        ) {
          updates.status =
            "in_progress";
        }
      }

      /* -----------------------------------------------------
         TARGET VALUE
      ----------------------------------------------------- */

      if (
        updates.target_value !==
          undefined &&
        updates.target_value !==
          null &&
        updates.target_value !==
          ""
      ) {
        const targetValue =
          Number(
            updates.target_value,
          );

        if (
          !Number.isFinite(
            targetValue,
          )
        ) {
          return res.status(400).json({
            message:
              "Target value must be a valid number.",
          });
        }

        updates.target_value =
          targetValue;
      }

      /* -----------------------------------------------------
         DATE VALIDATION
      ----------------------------------------------------- */

      if (
        updates.start_date !==
          undefined &&
        updates.due_date !==
          undefined &&
        updates.start_date &&
        updates.due_date &&
        updates.due_date <
          updates.start_date
      ) {
        return res.status(400).json({
          message:
            "Due date cannot be before the start date.",
        });
      }

      /* -----------------------------------------------------
         NO UPDATES
      ----------------------------------------------------- */

      if (
        Object.keys(updates)
          .length === 0
      ) {
        return res.status(400).json({
          message:
            "No valid goal updates were provided.",
        });
      }

      const goal =
        await updateGoalOrOkr(
          organizationId,
          req.params.id,
          updates,
        );

      return res.status(200).json({
        message:
          "Goal updated successfully.",

        goal,
      });
    } catch (error) {
      console.error(
        "[GoalOKR] UPDATE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to update goal.",
      });
    }
  },
);

/* =========================================================
   DELETE GOAL / OKR

   DELETE /api/goal-okr/:id
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        req.user.organization_id;

      if (!organizationId) {
        return res.status(403).json({
          message:
            "User is not associated with an organization.",
        });
      }

      await deleteGoalOrOkr(
        organizationId,
        req.params.id,
      );

      return res.status(200).json({
        message:
          "Goal deleted successfully.",
      });
    } catch (error) {
      console.error(
        "[GoalOKR] DELETE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to delete goal.",
      });
    }
  },
);

export default router;