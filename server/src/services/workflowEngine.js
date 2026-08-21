/**
 * workflowEngine.js
 * -----------------------------------------------------------------------
 * Workflow execution utilities.
 *
 * The core workflow execution logic (step resolution, status updates,
 * and run lifecycle management) lives directly in routes/workflows.js.
 * This module exports shared helpers that can be imported from there
 * or from other services that need workflow primitives.
 */

/**
 * Resolve the execution type for a workflow step based on its name/config.
 * This mirrors the logic embedded in routes/workflows.js and provides
 * a single importable helper.
 *
 * @param {string} stepName - Name of the workflow step
 * @returns {string} - execution type: 'automated' | 'approval' | 'notification' | 'task'
 */
export function inferExecutionType(stepName = "") {
  const name = String(stepName).toLowerCase();

  if (
    name.includes("approve") ||
    name.includes("review") ||
    name.includes("sign") ||
    name.includes("confirm") ||
    name.includes("authorize")
  ) {
    return "approval";
  }

  if (
    name.includes("notify") ||
    name.includes("send") ||
    name.includes("email") ||
    name.includes("alert")
  ) {
    return "notification";
  }

  if (
    name.includes("analyze") ||
    name.includes("generate") ||
    name.includes("create") ||
    name.includes("calculate") ||
    name.includes("prepare") ||
    name.includes("process")
  ) {
    return "automated";
  }

  return "task";
}

/**
 * Resolve the action key for a workflow step based on its name.
 *
 * @param {string} stepName - Name of the workflow step
 * @returns {string} - action key string
 */
export function inferActionKey(stepName = "") {
  const name = String(stepName).toLowerCase();

  return name
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .join("_");
}

/**
 * Build a default step result payload for a given execution type.
 *
 * @param {string} executionType
 * @param {object} step
 * @returns {object}
 */
export function buildDefaultStepResult(
  executionType,
  step = {}
) {
  const baseResult = {
    completed_at: new Date().toISOString(),
    status: "completed",
  };

  switch (executionType) {
    case "approval":
      return {
        ...baseResult,
        decision: "pending",
        awaiting_approver: true,
      };

    case "notification":
      return {
        ...baseResult,
        notification_sent: true,
        channel: "email",
      };

    case "automated":
      return {
        ...baseResult,
        automated: true,
        execution_note: `Step "${step.name || "Unknown"}" executed automatically.`,
      };

    default:
      return {
        ...baseResult,
        task_assigned: true,
      };
  }
}

/**
 * Check whether a workflow run has all steps completed.
 *
 * @param {Array} steps - Array of workflow step objects
 * @returns {boolean}
 */
export function isWorkflowRunComplete(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return false;
  }

  return steps.every(
    (step) =>
      step.status === "completed" ||
      step.status === "skipped"
  );
}
