/**
 * categories.js
 * -----------------------------------------------------------------------
 * Single source of truth for primary navigation and the problem→solution
 * catalog.
 *
 * Hierarchy:
 *   Category → Subcategory → HR Problem → Tool
 *
 * Tool status:
 *   'planned'        - documented problem, tool not yet built
 *   'in-development' - actively being built
 *   'available'      - live for subscribed organizations
 */

export const CATEGORIES = [
  // =========================================================================
  // 1. ADMINISTRATIVE HR
  // =========================================================================
  {
    id: "administrative-hr",
    name: "Administrative HR",
    icon: "ClipboardList",
    tagline:
      "Core HR operations, records, workflows, and workforce administration",

    subcategories: [
      {
        id: "employee-records",
        name: "Employee Records & Documentation",
        description:
          "Employee master data, records, documentation, and HR documents.",

        problems: [
          {
            id: "records-letter-drafting",
            problem:
              "HR re-drafts the same letters and certificates (offer, experience, address proof) from scratch every time.",

            tool: {
              id: "document-letter-generator",
              name: "Document & Letter Generator",
              tagline:
                "Template-based letters and certificates on demand",
              status: "available",
              route: "/app/tools/document-letter-generator",
            },
          },

          {
            id: "records-data-quality",
            problem:
              "Employee data contains missing, duplicate, invalid, inconsistent, or suspicious records that require manual checking.",

            tool: {
              id: "employee-data-quality-checker",
              name: "Employee Data Quality Checker",
              tagline:
                "Detect missing, duplicate, invalid, and suspicious employee data",
              status: "available",
              route: "/app/tools/employee-data-quality",
            },
          },
        ],
      },

      {
        id: "attendance-leave",
        name: "Attendance & Leave",
        description:
          "Attendance, leave balances, shifts, calendars, and related exceptions.",

        problems: [
          {
            id: "attendance-manual-tracking",
            problem:
              "Attendance and leave balances are tracked manually, leading to disputes and payroll mismatches.",

            tool: {
              id: "attendance-leave-tracker",
              name: "Attendance & Leave Tracker",
              tagline:
                "Automated leave balances tied to workforce records",
              status: "available",
              route: "/app/tools/attendance-leave-tracker",
            },
          },

        {
  id: "attendance-shift-calendars",
  problem:
    "Shift patterns and holiday calendars differ by location with no shared source of truth.",

  tool: {
    id: "shift-holiday-manager",
    name: "Shift & Holiday Calendar Manager",
    tagline:
      "Location-aware shift and holiday scheduling",
    status: "available",
    route: "/app/tools/shift-holiday-calendar",
  },
},

          {
            id: "attendance-anomalies",
            problem:
              "Attendance records can contain unusual patterns, missing punches, duplicate entries, or unexplained exceptions that require manual investigation.",

            tool: {
              id: "attendance-anomaly-detector",
              name: "Attendance Anomaly Detector",
  tagline: "Find unusual attendance records that require human review",
  status: "available",
  route: "/app/tools/attendance-anomaly-detector",
            },
          },

          {
            id: "leave-exceptions",
            problem:
              "Leave requests can conflict with balances, policies, dates, or employee records and require manual checking.",

            tool: {
              id: "leave-exception-analyzer",
              name: "Leave Exception Analyzer",
              tagline:
                "Identify leave requests that need HR review",
              status: "available",
              route: "/app/tools/leave-exception-analyzer",
            },
          },
        ],
      },

      {
        id: "documents-workflows",
        name: "Documents & HR Workflows",
        description:
          "Document verification, missing documents, workflows, approvals, reminders, and exceptions.",

        problems: [
          {
  id: "documents-verification",
  problem:
    "HR must manually compare employee documents against employee records to identify missing or inconsistent information.",

  tool: {
    id: "document-verification-assistant",
    name: "Document Verification Assistant",
    tagline:
      "Compare HR documents with employee records",
    status: "available",
    route: "/app/tools/document-verification-assistant",
  },
},

          {
  id: "documents-missing",
  problem:
    "Missing employee documents are often discovered manually during audits or when a process requires them.",

  tool: {
    id: "missing-document-detector",
    name: "Missing Document Detector",
    tagline:
      "Identify employees with incomplete required documentation",
    status: "available",
    route: "/app/tools/missing-document-detector",
  },
},

          {
            id: "documents-expiry",
            problem:
              "HR manually tracks document expiry dates and can miss upcoming renewals.",

            tool: {
              id: "document-expiry-monitor",
              name: "Document Expiry Monitor",
              tagline:
               "Track upcoming employee document expirations",
              status: "available",
              route: "/app/tools/document-expiry-monitor",
            },

          },

         {
  id: "workflow-design",
  problem:
    "HR workflows and approval processes are manually designed and inconsistently executed across teams.",

  tool: {
    id: "hr-workflow-assistant",
    name: "HR Workflow Assistant",
    tagline:
      "Create structured HR workflows from real processes",
    status: "available",
    route: "/app/tools/hr-workflow-assistant",
  },
},

          {
            id: "workflow-approvals",
            problem:
              "HR approvals depend heavily on email and manual follow-up, making ownership and status difficult to track.",

            tool: {
              id: "approval-routing-tool",
              name: "HR Approval Routing",
              tagline:
                "Route HR approvals to the right people automatically",
              status: "available",
route: "/app/tools/approval-routing",
            },
          },

          {
            id: "workflow-escalations",
            problem:
              "Overdue HR requests and approvals require manual reminders and escalation.",

          tool: {
  id: "hr-escalation-manager",

  name: "HR Escalation Manager",

  tagline:
    "Automatically identify and escalate overdue HR actions",

  status: "available",

  route: "/app/tools/hr-escalation-manager",
},
          },
        ],
      },

      {
        id: "hr-requests",
        name: "HR Requests",
        description:
          "Employee request intake, classification, routing, tracking, and support.",

        problems: [
         {
  id: "requests-unstructured-intake",
  problem:
    "Employee HR requests arrive through email, chat, and other channels without a consistent intake process.",

  tool: {
    id: "hr-request-intake",
    name: "HR Request Intake",
    tagline:
      "Capture employee HR requests in one structured workflow",
    status: "available",
    route: "/app/tools/hr-request-intake",
  },
},
{
  id: "requests-classification",
  problem:
    "HR teams manually read incoming requests to determine their category, urgency, and responsible team.",
  tool: {
    id: "hr-request-router",
    name: "HR Request Router",
    tagline:
      "Classify and route HR requests to the right owner",
    status: "available",
    route: "/app/tools/hr-request-router",
  },
},
          {
            id: "requests-tracking",
            problem:
              "Employee requests can get lost or delayed because there is no consistent tracking and ownership mechanism.",

            tool: {
  id: "employee-request-tracker",
  name: "Employee Request Tracker",
  tagline:
    "Track HR requests, ownership, deadlines, and status",
  status: "available",
  route: "/app/tools/employee-request-tracker",
},
          },
        ],
      },

      {
        id: "hr-exceptions",
        name: "HR Exceptions",
        description:
          "Identify unusual HR records and processes that require human review.",

        problems: [
          {
            id: "hr-exception-detection",
            problem:
              "HR teams spend significant time finding unusual records, incomplete processes, and exceptions that cannot be safely handled through standard workflows.",

           tool: {
  id: "hr-exception-detector",
  name: "HR Exception Detector",
  tagline: "Surface HR cases that require human attention",
  status: "available",
  route: "/app/tools/hr-exception-detector",
},
          },

          {
            id: "hr-exception-classification",
            problem:
              "Exceptions are often reviewed manually without a consistent way to classify severity, type, or required action.",

            tool: {
              id: "hr-exception-classifier",
              name: "HR Exception Classifier",
              tagline:
                "Classify HR exceptions by type, severity, and required review",
              status: "available",
              route: "/app/tools/hr-exception-classifier",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 2. RECRUITMENT
  // =========================================================================
  {
    id: "recruitment",
    name: "Recruitment",
    icon: "UserSearch",
    tagline: "Sourcing, screening, and hiring decisions",

    subcategories: [
      {
        id: "sourcing-screening",
        name: "Sourcing & Screening",
        problems: [
          {
            id: "recruitment-resume-screening",
            problem:
              "Resume screening is slow and inconsistent, with different recruiters applying different bars.",

           tool: {
  id: "ai-resume-screener",
  name: "AI Resume Screening Assistant",
  tagline:
    "Consistent, criteria-based resume shortlisting",
  status: "available",
  route: "/app/tools/resume-screening",
},
          },

          {
            id: "recruitment-jd-writing",
            problem:
              "Job descriptions are written inconsistently and take too long to produce for each new requisition.",

            tool: {
  id: "jd-generator",

  name: "Job Description Generator",

  tagline:
    "Consistent, role-accurate JDs in minutes",

  status: "available",
  route: "/app/tools/job-description-generator",
},
          },
        ],
      },

      {
        id: "interview-selection",
        name: "Interview & Selection",
        problems: [
          {
            id: "recruitment-interview-feedback",
            problem:
              "Interview feedback is unstructured, making it hard to compare candidates fairly across panels.",

            tool: {
              id: "interview-scorecards",
              name: "Structured Interview Scorecards",
              tagline:
                "Standardized, comparable interview feedback",
              status: "available",
              route: "/app/tools/interview-scorecards",
            },
          },

          {
            id: "recruitment-pipeline-visibility",
            problem:
              "Hiring managers have no visibility into where candidates stand in the pipeline without asking recruiters directly.",

            tool: {
              id: "hiring-pipeline-tracker",
              name: "Hiring Pipeline Tracker",
              tagline:
                "Shared, real-time candidate pipeline status",
              status: "available",
              route: "/app/tools/hiring-pipeline-tracker",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 3. EMPLOYEE SUPPORT
  // =========================================================================
  {
    id: "employee-support",
    name: "Employee Support",
    icon: "LifeBuoy",
    tagline: "Helpdesk, self-service, and case handling",

    subcategories: [
      {
        id: "hr-helpdesk",
        name: "HR Helpdesk",
        problems: [
          {
            id: "support-repeated-questions",
            problem:
              "HR answers the same policy questions repeatedly instead of pointing employees to self-serve answers.",

            tool: {
              id: "ai-hr-helpdesk",
              name: "AI HR Helpdesk",
              tagline:
                "Instant, policy-grounded answers for employees",
              status: "available",
              route: "/app/tools/ai-hr-helpdesk",
            },
          },

          {
            id: "support-lost-tickets",
            problem:
              "Employee requests submitted over email or chat get lost with no tracking or SLA.",

            tool: {
              id: "case-ticket-management",
              name: "Case & Ticket Management",
              tagline:
                "Trackable HR requests with clear ownership",
              status: "available",
              route: "/app/tools/case-ticket-management",
            },
          },
        ],
      },

      {
        id: "self-service",
        name: "Self-Service",
        problems: [
          {
            id: "support-no-self-service",
            problem:
              "Employees can't self-serve simple requests like letters, ID changes, or bank detail updates.",

            tool: {
              id: "employee-self-service-portal",
              name: "Employee Self-Service Portal",
              tagline:
                "Self-serve requests without opening a ticket",
              status: "available",
               route: "/app/tools/employee-self-service",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 4. ONBOARDING
  // =========================================================================
  {
    id: "onboarding",
    name: "Onboarding",
    icon: "DoorOpen",
    tagline: "Pre-boarding through the first 90 days",

    subcategories: [
      {
        id: "pre-boarding",
        name: "Pre-boarding",
        problems: [
          {
            id: "onboarding-late-start",
            problem:
              "New-hire paperwork, IT provisioning, and asset requests only start on day one, delaying productivity.",

            tool: {
              id: "preboarding-workflow",
              name: "Pre-boarding Checklist & Workflow",
              tagline:
                "Everything ready before day one",
              status: "available",
              route: "/app/tools/preboarding-workflow",
            },
          },
        ],
      },

      {
        id: "ramp",
        name: "Day-1 to 90-Day Ramp",
        problems: [
          {
            id: "onboarding-inconsistent-journey",
            problem:
              "There is no consistent onboarding journey, so the new-hire experience varies wildly by manager and team.",

            tool: {
              id: "onboarding-journey-builder",
              name: "Onboarding Journey Builder",
              tagline:
                "Consistent, trackable onboarding journeys",
              status: "available",
              route: "/app/tools/onboarding-journey-builder",
            },
          },

          {
            id: "onboarding-buddy-assignment",
            problem:
              "Buddy and mentor assignments for new hires are ad hoc or skipped entirely.",

            tool: {
              id: "buddy-mentor-assignment",
              name: "Buddy / Mentor Assignment Tool",
              tagline:
                "Structured peer support for new hires",
              status: "available",
              route: "/app/tools/buddy-mentor-assignment",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 5. PERFORMANCE
  // =========================================================================
  {
    id: "performance",
    name: "Performance",
    icon: "TrendingUp",
    tagline: "Goals, reviews, and continuous feedback",

    subcategories: [
      {
        id: "goals-reviews",
        name: "Goal Setting & Reviews",
        problems: [
          {
            id: "performance-inconsistent-goals",
            problem:
              "Goal setting is inconsistent across teams and rarely revisited once set.",

            tool: {
              id: "goal-okr-tracker",
              name: "Goal & OKR Tracker",
              tagline:
                "Shared goal-setting and progress tracking",
              status: "available",
              route: "/app/tools/goal-okr-tracker",
            },
          },

          {
            id: "performance-slow-review-cycles",
            problem:
              "Performance review cycles are run manually and take weeks to consolidate across managers.",

            tool: {
              id: "review-cycle-manager",
              name: "Review Cycle Manager",
              tagline:
                "Structured, time-bound review cycles",
              status: "available",
              route: "/app/tools/review-cycle-manager",
            },
          },
        ],
      },

      {
        id: "feedback",
        name: "Feedback",
        problems: [
          {
            id: "performance-no-continuous-feedback",
            problem:
              "Feedback only happens during formal review cycles, missing issues and wins in real time.",

            tool: {
              id: "continuous-feedback-tool",
              name: "Continuous Feedback Tool",
              tagline:
                "Lightweight feedback outside review cycles",
              status: "available",
              route: "/app/tools/continuous-feedback",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 6. LEARNING & DEVELOPMENT
  // =========================================================================
  {
    id: "learning-development",
    name: "Learning & Development",
    icon: "GraduationCap",
    tagline:
      "Training content, delivery, and compliance tracking",

    subcategories: [
      {
        id: "content-delivery",
        name: "Content & Delivery",
        problems: [
          {
            id: "ld-manual-course-creation",
            problem:
              "Turning existing documents and recordings into structured training content is slow and manual.",

            tool: {
              id: "ai-course-generator",
              name: "AI Course Generator",
              tagline:
                "Structured courses from existing content",
              status: "available",
              route: "/app/tools/ai-course-generator",
            },
          },

          {
            id: "ld-skill-gap-mapping",
            problem:
              "Employees don't know which training actually maps to the skill gaps in their role.",

            tool: {
              id: "skill-gap-recommender",
              name: "Skill-Gap Based Learning Recommender",
              tagline:
                "Training recommendations tied to real gaps",
              status: "available",
               route: "/app/tools/skill-gap-recommender",
            },
          },
        ],
      },

      {
        id: "tracking-compliance",
        name: "Tracking & Compliance",
        problems: [
          {
            id: "ld-compliance-tracking",
            problem:
              "Mandatory training completion is hard to track and report on for audits.",

            tool: {
              id: "training-compliance-tracker",
              name: "Training Compliance Tracker",
              tagline:
                "Completion tracking and audit-ready reports",
              status: "available",
              route: "/app/tools/training-compliance-tracker",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 7. WORKFORCE PLANNING
  // =========================================================================
  {
    id: "workforce-planning",
    name: "Workforce Planning",
    icon: "Users",
    tagline: "Headcount, forecasting, and org design",

    subcategories: [
      {
        id: "headcount-forecasting",
        name: "Headcount & Forecasting",
        problems: [
          {
            id: "workforce-spreadsheet-planning",
            problem:
              "Headcount planning happens in disconnected spreadsheets that go stale as soon as they're shared.",

            tool: {
              id: "headcount-planning-tool",
              name: "Headcount Planning Tool",
              tagline:
                "Shared, live headcount plans by team",
              status: "available",
              route: "/app/tools/headcount-planning",
            },
          },

          {
            id: "workforce-attrition-forecasting",
            problem:
              "There is no visibility into attrition-driven hiring needs before they become urgent.",

            tool: {
              id: "attrition-demand-forecasting",
              name: "Attrition & Demand Forecasting",
              tagline:
                "Early signal on upcoming hiring needs",
              status: "available",
              route: "/app/tools/attrition-demand-forecasting"
            },
          },
        ],
      },

      {
        id: "org-design",
        name: "Org Design",
        problems: [
          {
            id: "workforce-stale-org-charts",
            problem:
              "Org charts go stale the moment they're built and rarely reflect current reporting lines.",

            tool: {
              id: "live-org-chart-builder",
              name: "Live Org Chart Builder",
              tagline:
                "Org charts that stay in sync with reality",
              status: "available",
              route: "/app/tools/org-chart-builder",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 8. EMPLOYEE ENGAGEMENT
  // =========================================================================
  {
    id: "employee-engagement",
    name: "Employee Engagement",
    icon: "Heart",
    tagline: "Listening, sentiment, and recognition",

    subcategories: [
      {
        id: "listening",
        name: "Listening",
        problems: [
          {
            id: "engagement-infrequent-surveys",
            problem:
              "Engagement surveys run infrequently and results take weeks to analyze, so issues surface too late.",

            tool: {
              id: "pulse-survey-tool",
              name: "Pulse Survey & Sentiment Tool",
              tagline:
                "Frequent pulses with fast, readable results",
              status: "available",
              route: "/app/tools/pulse-survey",
            },
          },
        ],
      },

      {
        id: "recognition",
        name: "Recognition",
        problems: [
          {
            id: "engagement-no-recognition-channel",
            problem:
              "Peer recognition has no consistent, visible channel and depends entirely on individual managers.",

            tool: {
              id: "recognition-rewards-wall",
              name: "Recognition & Rewards Wall",
              tagline:
                "A visible, shared home for peer recognition",
              status: "available",
              route: "/app/tools/recognition-rewards-wall",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 9. HR ANALYTICS
  // =========================================================================
  {
    id: "hr-analytics",
    name: "HR Analytics",
    icon: "BarChart3",
    tagline:
      "Workforce metrics grounded in real HR questions",

    subcategories: [
      {
        id: "workforce-metrics",
        name: "Workforce Metrics",
        problems: [
          {
            id: "analytics-siloed-metrics",
            problem:
              "Core HR metrics like attrition, headcount, and diversity live in siloed spreadsheets nobody trusts.",

            tool: {
              id: "workforce-metrics-dashboard",
              name: "Workforce Metrics Dashboard",
              tagline:
                "One trusted view of core workforce metrics",
              status: "available",
               route: "/app/tools/workforce-metrics",
            },
          },

          {
            id: "analytics-adhoc-questions",
            problem:
              "HR can't quickly answer ad hoc workforce questions from leadership without manual data pulls.",

            tool: {
              id: "hr-query-assistant",
              name: "Ask-Your-Data HR Query Assistant",
              tagline:
                "Plain-language answers from workforce data",
              status: "available",
              route: "/app/tools/ask-your-data",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 10. COMPENSATION
  // =========================================================================
  {
    id: "compensation",
    name: "Compensation",
    icon: "Wallet",
    tagline:
      "Pay structures, benchmarking, and review cycles",

    subcategories: [
      {
        id: "pay-structuring",
        name: "Pay Structuring",
        problems: [
          {
            id: "compensation-inconsistent-bands",
            problem:
              "Salary bands and structures are inconsistent across roles and levels, creating internal pay equity risk.",

            tool: {
              id: "pay-band-builder",
              name: "Pay Band & Structure Builder",
              tagline:
                "Consistent, auditable salary structures",
              status: "available",
              route: "/app/tools/pay-band-structure-builder",
            },
          },

          {
            id: "compensation-manual-benchmarking",
            problem:
              "Benchmarking pay against the market is a manual, spreadsheet-heavy exercise done rarely.",

            tool: {
              id: "market-benchmarking-tool",
              name: "Market Benchmarking Tool",
              tagline:
                "Faster, structured market pay comparisons",
              status: "available",
              route: "/app/tools/market-benchmarking",
            },
          },
        ],
      },

      {
        id: "annual-cycles",
        name: "Annual Cycles",
        problems: [
          {
            id: "compensation-manual-review-cycle",
            problem:
              "Annual compensation review and increment cycles run on spreadsheets and are error-prone at scale.",

            tool: {
              id: "comp-review-cycle-manager",
              name: "Comp Review Cycle Manager",
              tagline:
                "Structured, auditable comp review cycles",
              status: "available",
              route: "/app/tools/comp-review-cycle-manager"
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 11. EMPLOYEE RELATIONS
  // =========================================================================
  {
    id: "employee-relations",
    name: "Employee Relations",
    icon: "MessagesSquare",
    tagline:
      "Case management and workplace investigations",

    subcategories: [
      {
        id: "case-management",
        name: "Case Management",
        problems: [
          {
            id: "relations-undocumented-cases",
            problem:
              "Grievances and disciplinary cases lack a documented, consistent process, creating legal exposure.",

            tool: {
              id: "er-case-management",
              name: "ER Case Management Tool",
              tagline:
                "Consistent, documented case handling",
              status: "available",
              route: "/app/tools/er-case-management",
            },
          },
        ],
      },

      {
        id: "investigations",
        name: "Investigations",
        problems: [
          {
            id: "relations-lost-investigation-trail",
            problem:
              "Investigation timelines and evidence get scattered across emails with no single record.",

            tool: {
              id: "investigation-tracker",
              name: "Investigation Tracker",
              tagline:
                "A single, timestamped investigation record",
              status: "available",
              route: "/app/tools/investigation-tracker",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 12. HR COMPLIANCE
  // =========================================================================
  {
    id: "hr-compliance",
    name: "HR Compliance",
    icon: "ShieldCheck",
    tagline:
      "Policy management and statutory obligations",

    subcategories: [
      {
        id: "policy-management",
        name: "Policy Management",
        problems: [
          {
            id: "compliance-untracked-acknowledgment",
            problem:
              "Policy versions and employee acknowledgments aren't tracked, making audits painful.",

            tool: {
              id: "policy-library-tracker",
              name: "Policy Library & Acknowledgment Tracker",
              tagline:
                "Versioned policies with proof of acknowledgment",
              status: "available",
              route: "/app/tools/policy-library-tracker",
            },
          },
        ],
      },

      {
        id: "statutory-compliance",
        name: "Statutory Compliance",
        problems: [
          {
            id: "compliance-manual-deadlines",
            problem:
              "Multi-jurisdiction statutory compliance deadlines are tracked manually and are easy to miss.",

            tool: {
              id: "compliance-calendar",
              name: "Compliance Calendar & Alerts",
              tagline:
                "Never miss a statutory filing deadline",
              status: "available",
              route: "/app/tools/compliance-calendar",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 13. HR TECHNOLOGY
  // =========================================================================
  {
    id: "hr-technology",
    name: "HR Technology",
    icon: "Plug",
    tagline:
      "Integrations, data flow, and access control",

    subcategories: [
      {
        id: "integrations",
        name: "Integrations",
        problems: [
          {
            id: "hrtech-siloed-tools",
            problem:
              "HR tools don't talk to each other, causing duplicate data entry across systems.",

            tool: {
              id: "integration-hub",
              name: "Integration Hub",
              tagline:
                "One place to connect HR systems together",
              status: "available",
              route: "/app/tools/integration-hub",
            },
          },
        ],
      },

      {
        id: "data-access",
        name: "Data & Access",
        problems: [
          {
            id: "hrtech-no-audit-trail",
            problem:
              "There is no central audit trail of who accessed sensitive employee data, or when.",

            tool: {
              id: "access-audit-log",
              name: "Access & Audit Log Viewer",
              tagline:
                "Full visibility into who accessed what, when",
              status: "available",
              route: "/app/tools/access-audit-log",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 14. STRATEGIC HR
  // =========================================================================
  {
    id: "strategic-hr",
    name: "Strategic HR",
    icon: "Compass",
    tagline:
      "Roadmaps and succession, tied to business outcomes",

    subcategories: [
      {
        id: "planning",
        name: "Planning",
        problems: [
          {
            id: "strategic-disconnected-roadmap",
            problem:
              "HR strategy isn't linked to measurable business outcomes, making its impact hard to demonstrate.",

            tool: {
              id: "strategic-hr-roadmap",
              name: "Strategic HR Roadmap Tool",
              tagline:
                "HR priorities tied to business outcomes",
              status: "available",
              route:"/app/tools/strategic-hr-roadmap",
            },
          },
        ],
      },

      {
        id: "succession",
        name: "Succession",
        problems: [
          {
            id: "strategic-reactive-succession",
            problem:
              "Succession planning for key roles is undocumented and only happens reactively after someone leaves.",

            tool: {
              id: "succession-planning-tool",
              name: "Succession Planning Tool",
              tagline:
                "Proactive readiness for key-role transitions",
              status: "available",
              route: "/app/tools/succession-planning-tool",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // 15. PAYROLL
  // =========================================================================
  // Payroll is intentionally a completely separate top-level category.
  // It will be developed after the other HR categories are stabilized.
  {
    id: "payroll",
    name: "Payroll",
    icon: "Wallet",
    tagline:
      "End-to-end payroll, deductions, reimbursements, and settlements",

    subcategories: [
      {
        id: "payroll-processing",
        name: "Payroll Processing",
        description:
          "Payroll calculation, statutory deductions, payslips, reimbursements, cost visibility, and final settlements.",

        problems: [
          {
            id: "payroll-manual-errors",
            problem:
              "Manual payroll calculations across spreadsheets cause errors, delays, and repeated rework every cycle.",

            tool: {
              id: "payroll-run-engine",
              name: "Payroll Run Engine",
              tagline:
                "Automated payroll calculation and disbursement runs",
              status: "available",
              route: "/app/tools/payroll-run-engine",
            },
          },

          {
            id: "payroll-statutory-tracking",
            problem:
              "Statutory deductions (PF, ESI, TDS, and regional equivalents) are tracked manually and are easy to miscalculate or file late.",

            tool: {
              id: "statutory-deduction-engine",
              name: "Statutory Deduction Engine",
              tagline:
                "Automated statutory deduction calculation and filing prep",
              status: "available",
              route: "/app/tools/statutory-deduction-engine",
            },
          },

          {
            id: "payroll-payslip-distribution",
            problem:
              "Payslip generation and distribution is a manual, month-end scramble with no self-serve access for employees.",

            tool: {
              id: "payslip-generator",
              name: "Payslip Generator & Portal",
              tagline:
                "Auto-generated payslips with employee self-serve access",
              status: "available",
              route: "/app/tools/payslip-generator-portal",
            },
          },

          {
            id: "payroll-reimbursements",
            problem:
              "Reimbursement and expense claims are submitted over email/chat and reconciled by hand against payroll.",

            tool: {
              id: "reimbursement-manager",
              name: "Reimbursement & Expense Manager",
              tagline:
                "Claims submission, approval, and payroll reconciliation",
              status: "available",
              route: "/app/tools/reimbursement-expense-manager",
            },
          },

          {
            id: "payroll-cost-visibility",
            problem:
              "Leadership has no real-time visibility into payroll cost breakdowns by department, location, or role.",

            tool: {
              id: "payroll-cost-analytics",
              name: "Payroll Cost Analytics",
              tagline:
                "Payroll cost breakdowns by team, location, and role",
              status: "available",
              route: "/app/tools/payroll-cost-analytics",
            },
          },

          {
            id: "payroll-settlement-consistency",
            problem:
              "Full-and-final settlement calculations vary by whoever processes them, creating disputes on exit.",

            tool: {
              id: "fnf-settlement-calculator",
              name: "Full & Final Settlement Calculator",
              tagline:
                "Consistent, auditable exit settlement calculations",
              status: "planned",
            },
          },
        ],
      },
    ],
  },
];

// =============================================================================
// DERIVED HELPERS
// =============================================================================

/**
 * Find a category by its ID.
 */
export function getCategoryById(categoryId) {
  return (
    CATEGORIES.find(
      (category) => category.id === categoryId
    ) || null
  );
}

/**
 * Return every tool in the platform with its category and subcategory context.
 */
export function getAllTools() {
  return CATEGORIES.flatMap((category) =>
    category.subcategories.flatMap((subcategory) =>
      subcategory.problems.map((problem) => ({
        ...problem.tool,

        problem: problem.problem,
        problemId: problem.id,

        categoryId: category.id,
        categoryName: category.name,

        subcategoryId: subcategory.id,
        subcategoryName: subcategory.name,
      }))
    )
  );
}

/**
 * Count tools/problems inside a category.
 */
export function getToolCount(category) {
  return category.subcategories.reduce(
    (sum, subcategory) =>
      sum + subcategory.problems.length,
    0
  );
}

/**
 * Return lightweight information for the dashboard/category navigation.
 */
export function getCategorySummary() {
  return CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    icon: category.icon,
    tagline: category.tagline,
    toolCount: getToolCount(category),
    subcategoryCount:
      category.subcategories.length,
  }));
}