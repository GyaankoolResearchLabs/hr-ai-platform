import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";

/* =========================================================
   PUBLIC PAGES
========================================================= */

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

/* =========================================================
   APPLICATION PAGES
========================================================= */

import OrganizationSetup from "./pages/OrganizationSetup";
import Dashboard from "./pages/Dashboard";
import CategoryDetail from "./pages/CategoryDetail";
import AIAssistant from "./pages/AIAssistant";
import Employees from "./pages/Employees";
import Settings from "./pages/Settings";

/* =========================================================
   HR TOOLS
========================================================= */

import EmployeeDataQualityChecker from "./pages/tools/EmployeeDataQualityChecker";
import AttendanceLeaveTracker from "./pages/tools/AttendanceLeaveTracker";
import AttendanceAnomalyDetector from "./pages/tools/AttendanceAnomalyDetector";
import LeaveExceptionAnalyzer from "./pages/tools/LeaveExceptionAnalyzer";
import ShiftHolidayCalendarManager from "./pages/tools/ShiftHolidayCalendarManager";

import DocumentVerificationAssistant from "./pages/tools/DocumentVerificationAssistant";
import MissingDocumentDetector from "./pages/tools/MissingDocumentDetector";
import DocumentExpiryMonitor from "./pages/tools/DocumentExpiryMonitor";
import EmployeeRequestTracker from "./pages/tools/EmployeeRequestTracker";
import DocumentLetterGenerator from "./pages/tools/DocumentLetterGenerator";
import DocumentTemplates from "./pages/tools/DocumentTemplates";

import HRExceptionDetector from "./pages/tools/HRExceptionDetector";
import HRWorkflowAssistant from "./pages/tools/HRWorkflowAssistant";
import HREscalationManager from "./pages/tools/HREscalationManager";
import ApprovalRouting from "./pages/tools/ApprovalRouting";
import HRExceptionClassifier from "./pages/tools/HRExceptionClassifier";

import ResumeScreening from "./pages/tools/ResumeScreening";
import JobDescriptionGenerator from "./pages/tools/JobDescriptionGenerator";
import InterviewScorecards from "./pages/tools/InterviewScorecards";
import HiringPipelineTracker from "./pages/tools/HiringPipelineTracker";

import AIHRHelpdesk from "./pages/tools/AIHRHelpdesk";
import CaseTicketManagement from "./pages/tools/CaseTicketManagement";
import EmployeeSelfService from "./pages/tools/EmployeeSelfService";

import PreboardingWorkflow from "./pages/tools/PreboardingWorkflow";
import OnboardingJourneyBuilder from "./pages/tools/OnboardingJourneyBuilder";
import BuddyMentorAssignment from "./pages/tools/BuddyMentorAssignment";

import GoalOKRTracker from "./pages/tools/GoalOKRTracker";
import ReviewCycleManager from "./pages/tools/ReviewCycleManager";
import ContinuousFeedback from "./pages/tools/ContinuousFeedback";

import AICourseGenerator from "./pages/tools/AICourseGenerator";
import SkillGapRecommender from "./pages/tools/SkillGapRecommender";
import TrainingComplianceTracker from "./pages/tools/TrainingComplianceTracker";

import HeadcountPlanning from "./pages/tools/HeadcountPlanning";
import AttritionDemandForecasting from "./pages/tools/AttritionDemandForecasting";
import OrgChartBuilder from "./pages/tools/OrgChartBuilder";

import PulseSurvey from "./pages/tools/PulseSurvey";
import PayBandStructureBuilder from "./pages/tools/PayBandStructureBuilder";
import MarketBenchmarking from "./pages/tools/MarketBenchmarking";
import CompReviewCycleManager from "./pages/tools/CompReviewCycleManager";
import ERCaseManagement from "./pages/tools/ERCaseManagement";
/* =========================================================
   HR ANALYTICS
========================================================= */

import WorkforceMetrics from "./pages/tools/WorkforceMetrics";
import AskYourData from "./pages/tools/AskYourData";
/* =========================================================
   HR REQUEST TOOLS
========================================================= */

import HRRequestIntake from "./pages/tools/HRRequestIntake";
import HRRequestRouter from "./pages/tools/HRRequestRouter";

/* =========================================================
   APP
========================================================= */

