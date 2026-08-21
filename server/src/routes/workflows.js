import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

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
    const organization = await getOrganizationForUser(req.user.id);

    if (!organization) {
      return res.status(403).json({
        message: "Complete organization setup first",
      });
    }

    req.organization = organization;
    next();
  } catch (error) {
    console.error("Workflow organization lookup error:", error);

    return res.status(500).json({
      message: "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   BASIC HELPERS
========================================================= */

function cleanString(value) {
  return String(value ?? "").trim();
}

function validateWorkflowPayload(body = {}) {
  const workflowName = cleanString(body.workflow_name);
  const workflowType = cleanString(body.workflow_type);
  const processDescription = cleanString(body.process_description);

  const errors = [];

  if (!workflowName) errors.push("Workflow name is required");
  if (!workflowType) errors.push("Workflow type is required");
  if (!processDescription) errors.push("Process description is required");

  return {
    errors,
    workflowName,
    workflowType,
    processDescription,
  };
}

/* =========================================================
   EXECUTION TYPES

   approval          -> human approval gate
   intelligent       -> system/AI-style analysis or preparation
   system            -> deterministic software action
   human_task        -> real-world human action; never fake-completed
========================================================= */

const EXECUTION_TYPES = new Set([
  "approval",
  "intelligent",
  "system",
  "human_task",
]);

function inferExecutionType(step) {
  if (Boolean(step?.approvalRequired ?? step?.approval_required)) {
    return "approval";
  }

  const explicit = cleanString(
    step?.executionType ?? step?.execution_type,
  ).toLowerCase();

  if (EXECUTION_TYPES.has(explicit)) {
    return explicit;
  }

  const text = `${step?.title ?? ""} ${step?.description ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

  /*
   * Use whole words here. Previously "sign" matched the
   * "sign" inside "resignation", which incorrectly turned
   * normal resignation-processing steps into human tasks.
   */
  if (
    /\b(interview|conduct|meet|discuss|handover|physically|perform|collect|return|sign)\b/.test(
      text,
    )
  ) {
    return "human_task";
  }

  if (
    /\b(analyze|analyse|review|verify|validate|check|calculate|compare|extract|summarize|summary|identify|assess|classify)\b/.test(
      text,
    )
  ) {
    return "intelligent";
  }

  if (
    /\b(create|record|log|prepare|generate|schedule|route|assign|notify|initiate|set up|update|close|archive)\b/.test(
      text,
    )
  ) {
    return "system";
  }

  return "human_task";
}

function inferActionKey(step) {
  const explicit = cleanString(
    step?.actionKey ?? step?.action_key,
  ).toLowerCase();

  if (explicit) return explicit;

  const text = `${step?.title ?? ""} ${step?.description ?? ""}`.toLowerCase();

  if (/receive.*(request|resignation|exit)|record.*(request|resignation|exit)/.test(text)) {
    return "record_request";
  }

  if (/review.*resignation|verify.*notice|notice period/.test(text)) {
    return "analyze_resignation";
  }

  if (/exit checklist|checklist.*exit|asset return|access closure/.test(text)) {
    return "create_exit_checklist";
  }

  if (/exit interview/.test(text)) {
    return "prepare_exit_interview";
  }

  if (/final settlement|settlement.*payroll|payroll.*settlement/.test(text)) {
    return "prepare_final_settlement";
  }

  if (/close.*employee record|employee record.*close|archive.*employee/.test(text)) {
    return "prepare_record_closure";
  }

  if (/leave balance|check.*leave/.test(text)) {
    return "check_leave_balance";
  }

  return "record_workflow_action";
}

function normalizeExecutionStep(step, index) {
  const executionType = inferExecutionType(step);

  return {
    index,
    title: cleanString(
      step?.title ?? step?.name ?? `Workflow step ${index + 1}`,
    ),
    description: cleanString(
      step?.description ?? step?.details ?? step?.whatHappens ?? "",
    ),
    owner: cleanString(step?.owner ?? "HR"),
    deadline: cleanString(step?.deadline ?? ""),
    approvalRequired: executionType === "approval",
    executionType,
    actionKey: inferActionKey(step),
    status: index === 0 ? "active" : "not_started",
    startedAt: index === 0 ? new Date().toISOString() : null,
    completedAt: null,
    completedBy: null,
    notes: "",
    executionResult: null,
  };
}

function getWorkflowSteps(workflow) {
  const data = workflow?.workflow_data;
  return data && typeof data === "object" && Array.isArray(data.steps)
    ? data.steps
    : [];
}

function createExecutionSteps(workflow) {
  return getWorkflowSteps(workflow).map(normalizeExecutionStep);
}

function getRunSteps(run) {
  const data = run?.execution_data;
  return data && typeof data === "object" && Array.isArray(data.steps)
    ? data.steps
    : [];
}

function countCompletedSteps(steps) {
  return steps.filter((step) => step?.status === "completed").length;
}

function findCurrentStepIndex(steps) {
  const index = steps.findIndex((step) =>
    ["active", "waiting_approval", "waiting_human"].includes(step?.status),
  );

  return index;
}

/* =========================================================
   REAL AUTOMATION ACTIONS

   These functions perform actions that are actually possible
   inside this application. They never claim that a human task
   happened when it did not.
========================================================= */

function employeeName(employee) {
  return (
    employee?.full_name ||
    employee?.name ||
    employee?.employee_name ||
    "Employee"
  );
}

function buildActionResult(step, employee, run) {
  const name = employeeName(employee);

  switch (step.actionKey) {
    case "record_request":
      return {
        action: "record_request",
        performed: true,
        message: `Workflow request recorded for ${name}.`,
        data: {
          employeeId: employee?.id ?? null,
          workflowRunId: run.id,
          recordedAt: new Date().toISOString(),
        },
      };

    case "analyze_resignation": {
      const availableFields = Object.keys(employee || {}).filter(
        (key) => employee?.[key] !== null && employee?.[key] !== "",
      );

      const resignationDate =
        employee?.resignation_date ||
        employee?.resignationDate ||
        employee?.exit_date ||
        employee?.exitDate ||
        null;

      const noticePeriod =
        employee?.notice_period ||
        employee?.noticePeriod ||
        null;

      return {
        action: "analyze_resignation",
        performed: true,
        message:
          resignationDate || noticePeriod
            ? `Employee information was analyzed for ${name}.`
            : `Employee information was analyzed for ${name}; resignation date and notice period are not stored on the employee record.`,
        data: {
          resignationDate,
          noticePeriod,
          availableFieldCount: availableFields.length,
          missing: [
            !resignationDate ? "resignation date" : null,
            !noticePeriod ? "notice period" : null,
          ].filter(Boolean),
        },
      };
    }

    case "create_exit_checklist":
      return {
        action: "create_exit_checklist",
        performed: true,
        message: `Exit checklist created for ${name}.`,
        data: {
          checklist: [
            {
              id: "asset-return",
              title: "Company asset return",
              owner: "HR",
              status: "pending",
            },
            {
              id: "document-collection",
              title: "Exit document collection",
              owner: "HR",
              status: "pending",
            },
            {
              id: "access-closure",
              title: "System access closure",
              owner: "IT",
              status: "pending",
            },
            {
              id: "knowledge-transfer",
              title: "Knowledge transfer confirmation",
              owner: "Manager",
              status: "pending",
            },
          ],
        },
      };

    case "prepare_exit_interview":
      return {
        action: "prepare_exit_interview",
        performed: true,
        message: `Exit interview task prepared for ${name}.`,
        data: {
          task: {
            title: "Conduct exit interview",
            owner: "HR",
            status: "pending",
          },
          questionnaire: [
            "Reason for leaving",
            "Experience with the role and team",
            "Manager and workplace feedback",
            "What could the organization improve?",
            "Suggestions for the next employee",
          ],
        },
      };

    case "prepare_final_settlement":
      return {
        action: "prepare_final_settlement",
        performed: true,
        message: `Final settlement review package prepared for ${name}.`,
        data: {
          task: {
            title: "Review final settlement",
            owner: "Payroll",
            status: "pending",
          },
          checklist: [
            "Salary through last working day",
            "Leave balance / encashment",
            "Outstanding deductions",
            "Reimbursements",
            "Other applicable settlement items",
          ],
        },
      };

    case "prepare_record_closure":
      return {
        action: "prepare_record_closure",
        performed: true,
        message: `Employee record closure package prepared for ${name}.`,
        data: {
          note:
            "The system prepared the closure checklist. It did not falsely close the employee record.",
          conditions: [
            "Exit checklist completed",
            "Exit interview completed",
            "Final settlement completed",
            "Required access closure confirmed",
          ],
        },
      };

    case "check_leave_balance":
      return {
        action: "check_leave_balance",
        performed: true,
        message: `Leave information check completed for ${name}.`,
        data: {
          note:
            "The available employee data was checked. A leave balance is only reported when the connected employee data contains one.",
          balance:
            employee?.leave_balance ??
            employee?.leaveBalance ??
            null,
        },
      };

    default:
      return {
        action: "record_workflow_action",
        performed: true,
        message: `System action recorded for workflow step: ${step.title}.`,
        data: {
          workflowRunId: run.id,
        },
      };
  }
}

async function executeCurrentAutomatedStep(run, employee, step) {
  if (!["system", "intelligent"].includes(step.executionType)) {
    return step;
  }

  const result = buildActionResult(step, employee, run);
  const now = new Date().toISOString();

  return {
    ...step,
    status: "completed",
    completedAt: now,
    completedBy: "workflow_engine",
    executionMode: step.executionType,
    executionMessage: result.message,
    executionResult: result,
  };
}

/* =========================================================
   ADVANCE RUN

   The engine automatically performs only genuine software
   actions. It stops at:

   1. approval gates
   2. real human tasks

   It never marks a human action as completed automatically.
========================================================= */

async function advanceWorkflowRun(run) {
  if (!run || run.status !== "in_progress") return run;

  const employee = run?.execution_data?.employee?.snapshot || null;
  const steps = getRunSteps(run);

  if (!steps.length) return run;

  let currentIndex = findCurrentStepIndex(steps);

  if (currentIndex === -1) {
    currentIndex = Number(run.current_step_index ?? 0);
  }

  while (currentIndex >= 0 && currentIndex < steps.length) {
    const step = steps[currentIndex];

    if (!step) break;

    if (step.status === "completed") {
      currentIndex += 1;
      continue;
    }

    if (step.executionType === "approval") {
      steps[currentIndex] = {
        ...step,
        status: "waiting_approval",
        approvalRequired: true,
        startedAt: step.startedAt || new Date().toISOString(),
      };

      const executionData = {
        ...(run.execution_data || {}),
        steps,
      };

      const { data, error } = await supabaseAdmin
        .from("hr_workflow_runs")
        .update({
          current_step_index: currentIndex,
          execution_data: executionData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id)
        .eq("organization_id", run.organization_id)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    }

    if (step.executionType === "human_task") {
      steps[currentIndex] = {
        ...step,
        status: "waiting_human",
        startedAt: step.startedAt || new Date().toISOString(),
        executionMode: "human_task",
        executionMessage:
          "A real-world human action is required. The system has not marked it as completed.",
      };

      const executionData = {
        ...(run.execution_data || {}),
        steps,
      };

      const { data, error } = await supabaseAdmin
        .from("hr_workflow_runs")
        .update({
          current_step_index: currentIndex,
          execution_data: executionData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id)
        .eq("organization_id", run.organization_id)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    }

    steps[currentIndex] = await executeCurrentAutomatedStep(
      run,
      employee,
      step,
    );

    const nextIndex = currentIndex + 1;

    if (nextIndex >= steps.length) {
      const executionData = {
        ...(run.execution_data || {}),
        steps,
      };

      const now = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("hr_workflow_runs")
        .update({
          status: "completed",
          current_step_index: steps.length - 1,
          execution_data: executionData,
          completed_at: now,
          updated_at: now,
        })
        .eq("id", run.id)
        .eq("organization_id", run.organization_id)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    }

    steps[nextIndex] = {
      ...steps[nextIndex],
      status: "active",
      startedAt: steps[nextIndex].startedAt || new Date().toISOString(),
    };

    const executionData = {
      ...(run.execution_data || {}),
      steps,
    };

    const { data, error } = await supabaseAdmin
      .from("hr_workflow_runs")
      .update({
        current_step_index: nextIndex,
        execution_data: executionData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .eq("organization_id", run.organization_id)
      .select("*")
      .single();

    if (error) throw error;

    run = data;
    currentIndex = nextIndex;
  }

  return run;
}

/* =========================================================
   GET ALL WORKFLOWS
========================================================= */

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("hr_workflows")
      .select("*")
      .eq("organization_id", req.organization.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load workflows error:", error);
      return res.status(500).json({
        message: "Could not load workflows",
        detail: error.message,
      });
    }

    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Unexpected workflow list error:", error);
    return res.status(500).json({
      message: "Could not load workflows",
    });
  }
});

/* =========================================================
   GET ALL WORKFLOW RUNS
========================================================= */

router.get("/runs", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("hr_workflow_runs")
      .select("*")
      .eq("organization_id", req.organization.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load workflow runs error:", error);
      return res.status(500).json({
        message: "Could not load workflow runs",
        detail: error.message,
      });
    }

    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Unexpected workflow runs list error:", error);
    return res.status(500).json({
      message: "Could not load workflow runs",
    });
  }
});

/* =========================================================
   GET ONE WORKFLOW RUN
========================================================= */

router.get("/runs/:runId", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("hr_workflow_runs")
      .select("*")
      .eq("id", req.params.runId)
      .eq("organization_id", req.organization.id)
      .maybeSingle();

    if (error) {
      console.error("Load workflow run error:", error);
      return res.status(500).json({
        message: "Could not load workflow run",
        detail: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message: "Workflow run not found",
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Unexpected workflow run lookup error:", error);
    return res.status(500).json({
      message: "Could not load workflow run",
    });
  }
});

/* =========================================================
   GET ONE WORKFLOW
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("hr_workflows")
      .select("*")
      .eq("id", req.params.id)
      .eq("organization_id", req.organization.id)
      .maybeSingle();

    if (error) {
      console.error("Load workflow error:", error);
      return res.status(500).json({
        message: "Could not load workflow",
        detail: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message: "Workflow not found",
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Unexpected workflow lookup error:", error);
    return res.status(500).json({
      message: "Could not load workflow",
    });
  }
});

/* =========================================================
   CREATE WORKFLOW
========================================================= */

router.post("/", async (req, res) => {
  try {
    const {
      errors,
      workflowName,
      workflowType,
      processDescription,
    } = validateWorkflowPayload(req.body);

    if (errors.length) {
      return res.status(400).json({
        message: "Invalid workflow data",
        errors,
      });
    }

    const workflowData =
      req.body?.workflow_data &&
      typeof req.body.workflow_data === "object"
        ? req.body.workflow_data
        : {};

    const status = ["draft", "active", "archived"].includes(req.body?.status)
      ? req.body.status
      : "draft";

    const record = {
      organization_id: req.organization.id,
      created_by: req.user.id,
      workflow_name: workflowName,
      workflow_type: workflowType,
      process_description: processDescription,
      workflow_data: workflowData,
      status,
    };

    const { data, error } = await supabaseAdmin
      .from("hr_workflows")
      .insert(record)
      .select("*")
      .single();

    if (error) {
      console.error("Create workflow error:", error);
      return res.status(500).json({
        message: "Could not save workflow",
        detail: error.message,
      });
    }

    return res.status(201).json({
      message: "Workflow saved successfully",
      workflow: data,
    });
  } catch (error) {
    console.error("Unexpected workflow create error:", error);
    return res.status(500).json({
      message: "Could not save workflow",
      detail: error?.message || null,
    });
  }
});

/* =========================================================
   START WORKFLOW
========================================================= */

router.post("/:id/runs", async (req, res) => {
  try {
    const employeeId = cleanString(req.body?.employee_id);

    if (!employeeId) {
      return res.status(400).json({
        message: "Employee ID is required",
      });
    }

    const { data: workflow, error: workflowError } = await supabaseAdmin
      .from("hr_workflows")
      .select("*")
      .eq("id", req.params.id)
      .eq("organization_id", req.organization.id)
      .maybeSingle();

    if (workflowError) {
      return res.status(500).json({
        message: "Could not load workflow",
        detail: workflowError.message,
      });
    }

    if (!workflow) {
      return res.status(404).json({
        message: "Workflow not found",
      });
    }

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .eq("organization_id", req.organization.id)
      .maybeSingle();

    if (employeeError) {
      return res.status(500).json({
        message: "Could not load employee",
        detail: employeeError.message,
      });
    }

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    const { data: existingRuns, error: existingRunError } = await supabaseAdmin
      .from("hr_workflow_runs")
      .select("*")
      .eq("organization_id", req.organization.id)
      .eq("workflow_id", workflow.id)
      .eq("employee_id", employeeId)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingRunError) {
      return res.status(500).json({
        message: "Could not check existing workflow runs",
        detail: existingRunError.message,
      });
    }

    if (existingRuns?.length) {
      const advancedExistingRun = await advanceWorkflowRun(existingRuns[0]);

      return res.status(409).json({
        message: "This workflow is already running for this employee",
        run: advancedExistingRun,
      });
    }

    const workflowSteps = getWorkflowSteps(workflow);

    if (!workflowSteps.length) {
      return res.status(400).json({
        message: "This workflow has no steps. Generate and save workflow steps before starting it.",
      });
    }

    const executionSteps = createExecutionSteps(workflow);

    const executionData = {
      steps: executionSteps,
      employee: {
        id: employee.id,
        snapshot: employee,
      },
      automation: {
        engineVersion: "2.0",
        startedAt: new Date().toISOString(),
      },
    };

    const { data: run, error: runError } = await supabaseAdmin
      .from("hr_workflow_runs")
      .insert({
        organization_id: req.organization.id,
        workflow_id: workflow.id,
        employee_id: employee.id,
        created_by: req.user.id,
        status: "in_progress",
        current_step_index: 0,
        execution_data: executionData,
      })
      .select("*")
      .single();

    if (runError) {
      console.error("Create workflow run error:", runError);
      return res.status(500).json({
        message: "Could not start workflow",
        detail: runError.message,
      });
    }

    const advancedRun = await advanceWorkflowRun(run);

    return res.status(201).json({
      message: "Workflow started successfully",
      run: advancedRun,
    });
  } catch (error) {
    console.error("Unexpected workflow start error:", error);
    return res.status(500).json({
      message: "Could not start workflow",
      detail: error?.message || null,
    });
  }
});

/* =========================================================
   UPDATE WORKFLOW
========================================================= */

router.put("/:id", async (req, res) => {
  try {
    const {
      errors,
      workflowName,
      workflowType,
      processDescription,
    } = validateWorkflowPayload(req.body);

    if (errors.length) {
      return res.status(400).json({
        message: "Invalid workflow data",
        errors,
      });
    }

    const workflowData =
      req.body?.workflow_data &&
      typeof req.body.workflow_data === "object"
        ? req.body.workflow_data
        : {};

    const updateData = {
      workflow_name: workflowName,
      workflow_type: workflowType,
      process_description: processDescription,
      workflow_data: workflowData,
      updated_at: new Date().toISOString(),
    };

    if (["draft", "active", "archived"].includes(req.body?.status)) {
      updateData.status = req.body.status;
    }

    const { data, error } = await supabaseAdmin
      .from("hr_workflows")
      .update(updateData)
      .eq("id", req.params.id)
      .eq("organization_id", req.organization.id)
      .select("*")
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        message: "Could not update workflow",
        detail: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message: "Workflow not found",
      });
    }

    return res.status(200).json({
      message: "Workflow updated successfully",
      workflow: data,
    });
  } catch (error) {
    console.error("Unexpected workflow update error:", error);
    return res.status(500).json({
      message: "Could not update workflow",
      detail: error?.message || null,
    });
  }
});

/* =========================================================
   CANCEL WORKFLOW RUN

   Useful when an HR user wants to stop a demo/test run or
   intentionally abandon an execution.
========================================================= */

router.post("/runs/:runId/cancel", async (req, res) => {
  try {
    const { data: run, error: loadError } = await supabaseAdmin
      .from("hr_workflow_runs")
      .select("*")
      .eq("id", req.params.runId)
      .eq("organization_id", req.organization.id)
      .maybeSingle();

    if (loadError) {
      return res.status(500).json({
        message: "Could not load workflow run",
        detail: loadError.message,
      });
    }

    if (!run) {
      return res.status(404).json({
        message: "Workflow run not found",
      });
    }

    if (run.status !== "in_progress") {
      return res.status(400).json({
        message: "This workflow run is no longer active",
      });
    }

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("hr_workflow_runs")
      .update({
        status: "cancelled",
        updated_at: now,
      })
      .eq("id", run.id)
      .eq("organization_id", req.organization.id)
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        message: "Could not cancel workflow run",
        detail: error.message,
      });
    }

    return res.status(200).json({
      message: "Workflow run cancelled",
      run: data,
    });
  } catch (error) {
    console.error("Unexpected workflow cancellation error:", error);

    return res.status(500).json({
      message: "Could not cancel workflow run",
      detail: error?.message || null,
    });
  }
});

/* =========================================================
   APPROVE / REJECT / COMPLETE HUMAN TASK

   This endpoint is intentionally blocked for automated steps.
========================================================= */

router.put("/runs/:runId/steps/:stepIndex", async (req, res) => {
  try {
    const stepIndex = Number(req.params.stepIndex);

    if (!Number.isInteger(stepIndex) || stepIndex < 0) {
      return res.status(400).json({
        message: "Invalid workflow step index",
      });
    }

    const requestedStatus = cleanString(req.body?.status).toLowerCase();

    if (!["completed", "rejected"].includes(requestedStatus)) {
      return res.status(400).json({
        message: "Step status must be completed or rejected",
      });
    }

    const { data: run, error: runError } = await supabaseAdmin
      .from("hr_workflow_runs")
      .select("*")
      .eq("id", req.params.runId)
      .eq("organization_id", req.organization.id)
      .maybeSingle();

    if (runError) {
      return res.status(500).json({
        message: "Could not load workflow run",
        detail: runError.message,
      });
    }

    if (!run) {
      return res.status(404).json({
        message: "Workflow run not found",
      });
    }

    if (run.status !== "in_progress") {
      return res.status(400).json({
        message: "This workflow run is no longer active",
      });
    }

    const steps = getRunSteps(run);

    if (stepIndex >= steps.length) {
      return res.status(404).json({
        message: "Workflow step not found",
      });
    }

    const currentIndex = findCurrentStepIndex(steps);

    if (currentIndex !== stepIndex) {
      return res.status(409).json({
        message: "Only the current workflow step can be acted on",
        currentStepIndex: currentIndex,
      });
    }

    const currentStep = steps[stepIndex];

    if (!["approval", "human_task"].includes(currentStep.executionType)) {
      return res.status(409).json({
        message:
          "This step is automated and cannot be manually completed. The workflow engine handles it.",
        executionType: currentStep.executionType,
      });
    }

    if (
      currentStep.executionType === "approval" &&
      requestedStatus === "completed"
    ) {
      currentStep.executionMessage =
        "Approval granted by the authorized workflow user.";
    }

    const now = new Date().toISOString();

    currentStep.status = requestedStatus;
    currentStep.completedAt = now;
    currentStep.completedBy = req.user.id;
    currentStep.notes = cleanString(req.body?.notes);

    if (requestedStatus === "rejected") {
      currentStep.executionMessage =
        currentStep.executionType === "approval"
          ? "Approval was rejected by the authorized workflow user."
          : "Human task was marked rejected.";

      const executionData = {
        ...(run.execution_data || {}),
        steps,
      };

      const { data, error } = await supabaseAdmin
        .from("hr_workflow_runs")
        .update({
          execution_data: executionData,
          current_step_index: stepIndex,
          updated_at: now,
        })
        .eq("id", run.id)
        .eq("organization_id", req.organization.id)
        .select("*")
        .single();

      if (error) {
        return res.status(500).json({
          message: "Could not reject workflow step",
          detail: error.message,
        });
      }

      return res.status(200).json({
        message:
          currentStep.executionType === "approval"
            ? "Workflow approval rejected"
            : "Human workflow task rejected",
        run: data,
      });
    }

    const nextIndex = stepIndex + 1;
    const isComplete = nextIndex >= steps.length;

    if (!isComplete) {
      steps[nextIndex] = {
        ...steps[nextIndex],
        status: "active",
        startedAt: steps[nextIndex].startedAt || now,
      };
    }

    const executionData = {
      ...(run.execution_data || {}),
      steps,
    };

    if (isComplete) {
      const { data, error } = await supabaseAdmin
        .from("hr_workflow_runs")
        .update({
          status: "completed",
          current_step_index: steps.length - 1,
          execution_data: executionData,
          completed_at: now,
          updated_at: now,
        })
        .eq("id", run.id)
        .eq("organization_id", req.organization.id)
        .select("*")
        .single();

      if (error) {
        return res.status(500).json({
          message: "Could not complete workflow",
          detail: error.message,
        });
      }

      return res.status(200).json({
        message: "Workflow completed successfully",
        run: data,
      });
    }

    const { data: progressedRun, error: progressError } = await supabaseAdmin
      .from("hr_workflow_runs")
      .update({
        current_step_index: nextIndex,
        execution_data: executionData,
        updated_at: now,
      })
      .eq("id", run.id)
      .eq("organization_id", req.organization.id)
      .select("*")
      .single();

    if (progressError) {
      return res.status(500).json({
        message: "Could not update workflow progress",
        detail: progressError.message,
      });
    }

    const advancedRun = await advanceWorkflowRun(progressedRun);

    return res.status(200).json({
      message:
        currentStep.executionType === "approval"
          ? "Approval accepted and workflow continued"
          : "Human task completed and workflow continued",
      run: advancedRun,
    });
  } catch (error) {
    console.error("Unexpected workflow step update error:", error);

    return res.status(500).json({
      message: "Could not update workflow step",
      detail: error?.message || null,
    });
  }
});

/* =========================================================
   DELETE WORKFLOW
========================================================= */

router.delete("/:id", async (req, res) => {
  try {
    const { data: existingWorkflow, error: lookupError } = await supabaseAdmin
      .from("hr_workflows")
      .select("id")
      .eq("id", req.params.id)
      .eq("organization_id", req.organization.id)
      .maybeSingle();

    if (lookupError) {
      return res.status(500).json({
        message: "Could not load workflow before deletion",
        detail: lookupError.message,
      });
    }

    if (!existingWorkflow) {
      return res.status(404).json({
        message: "Workflow not found",
      });
    }

    const { data: activeRuns, error: activeRunsError } = await supabaseAdmin
      .from("hr_workflow_runs")
      .select("id")
      .eq("organization_id", req.organization.id)
      .eq("workflow_id", req.params.id)
      .eq("status", "in_progress")
      .limit(1);

    if (activeRunsError) {
      return res.status(500).json({
        message: "Could not check workflow runs",
        detail: activeRunsError.message,
      });
    }

    if (activeRuns?.length) {
      return res.status(409).json({
        message:
          "This workflow cannot be deleted while an active workflow run exists",
      });
    }

    const { error } = await supabaseAdmin
      .from("hr_workflows")
      .delete()
      .eq("id", req.params.id)
      .eq("organization_id", req.organization.id);

    if (error) {
      return res.status(500).json({
        message: "Could not delete workflow",
        detail: error.message,
      });
    }

    return res.status(200).json({
      message: "Workflow deleted successfully",
    });
  } catch (error) {
    console.error("Unexpected workflow delete error:", error);
    return res.status(500).json({
      message: "Could not delete workflow",
    });
  }
});

export default router;