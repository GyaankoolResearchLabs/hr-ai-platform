import "dotenv/config";

import express from "express";
import cors from "cors";
import morgan from "morgan";

/* =========================================================
   ROUTES
========================================================= */

import employeeDocumentsRouter from "./routes/employeeDocuments.js";
import organizationsRouter from "./routes/organizations.js";
import employeesRouter from "./routes/employees.js";
import subscriptionRouter from "./routes/subscription.js";
import aiRouter from "./routes/ai.js";
import documentsRouter from "./routes/documents.js";
import attendanceLeaveRouter from "./routes/attendanceLeave.js";
import workflowsRouter from "./routes/workflows.js";
import approvalsRouter from "./routes/approvals.js";
import escalationsRouter from "./routes/escalations.js";
import hrRequestsRouter from "./routes/hrRequests.js";
import recruitmentRouter from "./routes/recruitment.js";
import jobDescriptionRouter from "./routes/jobDescription.js";
import interviewScorecardsRouter from "./routes/interviewScorecards.js";
import hiringPipelineRouter from "./routes/hiringPipeline.js";
import hrCasesRoutes from "./routes/hrCases.js";
import employeeSelfServiceRoutes from "./routes/employeeSelfService.js";
import onboardingRoutes from "./routes/onboarding.js";
import buddyMentorRouter from "./routes/buddyMentor.js";
import goalOkrRouter from "./routes/goalOkr.js";
import reviewCyclesRouter from "./routes/reviewCycles.js";
import continuousFeedbackRouter from "./routes/continuousFeedback.js";
import learningRouter from "./routes/learning.js";
import learningCourseRoutes from "./routes/learningCourseRoutes.js";
import trainingComplianceRoutes from "./routes/trainingCompliance.js";
import headcountPlanningRouter from "./routes/headcountPlanning.js";
import attritionForecastingRoutes from "./routes/attritionForecasting.js";
import orgChartRouter from "./routes/orgChart.js";
import pulseSurveysRouter from "./routes/pulseSurveys.js";
import workforceMetricsRouter from "./routes/workforceMetrics.js";
import recognitionRewardsRouter from "./routes/recognitionRewards.js";
import workforceQueryRouter from "./routes/workforceQuery.js";
/* =========================================================
   SERVICES
========================================================= */

import {
  processAutomaticEscalations,
} from "./services/escalationService.js";

/* =========================================================
   APP CONFIGURATION
========================================================= */

const app = express();

const PORT =
  process.env.PORT || 4000;

const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN ||
  "http://localhost:5173";

/* =========================================================
   GLOBAL MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  }),
);

app.use(
  express.json(),
);

app.use(
  express.urlencoded({
    extended: true,
  }),
);

app.use(
  morgan("dev"),
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      status: "ok",
      service:
        "hr-ai-platform-server",
    });
  },
);

/* =========================================================
   API ROUTES
========================================================= */

/* ---------------------------------------------------------
   ORGANIZATIONS
--------------------------------------------------------- */

app.use(
  "/api/organizations",
  organizationsRouter,
);

/* ---------------------------------------------------------
   EMPLOYEES
--------------------------------------------------------- */

app.use(
  "/api/employees",
  employeesRouter,
);

/* ---------------------------------------------------------
   SUBSCRIPTION
--------------------------------------------------------- */

app.use(
  "/api/subscription",
  subscriptionRouter,
);

/* ---------------------------------------------------------
   AI
--------------------------------------------------------- */

app.use(
  "/api/ai",
  aiRouter,
);
app.use(
  "/api/ai/job-description",
  jobDescriptionRouter,
);


/* ---------------------------------------------------------
   GENERAL DOCUMENTS
--------------------------------------------------------- */

app.use(
  "/api/documents",
  documentsRouter,
);

/* ---------------------------------------------------------
   EMPLOYEE DOCUMENT VERIFICATION
--------------------------------------------------------- */

app.use(
  "/api/documents/employee-documents",
  employeeDocumentsRouter,
);

/* ---------------------------------------------------------
   ATTENDANCE & LEAVE
--------------------------------------------------------- */

app.use(
  "/api/attendance-leave",
  attendanceLeaveRouter,
);

/* ---------------------------------------------------------
   HR WORKFLOWS
--------------------------------------------------------- */

app.use(
  "/api/workflows",
  workflowsRouter,
);

/* ---------------------------------------------------------
   HR APPROVAL ROUTING
--------------------------------------------------------- */

app.use(
  "/api/approvals",
  approvalsRouter,
);

/* ---------------------------------------------------------
   RECRUITMENT
---------------------------------------------------------

   POST
   /api/recruitment/screen

   Upload and process a candidate resume.
--------------------------------------------------------- */

app.use(
  "/api/recruitment",
  recruitmentRouter,
);

app.use(
  "/api/interview-scorecards",
  interviewScorecardsRouter,
);

app.use(
  "/api/hiring-pipeline",
  hiringPipelineRouter
);

app.use(
  "/api/hr-cases",
  hrCasesRoutes
);

