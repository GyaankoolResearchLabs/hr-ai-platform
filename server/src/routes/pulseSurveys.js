import express from "express";

import { requireAuth } from "../middleware/auth.js";

import {
  getPulseSurveys,
  getPulseSurveyById,
  createPulseSurvey,
  updatePulseSurvey,
  publishPulseSurvey,
  closePulseSurvey,
  submitPulseSurveyResponse,
  getPulseSurveyResults,
} from "../services/pulseSurveyService.js";

const router = express.Router();

/* =========================================================
   ORGANIZATION
========================================================= */

function getOrganizationId(req) {
  return (
    req.user?.organization_id ||
    req.user?.organizationId ||
    null
  );
}

/* =========================================================
   GET ALL SURVEYS

   GET /api/pulse-surveys
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

      const surveys =
        await getPulseSurveys({
          organizationId,
          status:
            req.query.status || null,
        });

      return res.status(200).json({
        surveys,
      });
    } catch (error) {
      console.error(
        "[PulseSurvey] GET failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to load pulse surveys.",
        });
    }
  },
);

/* =========================================================
   GET SINGLE SURVEY

   GET /api/pulse-surveys/:id
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

      const survey =
        await getPulseSurveyById(
          organizationId,
          req.params.id,
        );

      return res.status(200).json({
        survey,
      });
    } catch (error) {
      console.error(
        "[PulseSurvey] GET SINGLE failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to load pulse survey.",
        });
    }
  },
);

/* =========================================================
   CREATE SURVEY

   POST /api/pulse-surveys
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
        title,
        description,
        isAnonymous,
        is_anonymous,
        startsAt,
        starts_at,
        endsAt,
        ends_at,
        questions,
      } = req.body || {};

      const survey =
        await createPulseSurvey({
          organizationId,

          createdByUserId:
            req.user.id,

          title,

          description,

          isAnonymous:
            isAnonymous ??
            is_anonymous ??
            true,

          startsAt:
            startsAt ??
            starts_at ??
            null,

          endsAt:
            endsAt ??
            ends_at ??
            null,

          questions,
        });

      return res.status(201).json({
        message:
          "Pulse survey created successfully.",
        survey,
      });
    } catch (error) {
      console.error(
        "[PulseSurvey] CREATE failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to create pulse survey.",
        });
    }
  },
);

/* =========================================================
   UPDATE SURVEY

   PATCH /api/pulse-surveys/:id
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

      const survey =
        await updatePulseSurvey(
          organizationId,
          req.params.id,
          req.body || {},
        );

      return res.status(200).json({
        message:
          "Pulse survey updated successfully.",
        survey,
      });
    } catch (error) {
      console.error(
        "[PulseSurvey] UPDATE failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to update pulse survey.",
        });
    }
  },
);

/* =========================================================
   PUBLISH SURVEY

   POST /api/pulse-surveys/:id/publish
========================================================= */

router.post(
  "/:id/publish",
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

      const survey =
        await publishPulseSurvey(
          organizationId,
          req.params.id,
        );

      return res.status(200).json({
        message:
          "Pulse survey published successfully.",
        survey,
      });
    } catch (error) {
      console.error(
        "[PulseSurvey] PUBLISH failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to publish pulse survey.",
        });
    }
  },
);

/* =========================================================
   CLOSE SURVEY

   POST /api/pulse-surveys/:id/close
========================================================= */

router.post(
  "/:id/close",
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

      const survey =
        await closePulseSurvey(
          organizationId,
          req.params.id,
        );

      return res.status(200).json({
        message:
          "Pulse survey closed successfully.",
        survey,
      });
    } catch (error) {
      console.error(
        "[PulseSurvey] CLOSE failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to close pulse survey.",
        });
    }
  },
);

/* =========================================================
   SUBMIT RESPONSE

   POST /api/pulse-surveys/:id/responses
========================================================= */

router.post(
  "/:id/responses",
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
        employeeId,
        employee_id,
        answers,
      } = req.body || {};

      const result =
        await submitPulseSurveyResponse({
          organizationId,

          surveyId:
            req.params.id,

          employeeId:
            employeeId ||
            employee_id ||
            null,

          answers,
        });

      return res.status(201).json({
        message:
          "Survey response submitted successfully.",
        ...result,
      });
    } catch (error) {
      console.error(
        "[PulseSurvey] RESPONSE failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to submit survey response.",
        });
    }
  },
);

/* =========================================================
   RESULTS

   GET /api/pulse-surveys/:id/results
========================================================= */

router.get(
  "/:id/results",
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

      const results =
        await getPulseSurveyResults(
          organizationId,
          req.params.id,
        );

      return res.status(200).json({
        results,
      });
    } catch (error) {
      console.error(
        "[PulseSurvey] RESULTS failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to load survey results.",
        });
    }
  },
);

export default router;