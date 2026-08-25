import express from "express";

import { requireAuth } from "../middleware/auth.js";

import {
  getPolicies,
  getPolicyById,
  createPolicy,
  updatePolicy,
  createPolicyVersion,
  publishPolicyVersion,
  archivePolicyVersion,
  getPolicyAssignments,
  assignPolicy,
  acknowledgePolicyAssignment,
  getPolicyEvents,
} from "../services/policyService.js";

const router = express.Router();

/* =========================================================
   ORGANIZATION HELPER
========================================================= */

function getOrganizationId(req) {
  return (
    req.organization?.id ||
    req.organization?.organization_id ||
    req.user?.organization_id ||
    req.user?.organizationId ||
    null
  );
}

/* =========================================================
   GET POLICIES
   GET /api/policies
========================================================= */

router.get(
  "/",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const policies =
        await getPolicies({
          organizationId,

          status:
            req.query.status ||
            "all",

          search:
            req.query.search ||
            "",

          category:
            req.query.category ||
            "",
        });

      return res.status(200).json({
        policies,
      });
    } catch (error) {
      console.error(
        "[Policy] GET ALL failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to load policies.",
      });
    }
  },
);

/* =========================================================
   CREATE POLICY
   POST /api/policies
========================================================= */

router.post(
  "/",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const {
        policyCode,
        policy_code,
        title,
        category,
        description,
        content,
      } = req.body || {};

      const policy =
        await createPolicy({
          organizationId,

          createdBy:
            req.user?.id ||
            null,

          policyCode:
            policyCode ??
            policy_code,

          title,

          category,

          description,

          content,
        });

      return res.status(201).json({
        message:
          "Policy created successfully.",

        policy,
      });
    } catch (error) {
      console.error(
        "[Policy] CREATE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to create policy.",
      });
    }
  },
);

/* =========================================================
   GET SINGLE POLICY
   GET /api/policies/:id
========================================================= */

router.get(
  "/:id",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const policy =
        await getPolicyById(
          organizationId,
          req.params.id,
        );

      return res.status(200).json({
        policy,
      });
    } catch (error) {
      console.error(
        "[Policy] GET SINGLE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to load policy.",
      });
    }
  },
);

/* =========================================================
   UPDATE POLICY
   PATCH /api/policies/:id
========================================================= */

router.patch(
  "/:id",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const policy =
        await updatePolicy(
          organizationId,
          req.params.id,
          req.body || {},
        );

      return res.status(200).json({
        message:
          "Policy updated successfully.",

        policy,
      });
    } catch (error) {
      console.error(
        "[Policy] UPDATE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to update policy.",
      });
    }
  },
);

/* =========================================================
   CREATE VERSION
   POST /api/policies/:id/versions
========================================================= */

router.post(
  "/:id/versions",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const {
        content,
        sourceUrl,
        source_url,
        effectiveDate,
        effective_date,
      } = req.body || {};

      const policy =
        await createPolicyVersion({
          organizationId,

          policyId:
            req.params.id,

          createdBy:
            req.user?.id ||
            null,

          content,

          sourceUrl:
            sourceUrl ??
            source_url,

          effectiveDate:
            effectiveDate ??
            effective_date,
        });

      return res.status(201).json({
        message:
          "Policy version created successfully.",

        policy,
      });
    } catch (error) {
      console.error(
        "[Policy] CREATE VERSION failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to create policy version.",
      });
    }
  },
);

/* =========================================================
   PUBLISH VERSION
   POST /api/policies/:id/versions/:versionId/publish
========================================================= */

router.post(
  "/:id/versions/:versionId/publish",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const policy =
        await publishPolicyVersion({
          organizationId,

          policyId:
            req.params.id,

          versionId:
            req.params.versionId,

          publishedBy:
            req.user?.id ||
            null,
        });

      return res.status(200).json({
        message:
          "Policy version published successfully.",

        policy,
      });
    } catch (error) {
      console.error(
        "[Policy] PUBLISH VERSION failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to publish policy version.",
      });
    }
  },
);

/* =========================================================
   ARCHIVE VERSION
   POST /api/policies/:id/versions/:versionId/archive
========================================================= */

router.post(
  "/:id/versions/:versionId/archive",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const policy =
        await archivePolicyVersion({
          organizationId,

          policyId:
            req.params.id,

          versionId:
            req.params.versionId,

          performedBy:
            req.user?.id ||
            null,
        });

      return res.status(200).json({
        message:
          "Policy version archived successfully.",

        policy,
      });
    } catch (error) {
      console.error(
        "[Policy] ARCHIVE VERSION failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to archive policy version.",
      });
    }
  },
);

/* =========================================================
   GET ASSIGNMENTS
   GET /api/policies/:id/assignments
========================================================= */

router.get(
  "/:id/assignments",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const assignments =
        await getPolicyAssignments({
          organizationId,

          policyId:
            req.params.id,

          status:
            req.query.status ||
            "all",

          employeeId:
            req.query.employeeId ||
            req.query.employee_id ||
            null,
        });

      return res.status(200).json({
        assignments,
      });
    } catch (error) {
      console.error(
        "[Policy] GET ASSIGNMENTS failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to load policy assignments.",
      });
    }
  },
);

/* =========================================================
   ASSIGN POLICY
   POST /api/policies/:id/assignments
========================================================= */

router.post(
  "/:id/assignments",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const {
        policyVersionId,
        policy_version_id,
        employeeId,
        employee_id,
        dueDate,
        due_date,
      } = req.body || {};

      const assignment =
        await assignPolicy({
          organizationId,

          policyId:
            req.params.id,

          policyVersionId:
            policyVersionId ??
            policy_version_id,

          employeeId:
            employeeId ??
            employee_id,

          dueDate:
            dueDate ??
            due_date,

          performedBy:
            req.user?.id ||
            null,
        });

      return res.status(201).json({
        message:
          "Policy assigned successfully.",

        assignment,
      });
    } catch (error) {
      console.error(
        "[Policy] ASSIGN failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to assign policy.",
      });
    }
  },
);

/* =========================================================
   ACKNOWLEDGE ASSIGNMENT
   PATCH /api/policies/assignments/:assignmentId/acknowledge
========================================================= */

router.patch(
  "/assignments/:assignmentId/acknowledge",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const {
        acknowledgmentNote,
        acknowledgment_note,
      } = req.body || {};

      const assignment =
        await acknowledgePolicyAssignment({
          organizationId,

          assignmentId:
            req.params.assignmentId,

          acknowledgedBy:
            req.user?.id ||
            null,

          acknowledgmentNote:
            acknowledgmentNote ??
            acknowledgment_note,
        });

      return res.status(200).json({
        message:
          "Policy acknowledgment recorded successfully.",

        assignment,
      });
    } catch (error) {
      console.error(
        "[Policy] ACKNOWLEDGE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to record policy acknowledgment.",
      });
    }
  },
);

/* =========================================================
   GET EVENTS
   GET /api/policies/:id/events
========================================================= */

router.get(
  "/:id/events",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const events =
        await getPolicyEvents(
          organizationId,
          req.params.id,
        );

      return res.status(200).json({
        events,
      });
    } catch (error) {
      console.error(
        "[Policy] GET EVENTS failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to load policy history.",
      });
    }
  },
);

export default router;