export default function App() {
  return (
    <AuthProvider>
      <Routes>

        {/* =====================================================
            PUBLIC ROUTES
        ===================================================== */}

        <Route
          path="/"
          element={<Landing />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/signup"
          element={<Signup />}
        />

        {/* =====================================================
            PROTECTED ROUTES
        ===================================================== */}

        <Route element={<ProtectedRoute />}>

          {/* =================================================
              ORGANIZATION SETUP
          ================================================= */}

          <Route
            path="/organization/setup"
            element={<OrganizationSetup />}
          />

          {/* =================================================
              MAIN APPLICATION
          ================================================= */}

          <Route
            path="/app"
            element={<AppLayout />}
          >

            {/* =================================================
                DEFAULT APPLICATION PAGE
            ================================================= */}

            <Route
              index
              element={
                <Navigate
                  to="dashboard"
                  replace
                />
              }
            />

            {/* =================================================
                DASHBOARD
            ================================================= */}

            <Route
              path="dashboard"
              element={<Dashboard />}
            />

            {/* =================================================
                CATEGORY DETAIL
            ================================================= */}

            <Route
              path="categories/:categoryId"
              element={<CategoryDetail />}
            />

            {/* =================================================
                AI ASSISTANT
            ================================================= */}

            <Route
              path="assistant"
              element={<AIAssistant />}
            />

            {/* =================================================
                EMPLOYEES
            ================================================= */}

            <Route
              path="employees"
              element={<Employees />}
            />

            {/* =================================================
                SETTINGS
            ================================================= */}

            <Route
              path="settings"
              element={<Settings />}
            />

            {/* =================================================
                HR TOOLS
            ================================================= */}

            <Route
              path="tools/ai-hr-helpdesk"
              element={<AIHRHelpdesk />}
            />

            <Route
              path="tools/employee-data-quality"
              element={<EmployeeDataQualityChecker />}
            />

            <Route
              path="tools/attendance-leave-tracker"
              element={<AttendanceLeaveTracker />}
            />

            <Route
              path="tools/attendance-anomaly-detector"
              element={<AttendanceAnomalyDetector />}
            />

            <Route
              path="tools/leave-exception-analyzer"
              element={<LeaveExceptionAnalyzer />}
            />

            <Route
              path="tools/shift-holiday-calendar"
              element={<ShiftHolidayCalendarManager />}
            />

            <Route
              path="tools/document-verification-assistant"
              element={<DocumentVerificationAssistant />}
            />

            <Route
              path="tools/missing-document-detector"
              element={<MissingDocumentDetector />}
            />

            <Route
              path="tools/document-expiry-monitor"
              element={<DocumentExpiryMonitor />}
            />

            <Route
              path="tools/document-letter-generator"
              element={<DocumentLetterGenerator />}
            />

            <Route
              path="tools/document-templates"
              element={<DocumentTemplates />}
            />

            <Route
              path="tools/hr-workflow-assistant"
              element={<HRWorkflowAssistant />}
            />

            <Route
              path="tools/hr-escalation-manager"
              element={<HREscalationManager />}
            />

            <Route
              path="tools/approval-routing"
              element={<ApprovalRouting />}
            />

            <Route
              path="tools/hr-request-intake"
              element={<HRRequestIntake />}
            />

            <Route
              path="tools/hr-request-router"
              element={<HRRequestRouter />}
            />

            <Route
              path="tools/employee-request-tracker"
              element={<EmployeeRequestTracker />}
            />

            <Route
              path="tools/hr-exception-detector"
              element={<HRExceptionDetector />}
            />

            <Route
              path="tools/hr-exception-classifier"
              element={<HRExceptionClassifier />}
            />

            <Route
              path="tools/resume-screening"
              element={<ResumeScreening />}
            />

            <Route
              path="tools/job-description-generator"
              element={<JobDescriptionGenerator />}
            />

            <Route
              path="tools/hiring-pipeline-tracker"
              element={<HiringPipelineTracker />}
            />

            <Route
              path="tools/interview-scorecards"
              element={<InterviewScorecards />}
            />

            <Route
              path="tools/case-ticket-management"
              element={<CaseTicketManagement />}
            />

            <Route
              path="tools/employee-self-service"
              element={<EmployeeSelfService />}
            />

            <Route
              path="tools/preboarding-workflow"
              element={<PreboardingWorkflow />}
            />

            <Route
              path="tools/onboarding-journey-builder"
              element={<OnboardingJourneyBuilder />}
            />

            <Route
              path="tools/buddy-mentor-assignment"
              element={<BuddyMentorAssignment />}
            />

            <Route
              path="tools/goal-okr-tracker"
              element={<GoalOKRTracker />}
            />

            <Route
              path="tools/review-cycle-manager"
              element={<ReviewCycleManager />}
            />

            <Route
              path="tools/continuous-feedback"
              element={<ContinuousFeedback />}
            />

            <Route
              path="tools/pulse-survey"
              element={<PulseSurvey />}
            />

            <Route
              path="tools/ai-course-generator"
              element={<AICourseGenerator />}
            />

            <Route
              path="tools/skill-gap-recommender"
              element={<SkillGapRecommender />}
            />

            <Route
              path="tools/training-compliance-tracker"
              element={<TrainingComplianceTracker />}
            />

            <Route
              path="tools/attrition-demand-forecasting"
              element={<AttritionDemandForecasting />}
            />

            <Route
              path="tools/org-chart-builder"
              element={<OrgChartBuilder />}
            />

            <Route
              path="tools/headcount-planning"
              element={<HeadcountPlanning />}
            />
            <Route
            path="tools/ask-your-data"
            element={<AskYourData />}
            />
            <Route
  path="tools/pay-band-structure-builder"
  element={
    <PayBandStructureBuilder />
  }
/>   
   <Route
  path="tools/market-benchmarking"
  element={<MarketBenchmarking />}
  />

  <Route
  path="tools/comp-review-cycle-manager"
  element={<CompReviewCycleManager />}
/>

<Route
  path="tools/er-case-management"
  element={<ERCaseManagement />}
/>
            {/* =================================================
                WORKFORCE METRICS
            ================================================= */}

            <Route
              path="tools/workforce-metrics"
              element={<WorkforceMetrics />}
            />

          </Route>
        </Route>

        {/* =====================================================
            UNKNOWN ROUTES
        ===================================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>
    </AuthProvider>
  );
}