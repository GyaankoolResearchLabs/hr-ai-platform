import api from "./api";

const workflowService = {
  /* =========================================================
     WORKFLOWS
  ========================================================= */

  async getWorkflows() {
    const { data } = await api.get("/workflows");

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.workflows)) {
      return data.workflows;
    }

    return [];
  },

  async getWorkflow(workflowId) {
    if (!workflowId) {
      throw new Error("Workflow ID is required.");
    }

    const { data } = await api.get(
      `/workflows/${workflowId}`,
    );

    return data?.workflow || data;
  },

  /* =========================================================
     CREATE WORKFLOW
  ========================================================= */

  async createWorkflow({
    workflowName,
    workflowType,
    processDescription,
    workflowData = {},
    status = "draft",
  }) {
    if (!workflowName?.trim()) {
      throw new Error(
        "Workflow name is required.",
      );
    }

    if (!workflowType?.trim()) {
      throw new Error(
        "Workflow type is required.",
      );
    }

    if (!processDescription?.trim()) {
      throw new Error(
        "Process description is required.",
      );
    }

    const payload = {
      workflow_name:
        workflowName.trim(),

      workflow_type:
        workflowType.trim(),

      process_description:
        processDescription.trim(),

      workflow_data:
        workflowData &&
        typeof workflowData === "object"
          ? workflowData
          : {},

      status,
    };

    const { data } = await api.post(
      "/workflows",
      payload,
    );

    return data;
  },

  /* =========================================================
     UPDATE WORKFLOW
  ========================================================= */

  async updateWorkflow(
    workflowId,
    {
      workflowName,
      workflowType,
      processDescription,
      workflowData = {},
      status = "draft",
    },
  ) {
    if (!workflowId) {
      throw new Error(
        "Workflow ID is required.",
      );
    }

    if (!workflowName?.trim()) {
      throw new Error(
        "Workflow name is required.",
      );
    }

    if (!workflowType?.trim()) {
      throw new Error(
        "Workflow type is required.",
      );
    }

    if (!processDescription?.trim()) {
      throw new Error(
        "Process description is required.",
      );
    }

    const payload = {
      workflow_name:
        workflowName.trim(),

      workflow_type:
        workflowType.trim(),

      process_description:
        processDescription.trim(),

      workflow_data:
        workflowData &&
        typeof workflowData === "object"
          ? workflowData
          : {},

      status,
    };

    const { data } = await api.put(
      `/workflows/${workflowId}`,
      payload,
    );

    return data;
  },

  /* =========================================================
     DELETE WORKFLOW
  ========================================================= */

  async deleteWorkflow(workflowId) {
    if (!workflowId) {
      throw new Error(
        "Workflow ID is required.",
      );
    }

    const { data } = await api.delete(
      `/workflows/${workflowId}`,
    );

    return data;
  },

  /* =========================================================
     EMPLOYEES
  ========================================================= */

  async getEmployees() {
    const { data } =
      await api.get("/employees");

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.employees)) {
      return data.employees;
    }

    return [];
  },

  /* =========================================================
     START WORKFLOW
  =========================================================
  
     This creates an actual workflow RUN.

     Example:

     Workflow:
       Employee Resignation

     Employee:
       Rahul Sharma

     Result:
       hr_workflow_runs row is created.
  ========================================================= */

  async startWorkflow(
    workflowId,
    employeeId,
  ) {
    if (!workflowId) {
      throw new Error(
        "Workflow ID is required.",
      );
    }

    if (!employeeId) {
      throw new Error(
        "Employee ID is required.",
      );
    }

    const { data } = await api.post(
      `/workflows/${workflowId}/runs`,
      {
        employee_id: employeeId,
      },
    );

    return data?.run || data;
  },

  /* =========================================================
     GET ALL WORKFLOW RUNS
  ========================================================= */

  async getWorkflowRuns() {
    const { data } =
      await api.get(
        "/workflows/runs",
      );

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.runs)) {
      return data.runs;
    }

    return [];
  },

  /* =========================================================
     GET SINGLE WORKFLOW RUN
  ========================================================= */

  async getWorkflowRun(runId) {
    if (!runId) {
      throw new Error(
        "Workflow run ID is required.",
      );
    }

    const { data } =
      await api.get(
        `/workflows/runs/${runId}`,
      );

    return data?.run || data;
  },

  /* =========================================================
     COMPLETE / APPROVE CURRENT STEP
  =========================================================

     IMPORTANT:

     This method is ONLY for a human-controlled step.

     Automated steps should be processed by the backend
     execution engine and should NOT require the user
     to press "Complete Step".

     For approvalRequired === true:

       status = "completed"
         -> approval granted

       status = "rejected"
         -> approval denied
  ========================================================= */

  async completeWorkflowStep(
    runId,
    stepIndex,
    notes = "",
    status = "completed",
  ) {
    if (!runId) {
      throw new Error(
        "Workflow run ID is required.",
      );
    }

    if (
      stepIndex === undefined ||
      stepIndex === null ||
      Number.isNaN(
        Number(stepIndex),
      )
    ) {
      throw new Error(
        "Workflow step index is required.",
      );
    }

    if (
      !["completed", "rejected"].includes(
        status,
      )
    ) {
      throw new Error(
        "Invalid workflow step status.",
      );
    }

    const payload = {
      status,
      notes:
        typeof notes === "string"
          ? notes.trim()
          : "",
    };

    const { data } =
      await api.put(
        `/workflows/runs/${runId}/steps/${stepIndex}`,
        payload,
      );

    return data?.run || data;
  },

  /* =========================================================
     APPROVE WORKFLOW STEP
  ========================================================= */

  async approveWorkflowStep(
    runId,
    stepIndex,
    notes = "",
  ) {
    return this.completeWorkflowStep(
      runId,
      stepIndex,
      notes,
      "completed",
    );
  },

  /* =========================================================
     REJECT WORKFLOW STEP
  ========================================================= */

  async rejectWorkflowStep(
    runId,
    stepIndex,
    notes = "",
  ) {
    return this.completeWorkflowStep(
      runId,
      stepIndex,
      notes,
      "rejected",
    );
  },

  /* =========================================================
     CANCEL WORKFLOW RUN
  ========================================================= */

  async cancelWorkflowRun(runId) {
    if (!runId) {
      throw new Error(
        "Workflow run ID is required.",
      );
    }

    const { data } =
      await api.post(
        `/workflows/runs/${runId}/cancel`,
      );

    return data?.run || data;
  },
};

export default workflowService;