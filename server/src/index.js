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
import employeeRelationsCasesRoutes from "./routes/employeeRelationsCases.js";
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
import payBandsRouter from "./routes/payBands.js";
import marketBenchmarkingRoutes from "./routes/marketBenchmarking.js";
import compReviewCyclesRouter from "./routes/compReviewCycles.js";
import shiftHolidayRouter from "./routes/shiftHoliday.js";
import investigationsRoutes from "./routes/investigations.js";

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

const PORT = process.env.PORT || 4000;

/*
 * Production frontend:
 *   https://hr-ai-platform.netlify.app
 *
 * Local frontend:
 *   http://localhost:5173
 *   http://localhost:5174
 *
 * CLIENT_ORIGIN is also read from Render environment variables.
 */

const configuredOrigin = String(
  process.env.CLIENT_ORIGIN || "",
)
  .trim()
  .replace(/\/$/, "");

const CLIENT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "https://hr-ai-platform.netlify.app",
  configuredOrigin,
].filter(
  (origin, index, array) =>
    origin && array.indexOf(origin) === index,
);

/* =========================================================
   STARTUP CONFIG LOG
========================================================= */

console.log(
  "[CORS] Allowed origins:",
  CLIENT_ORIGINS,
);

console.log(
  "[CORS] CLIENT_ORIGIN environment:",
  configuredOrigin || "NOT SET",
);

/* =========================================================
   GLOBAL CORS
========================================================= */

app.use(
  cors({
    origin: (origin, callback) => {
      /*
       * Requests such as health checks, curl, Postman,
       * and server-to-server requests may have no Origin.
       */
      if (!origin) {
        console.log(
          "[CORS] Request without Origin header: ALLOWED",
        );

        return callback(null, true);
      }

      const normalizedOrigin = String(origin)
        .trim()
        .replace(/\/$/, "");

      console.log(
        "[CORS] Incoming origin:",
        normalizedOrigin,
      );

      if (
        CLIENT_ORIGINS.includes(
          normalizedOrigin,
        )
      ) {
        console.log(
          "[CORS] Origin allowed:",
          normalizedOrigin,
        );

        return callback(null, true);
      }

      console.error(
        "[CORS] Origin BLOCKED:",
        normalizedOrigin,
      );

      console.error(
        "[CORS] Allowed origins:",
        CLIENT_ORIGINS,
      );

      return callback(
        new Error(
          `CORS blocked origin: ${normalizedOrigin}`,
        ),
        false,
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
      "HEAD",
    ],

    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "Cache-Control",
      "Pragma",
    ],

    exposedHeaders: [
      "Content-Length",
      "Content-Type",
    ],

    optionsSuccessStatus: 204,
  }),
);

/*
 * Explicitly handle preflight requests.
 *
 * This makes OPTIONS requests succeed before they
 * reach authentication middleware inside individual
 * route files.
 */
app.options(
  "*",
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = String(origin)
        .trim()
        .replace(/\/$/, "");

      if (
        CLIENT_ORIGINS.includes(
          normalizedOrigin,
        )
      ) {
        return callback(null, true);
      }

      return callback(
        new Error(
          `CORS blocked origin: ${normalizedOrigin}`,
        ),
        false,
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
      "HEAD",
    ],

    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "Cache-Control",
      "Pragma",
    ],
  }),
);

/* =========================================================
   BODY PARSING
========================================================= */

