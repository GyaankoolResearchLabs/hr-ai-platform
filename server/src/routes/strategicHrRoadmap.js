import express from "express";
import { requireAuth } from "../middleware/auth.js";

import {
  createAuditLog,
} from "../services/auditLogService.js";

import {
  getStrategicRoadmapItems,
  getStrategicRoadmapItem,
  createStrategicRoadmapItem,
  updateStrategicRoadmapItem,
  deleteStrategicRoadmapItem,
} from "../services/strategicHrRoadmapService.js";

const router = express.Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   AUDIT HELPER
========================================================= */

async function auditStrategicRoadmapAction({
  req,
  action,
  item = null,
  description,
  status = "success",
  metadata = {},
}) {
  try {
    await createAuditLog({
      organizationId:
        req.user.organization_id,

      userId:
        req.user.id,

      action,

      resourceType:
        "strategic_hr_roadmap",

      resourceId:
        item?.id || null,

      resourceName:
        item?.title || null,

      description,

      status,

      req,

      metadata,
    });
  } catch (error) {
    console.error(
      "[Strategic HR Roadmap] Audit logging failed:",
      error,
    );
  }
}

/* =========================================================
   GET ALL ROADMAP ITEMS
   GET /api/strategic-hr-roadmap
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId =
      req.user.organization_id;

    if (!organizationId) {
      return res.status(403).json({
        message:
          "User is not associated with an organization.",
      });
    }

    const items =
      await getStrategicRoadmapItems(
        organizationId,
      );

    await auditStrategicRoadmapAction({
      req,

      action:
        "strategic_roadmap.list",

      description:
        `Viewed strategic HR roadmap containing ${(items || []).length} priorities.`,

      metadata: {
        priority_count:
          (items || []).length,
      },
    });

    return res.status(200).json({
      items: items || [],
    });
  } catch (error) {
    console.error(
      "[Strategic HR Roadmap] GET ALL failed:",
      error,
    );

    return res
      .status(error?.statusCode || 500)
      .json({
        message:
          error?.message ||
          "Failed to load strategic HR roadmap.",
      });
  }
});

/* =========================================================
   GET SINGLE ROADMAP ITEM
   GET /api/strategic-hr-roadmap/:id
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

    const item =
      await getStrategicRoadmapItem(
        organizationId,
        req.params.id,
      );

    await auditStrategicRoadmapAction({
      req,

      action:
        "strategic_roadmap.view",

      item,

      description:
        `Viewed strategic HR priority "${item.title}".`,
    });

    return res.status(200).json({
      item,
    });
  } catch (error) {
    console.error(
      "[Strategic HR Roadmap] GET SINGLE failed:",
      error,
    );

    return res
      .status(error?.statusCode || 500)
      .json({
        message:
          error?.message ||
          "Failed to load strategic HR priority.",
      });
  }
});

/* =========================================================
   CREATE ROADMAP ITEM
   POST /api/strategic-hr-roadmap
========================================================= */

router.post("/", async (req, res) => {
  try {
    const organizationId =
      req.user.organization_id;

    const userId =
      req.user.id;

    if (!organizationId) {
      return res.status(403).json({
        message:
          "User is not associated with an organization.",
      });
    }

    const body =
      req.body || {};

    const item =
      await createStrategicRoadmapItem({
        organizationId,

        userId,

        ownerEmployeeId:
          body.ownerEmployeeId ??
          body.owner_employee_id ??
          null,

        title:
          body.title,

        description:
          body.description,

        businessOutcome:
          body.businessOutcome ??
          body.business_outcome,

        kpiName:
          body.kpiName ??
          body.kpi_name,

        baselineValue:
          body.baselineValue ??
          body.baseline_value,

        targetValue:
          body.targetValue ??
          body.target_value,

        unit:
          body.unit,

        priority:
          body.priority,

        status:
          body.status,

        progress:
          body.progress,

        startDate:
          body.startDate ??
          body.start_date,

        targetDate:
          body.targetDate ??
          body.target_date,

        notes:
          body.notes,
      });

    await auditStrategicRoadmapAction({
      req,

      action:
        "strategic_roadmap.create",

      item,

      description:
        `Created strategic HR priority "${item.title}".`,

      metadata: {
        business_outcome:
          item.business_outcome,

        kpi_name:
          item.kpi_name,

        priority:
          item.priority,

        status:
          item.status,
      },
    });

    return res.status(201).json({
      message:
        "Strategic HR priority created successfully.",

      item,
    });
  } catch (error) {
    console.error(
      "[Strategic HR Roadmap] CREATE failed:",
      error,
    );

    await auditStrategicRoadmapAction({
      req,

      action:
        "strategic_roadmap.create",

      description:
        "Failed to create strategic HR priority.",

      status:
        "failed",

      metadata: {
        error:
          error?.message ||
          "Unknown error",
      },
    });

    return res
      .status(error?.statusCode || 500)
      .json({
        message:
          error?.message ||
          "Failed to create strategic HR priority.",
      });
  }
});

/* =========================================================
   UPDATE ROADMAP ITEM
   PATCH /api/strategic-hr-roadmap/:id
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

      const item =
        await updateStrategicRoadmapItem(
          organizationId,
          req.params.id,
          req.body || {},
        );

      await auditStrategicRoadmapAction({
        req,

        action:
          "strategic_roadmap.update",

        item,

        description:
          `Updated strategic HR priority "${item.title}".`,

        metadata: {
          status:
            item.status,

          progress:
            item.progress,

          priority:
            item.priority,
        },
      });

      return res.status(200).json({
        message:
          "Strategic HR priority updated successfully.",

        item,
      });
    } catch (error) {
      console.error(
        "[Strategic HR Roadmap] UPDATE failed:",
        error,
      );

      await auditStrategicRoadmapAction({
        req,

        action:
          "strategic_roadmap.update",

        description:
          "Failed to update strategic HR priority.",

        status:
          "failed",

        metadata: {
          error:
            error?.message ||
            "Unknown error",

          roadmap_item_id:
            req.params.id,
        },
      });

      return res
        .status(error?.statusCode || 500)
        .json({
          message:
            error?.message ||
            "Failed to update strategic HR priority.",
        });
    }
  },
);

/* =========================================================
   DELETE ROADMAP ITEM
   DELETE /api/strategic-hr-roadmap/:id
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

      const deleted =
        await deleteStrategicRoadmapItem(
          organizationId,
          req.params.id,
        );

      await auditStrategicRoadmapAction({
        req,

        action:
          "strategic_roadmap.delete",

        description:
          `Deleted strategic HR priority "${deleted.title}".`,

        metadata: {
          deleted_id:
            deleted.id,

          deleted_title:
            deleted.title,
        },
      });

      return res.status(200).json({
        message:
          "Strategic HR priority deleted successfully.",

        deleted,
      });
    } catch (error) {
      console.error(
        "[Strategic HR Roadmap] DELETE failed:",
        error,
      );

      await auditStrategicRoadmapAction({
        req,

        action:
          "strategic_roadmap.delete",

        description:
          "Failed to delete strategic HR priority.",

        status:
          "failed",

        metadata: {
          error:
            error?.message ||
            "Unknown error",

          roadmap_item_id:
            req.params.id,
        },
      });

      return res
        .status(error?.statusCode || 500)
        .json({
          message:
            error?.message ||
            "Failed to delete strategic HR priority.",
        });
    }
  },
);

export default router;