app.use(
  "/api/employee-self-service",
  employeeSelfServiceRoutes
);

app.use(
  "/api/onboarding",
  onboardingRoutes
);

app.use(
  "/api/buddy-mentor",
  buddyMentorRouter
);

app.use(
  "/api/goal-okr",
  goalOkrRouter,
);

app.use(
  "/api/review-cycles",
  reviewCyclesRouter,
);

app.use(
  "/api/learning",
  learningRouter,
);

app.use("/api/learning", learningCourseRoutes);
app.use(
  "/api/training-compliance",
  trainingComplianceRoutes
);

app.use(
  "/api/headcount-planning",
  headcountPlanningRouter,
);

app.use(
  "/api/attrition-forecasting",
  attritionForecastingRoutes,
);

app.use(
  "/api/org-chart",
  orgChartRouter,
);

app.use(
  "/api/pulse-surveys",
  pulseSurveysRouter,
);
/* ---------------------------------------------------------
   WORKFORCE METRICS
--------------------------------------------------------- */

app.use(
  "/api/workforce-metrics",
  workforceMetricsRouter,
);
/* ---------------------------------------------------------
   RECOGNITION & REWARDS WALL
--------------------------------------------------------- */

app.use(
  "/api/recognition-rewards",
  recognitionRewardsRouter,
);


/* ---------------------------------------------------------
   CONTINUOUS FEEDBACK
--------------------------------------------------------- */

app.use(
  "/api/continuous-feedback",
  continuousFeedbackRouter,
);

app.use(
  "/api/learning",
  learningRouter,
);

app.use(
  "/api/workforce-query",
  workforceQueryRouter
);
/* ---------------------------------------------------------
   HR ESCALATION MANAGER
---------------------------------------------------------

   GET
   /api/escalations/overdue

   GET
   /api/escalations

   POST
   /api/escalations/:requestId/escalate

   POST
   /api/escalations/:id/acknowledge

   POST
   /api/escalations/:id/resolve

--------------------------------------------------------- */

app.use(
  "/api/escalations",
  escalationsRouter,
);

/* ---------------------------------------------------------
   HR REQUEST INTAKE
---------------------------------------------------------

   GET
   /api/hr-requests

   GET
   /api/hr-requests/:id

   POST
   /api/hr-requests

   PATCH
   /api/hr-requests/:id

   POST
   /api/hr-requests/:id/resolve

   POST
   /api/hr-requests/:id/cancel

   DELETE
   /api/hr-requests/:id

--------------------------------------------------------- */

app.use(
  "/api/hr-requests",
  hrRequestsRouter,
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use(
  (req, res) => {
    res.status(404).json({
      message:
        "API route not found",

      path:
        req.originalUrl,
    });
  },
);

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (err, req, res, next) => {
    console.error(
      "Unhandled server error:",
      err,
    );

    /* -----------------------------------------------------
       MULTER ERRORS
    ----------------------------------------------------- */

    if (
      err?.name ===
      "MulterError"
    ) {
      return res.status(400).json({
        message:
          err.message ||
          "File upload failed",
      });
    }

    /* -----------------------------------------------------
       FILE VALIDATION ERRORS
    ----------------------------------------------------- */

    if (
      err?.message?.includes(
        "Only JPG, PNG, WEBP and PDF files are allowed",
      )
    ) {
      return res.status(400).json({
        message:
          err.message,
      });
    }

    if (
      err?.message?.includes(
        "Only PDF, DOC and DOCX resume files are allowed",
      )
    ) {
      return res.status(400).json({
        message:
          err.message,
      });
    }

    /* -----------------------------------------------------
       GENERIC ERROR
    ----------------------------------------------------- */

    return res.status(500).json({
      message:
        err?.message ||
        "Unexpected server error",
    });
  },
);

/* =========================================================
   AUTOMATIC ESCALATION MONITOR
========================================================= */

async function runInitialEscalationCheck() {
  try {
    await processAutomaticEscalations();
  } catch (error) {
    console.error(
      "[Escalation] Initial automatic escalation check failed:",
      error,
    );
  }
}

/* =========================================================
   START ESCALATION MONITOR
========================================================= */

function startEscalationMonitor() {
  const ESCALATION_CHECK_INTERVAL =
    60 * 1000;

  setInterval(
    async () => {
      try {
        await processAutomaticEscalations();
      } catch (error) {
        console.error(
          "[Escalation] Automatic escalation monitor failed:",
          error,
        );
      }
    },
    ESCALATION_CHECK_INTERVAL,
  );

  console.log(
    "[Escalation] Automatic escalation monitor started.",
  );

  console.log(
    "[Escalation] Checking every 60 seconds.",
  );
}

/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  async () => {
    console.log(
      `HR AI Platform API listening on http://localhost:${PORT}`,
    );

    /* -----------------------------------------------------
       INITIAL ESCALATION CHECK
    ----------------------------------------------------- */

    await runInitialEscalationCheck();

    /* -----------------------------------------------------
       START CONTINUOUS ESCALATION MONITOR
    ----------------------------------------------------- */

    startEscalationMonitor();
  },
);