app.use(
  express.json({
    limit: "10mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  }),
);

/* =========================================================
   LOGGING
========================================================= */

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
      service: "hr-ai-platform-server",
      environment:
        process.env.NODE_ENV || "development",
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
  hiringPipelineRouter,
);

/* ---------------------------------------------------------
   HR CASES
--------------------------------------------------------- */

app.use(
  "/api/hr-cases",
  hrCasesRoutes,
);

/* ---------------------------------------------------------
   EMPLOYEE RELATIONS CASES
--------------------------------------------------------- */

app.use(
  "/api/employee-relations-cases",
  employeeRelationsCasesRoutes,
);

/* ---------------------------------------------------------
   EMPLOYEE SELF SERVICE
--------------------------------------------------------- */

app.use(
  "/api/employee-self-service",
  employeeSelfServiceRoutes,
);

/* ---------------------------------------------------------
   ONBOARDING
--------------------------------------------------------- */

app.use(
  "/api/onboarding",
  onboardingRoutes,
);

/* ---------------------------------------------------------
   BUDDY / MENTOR
--------------------------------------------------------- */

app.use(
  "/api/buddy-mentor",
  buddyMentorRouter,
);

/* ---------------------------------------------------------
   GOALS / OKR
--------------------------------------------------------- */

app.use(
  "/api/goal-okr",
  goalOkrRouter,
);

/* ---------------------------------------------------------
   REVIEW CYCLES
--------------------------------------------------------- */

app.use(
  "/api/review-cycles",
  reviewCyclesRouter,
);

/* ---------------------------------------------------------
   LEARNING
--------------------------------------------------------- */

app.use(
  "/api/learning",
  learningRouter,
);

/*
 * Course generation endpoints.
 * This router has its own authentication guard.
 */

app.use(
  "/api/learning",
  learningCourseRoutes,
);

/* ---------------------------------------------------------
   TRAINING COMPLIANCE
--------------------------------------------------------- */

app.use(
  "/api/training-compliance",
  trainingComplianceRoutes,
);

/* ---------------------------------------------------------
   WORKFORCE PLANNING
--------------------------------------------------------- */

app.use(
  "/api/headcount-planning",
  headcountPlanningRouter,
);

app.use(
  "/api/attrition-forecasting",
  attritionForecastingRoutes,
);

/* ---------------------------------------------------------
   ORGANIZATION CHART
--------------------------------------------------------- */

app.use(
  "/api/org-chart",
  orgChartRouter,
);

/* ---------------------------------------------------------
   PULSE SURVEYS
--------------------------------------------------------- */

app.use(
  "/api/pulse-surveys",
  pulseSurveysRouter,
);

/* ---------------------------------------------------------
   MARKET BENCHMARKING
--------------------------------------------------------- */

app.use(
  "/api/market-benchmarking",
  marketBenchmarkingRoutes,
);

/* ---------------------------------------------------------
   COMPENSATION REVIEW CYCLES
--------------------------------------------------------- */

app.use(
  "/api/comp-review-cycles",
  compReviewCyclesRouter,
);

/* ---------------------------------------------------------
   INVESTIGATION TRACKER
--------------------------------------------------------- */

app.use(
  "/api/investigations",
  investigationsRoutes,
);

/* ---------------------------------------------------------
   WORKFORCE METRICS
--------------------------------------------------------- */

app.use(
  "/api/workforce-metrics",
  workforceMetricsRouter,
);

/* ---------------------------------------------------------
   RECOGNITION & REWARDS
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

/* ---------------------------------------------------------
   WORKFORCE QUERY
--------------------------------------------------------- */

app.use(
  "/api/workforce-query",
  workforceQueryRouter,
);

/* ---------------------------------------------------------
   SHIFT & HOLIDAY CALENDAR
--------------------------------------------------------- */

app.use(
  "/api/shift-holiday",
  shiftHolidayRouter,
);

/* ---------------------------------------------------------
   PAY BANDS
--------------------------------------------------------- */

app.use(
  "/api/pay-bands",
  payBandsRouter,
);

/* ---------------------------------------------------------
   HR ESCALATION MANAGER
--------------------------------------------------------- */

app.use(
  "/api/escalations",
  escalationsRouter,
);

/* ---------------------------------------------------------
   HR REQUEST INTAKE
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
      message: "API route not found",
      path: req.originalUrl,
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

    /*
     * CORS errors
     */
    if (
      err?.message?.startsWith(
        "CORS blocked origin:",
      )
    ) {
      return res.status(403).json({
        message: err.message,
      });
    }

    /*
     * Multer errors
     */
    if (
      err?.name === "MulterError"
    ) {
      return res.status(400).json({
        message:
          err.message ||
          "File upload failed",
      });
    }

    /*
     * File validation errors
     */
    if (
      err?.message?.includes(
        "Only JPG, PNG, WEBP and PDF files are allowed",
      )
    ) {
      return res.status(400).json({
        message: err.message,
      });
    }

    if (
      err?.message?.includes(
        "Only PDF, DOC and DOCX resume files are allowed",
      )
    ) {
      return res.status(400).json({
        message: err.message,
      });
    }

    /*
     * Generic server error
     */
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
  "0.0.0.0",
  async () => {
    console.log(
      `HR AI Platform API listening on port ${PORT}`,
    );

    console.log(
      "[CORS] Production frontend:",
      "https://hr-ai-platform.netlify.app",
    );

    console.log(
      "[CORS] Effective origins:",
      CLIENT_ORIGINS,
    );

    /*
     * Initial escalation check
     */
    await runInitialEscalationCheck();

    /*
     * Continuous escalation monitor
     */
    startEscalationMonitor();
  },
);