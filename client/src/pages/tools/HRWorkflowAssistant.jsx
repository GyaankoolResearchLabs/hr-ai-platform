import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import workflowService from "../../services/workflowService";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  GripVertical,
  Plus,
  Play,
  Save,
  Trash2,
  UserRound,
  X,
  Workflow,
  AlertTriangle,
} from "lucide-react";

/* =========================================================
   CONSTANTS
========================================================= */

const WORKFLOW_TYPES = [
  {
    value: "employee-lifecycle",
    label: "Employee Lifecycle",
  },
  {
    value: "leave",
    label: "Leave & Attendance",
  },
  {
    value: "documents",
    label: "Documents & Compliance",
  },
  {
    value: "onboarding",
    label: "Onboarding",
  },
  {
    value: "offboarding",
    label: "Offboarding",
  },
  {
    value: "payroll",
    label: "Payroll",
  },
  {
    value: "approval",
    label: "Approvals",
  },
  {
    value: "other",
    label: "Other HR Process",
  },
];

const OWNER_OPTIONS = [
  "HR",
  "HR Manager",
  "Manager",
  "Employee",
  "Payroll",
  "Finance",
  "IT",
  "Admin",
];

/* =========================================================
   HELPERS
========================================================= */

function createStep({
  title,
  description,
  owner = "HR",
  deadline = "",
  approvalRequired = false,
}) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    title,
    description,
    owner,
    deadline,
    approvalRequired,
  };
}

function createDefaultSteps() {
  return [
    createStep({
      title: "Review request",
      description:
        "HR reviews the request and confirms that the required information has been provided.",
      owner: "HR",
    }),
    createStep({
      title: "Verify required information",
      description:
        "Check the employee details and supporting information before proceeding.",
      owner: "HR",
    }),
    createStep({
      title: "Manager approval",
      description:
        "The responsible manager reviews the request and provides approval where required.",
      owner: "Manager",
      approvalRequired: true,
    }),
  ];
}

/* =========================================================
   PAGE
========================================================= */

export default function HRWorkflowAssistant() {
  const navigate = useNavigate();

  const [workflowName, setWorkflowName] = useState("");
  const [workflowType, setWorkflowType] =
    useState("employee-lifecycle");

  const [processDescription, setProcessDescription] =
    useState("");

  const [steps, setSteps] = useState([]);

  const [generating, setGenerating] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [workflowId, setWorkflowId] =
    useState(null);

  const [savedWorkflows, setSavedWorkflows] =
    useState([]);

  const [loadingWorkflows, setLoadingWorkflows] =
    useState(true);

  const [error, setError] =
    useState("");

  const [selectedStepId, setSelectedStepId] =
    useState(null);

  const [employees, setEmployees] =
    useState([]);

  const [loadingEmployees, setLoadingEmployees] =
    useState(false);

  const [startWorkflow, setStartWorkflow] =
    useState(null);

  const [selectedEmployeeId, setSelectedEmployeeId] =
    useState("");

  const [startingRun, setStartingRun] =
    useState(false);

  const [activeRun, setActiveRun] =
    useState(null);

  /* =======================================================
     LOAD SAVED WORKFLOWS
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function loadSavedWorkflows() {
      setLoadingWorkflows(true);

      try {
        const data =
          await workflowService.getWorkflows();

        if (mounted) {
          const workflows =
            Array.isArray(data) ? data : [];

          setSavedWorkflows(workflows);

          // Restore the most recently saved workflow
          // when returning to this page. This prevents
          // a saved workflow from appearing to disappear
          // simply because the React page was remounted.
          if (workflows.length > 0) {
            handleOpenWorkflow(workflows[0]);
          }
        }
      } catch (err) {
        console.error(
          "Load workflows error:",
          err,
        );

        if (mounted) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              "Could not load saved workflows.",
          );
        }
      } finally {
        if (mounted) {
          setLoadingWorkflows(false);
        }
      }
    }

    loadSavedWorkflows();

    return () => {
      mounted = false;
    };
  }, []);

  /* =======================================================
     RESET EDITOR
  ======================================================= */

  function handleNewWorkflow() {
    setWorkflowId(null);
    setWorkflowName("");
    setWorkflowType("employee-lifecycle");
    setProcessDescription("");
    setSteps([]);
    setSelectedStepId(null);
    setSaved(false);
    setError("");
  }

  /* =======================================================
     OPEN SAVED WORKFLOW
  ======================================================= */

  function handleOpenWorkflow(workflow) {
    try {
      const workflowData =
        workflow?.workflow_data || {};

      const storedSteps =
        Array.isArray(workflowData.steps)
          ? workflowData.steps
          : [];

      const restoredSteps =
        storedSteps.map((step, index) => ({
          id:
            step.id ||
            `${workflow.id}-${index}`,
          title:
            step.title ||
            `Workflow step ${index + 1}`,
          description:
            step.description || "",
          owner:
            step.owner || "HR",
          deadline:
            step.deadline || "",
          approvalRequired:
            Boolean(
              step.approvalRequired,
            ),
        }));

      setWorkflowId(workflow.id);
      setWorkflowName(
        workflow.workflow_name || "",
      );
      setWorkflowType(
        workflow.workflow_type ||
          "employee-lifecycle",
      );
      setProcessDescription(
        workflow.process_description || "",
      );
      setSteps(restoredSteps);
      setSelectedStepId(
        restoredSteps[0]?.id || null,
      );
      setSaved(false);
      setError("");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      console.error(
        "Open workflow error:",
        err,
      );

      setError(
        "Could not open this workflow.",
      );
    }
  }

  /* =======================================================
     START WORKFLOW RUN
  ======================================================= */

  async function handleOpenStartWorkflow(workflow) {
    try {
      setError("");
      setLoadingEmployees(true);
      setStartWorkflow(workflow);
      setSelectedEmployeeId("");

      const data =
        await workflowService.getEmployees();

      const employeeList =
        Array.isArray(data) ? data : [];

      setEmployees(employeeList);

      if (employeeList.length === 1) {
        setSelectedEmployeeId(
          employeeList[0]?.id ||
            employeeList[0]?.employee_id ||
            "",
        );
      }
    } catch (err) {
      console.error(
        "Load employees for workflow start error:",
        err,
      );
      setStartWorkflow(null);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not load employees.",
      );
    } finally {
      setLoadingEmployees(false);
    }
  }

  function handleCloseStartWorkflow() {
    if (startingRun) return;

    setStartWorkflow(null);
    setSelectedEmployeeId("");
  }

  async function handleStartWorkflowRun() {
    if (!startWorkflow?.id) {
      setError("Workflow ID is missing.");
      return;
    }

    if (!selectedEmployeeId) {
      setError("Select an employee before starting the workflow.");
      return;
    }

    try {
      setStartingRun(true);
      setError("");

      const run =
        await workflowService.startWorkflow(
          startWorkflow.id,
          selectedEmployeeId,
        );

      setActiveRun(run);
      setStartWorkflow(null);
      setSelectedEmployeeId("");
    } catch (err) {
      console.error(
        "Start workflow error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not start workflow.",
      );
    } finally {
      setStartingRun(false);
    }
  }

  /* =======================================================
     DELETE SAVED WORKFLOW
  ======================================================= */

  async function handleDeleteWorkflow(
    workflowIdToDelete,
  ) {
    const confirmed = window.confirm(
      "Delete this workflow? This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await workflowService.deleteWorkflow(
        workflowIdToDelete,
      );

      setSavedWorkflows((current) =>
        current.filter(
          (workflow) =>
            workflow.id !==
            workflowIdToDelete,
        ),
      );

      if (
        workflowId ===
        workflowIdToDelete
      ) {
        handleNewWorkflow();
      }
    } catch (err) {
      console.error(
        "Delete workflow error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not delete workflow.",
      );
    }
  }

  /* =======================================================
     GENERATE WORKFLOW
  ======================================================= */

  function handleGenerateWorkflow() {
    setError("");
    setSaved(false);

    if (!workflowName.trim()) {
      setError("Enter a workflow name first.");
      return;
    }

    if (!processDescription.trim()) {
      setError(
        "Describe the HR process before generating the workflow."
      );
      return;
    }

    setGenerating(true);

    /*
      This first version uses structured templates rather
      than pretending that an AI API is connected.

      We can connect the AI service after the workflow UI
      and data model are finalized.
    */

    setTimeout(() => {
      const description =
        processDescription.toLowerCase();

      let generatedSteps;

      if (
        description.includes("resign") ||
        description.includes("exit") ||
        description.includes("leav")
      ) {
        generatedSteps = [
          createStep({
            title: "Receive employee request",
            description:
              "Record the employee resignation or exit request and confirm that the submission is complete.",
            owner: "HR",
          }),

          createStep({
            title: "Review resignation details",
            description:
              "HR reviews the resignation date, notice period, employee information, and supporting details.",
            owner: "HR",
          }),

          createStep({
            title: "Manager review and approval",
            description:
              "The employee's manager reviews the resignation and confirms the next steps.",
            owner: "Manager",
            approvalRequired: true,
          }),

          createStep({
            title: "Initiate exit checklist",
            description:
              "Create the required exit tasks including document collection, asset return, and access closure.",
            owner: "HR",
          }),

          createStep({
            title: "Conduct exit interview",
            description:
              "Schedule and complete the employee exit interview.",
            owner: "HR",
          }),

          createStep({
            title: "Final settlement review",
            description:
              "Coordinate with payroll or finance to review the employee's final settlement requirements.",
            owner: "Payroll",
          }),

          createStep({
            title: "Close employee record",
            description:
              "Complete the exit checklist and close the employee's active HR record.",
            owner: "HR",
          }),
        ];
      } else if (
        description.includes("onboard") ||
        description.includes("joining")
      ) {
        generatedSteps = [
          createStep({
            title: "Receive onboarding request",
            description:
              "Confirm the employee's joining information and onboarding requirements.",
            owner: "HR",
          }),

          createStep({
            title: "Collect employee documents",
            description:
              "Collect and review the documents required to create the employee record.",
            owner: "HR",
          }),

          createStep({
            title: "Create employee record",
            description:
              "Create the employee profile and record the required employment information.",
            owner: "HR",
          }),

          createStep({
            title: "Prepare access and equipment",
            description:
              "Coordinate with IT and administration for system access and required equipment.",
            owner: "IT",
          }),

          createStep({
            title: "Complete joining formalities",
            description:
              "Complete the required joining documentation and onboarding checklist.",
            owner: "HR",
          }),
        ];
      } else if (
        description.includes("leave") ||
        description.includes("vacation")
      ) {
        generatedSteps = [
          createStep({
            title: "Receive leave request",
            description:
              "Capture the employee's requested leave dates and reason.",
            owner: "Employee",
          }),

          createStep({
            title: "Check leave balance",
            description:
              "Verify the employee's available leave balance and applicable policy.",
            owner: "HR",
          }),

          createStep({
            title: "Manager approval",
            description:
              "Route the leave request to the responsible manager for approval.",
            owner: "Manager",
            approvalRequired: true,
          }),

          createStep({
            title: "Update leave record",
            description:
              "Record the approved leave in the employee's attendance and leave records.",
            owner: "HR",
          }),
        ];
      } else {
        generatedSteps =
          createDefaultSteps();
      }

      setSteps(generatedSteps);
      setSelectedStepId(
        generatedSteps[0]?.id || null
      );

      setGenerating(false);
    }, 700);
  }

  /* =======================================================
     STEP MANAGEMENT
  ======================================================= */

  function updateStep(stepId, field, value) {
    setSteps((current) =>
      current.map((step) =>
        step.id === stepId
          ? {
              ...step,
              [field]: value,
            }
          : step
      )
    );

    setSaved(false);
  }

  function addStep() {
    const newStep = createStep({
      title: "New workflow step",
      description:
        "Describe what needs to happen during this step.",
      owner: "HR",
    });

    setSteps((current) => [
      ...current,
      newStep,
    ]);

    setSelectedStepId(newStep.id);
    setSaved(false);
  }

  function removeStep(stepId) {
    setSteps((current) =>
      current.filter(
        (step) => step.id !== stepId
      )
    );

    if (selectedStepId === stepId) {
      setSelectedStepId(null);
    }

    setSaved(false);
  }

  function moveStep(stepId, direction) {
    setSteps((current) => {
      const index = current.findIndex(
        (step) => step.id === stepId
      );

      if (index === -1) {
        return current;
      }

      const newIndex =
        direction === "up"
          ? index - 1
          : index + 1;

      if (
        newIndex < 0 ||
        newIndex >= current.length
      ) {
        return current;
      }

      const updated = [...current];

      const [moved] = updated.splice(
        index,
        1
      );

      updated.splice(
        newIndex,
        0,
        moved
      );

      return updated;
    });

    setSaved(false);
  }

  /* =======================================================
     SAVE
  ======================================================= */

  async function handleSaveWorkflow() {
    setError("");
    setSaved(false);

    if (!workflowName.trim()) {
      setError(
        "Enter a workflow name before saving.",
      );
      return;
    }

    if (!processDescription.trim()) {
      setError(
        "Describe the HR process before saving.",
      );
      return;
    }

    if (steps.length === 0) {
      setError(
        "Add at least one workflow step before saving.",
      );
      return;
    }

    setSaving(true);

    try {
      const workflowData = {
        steps: steps.map((step, index) => ({
          ...step,
          order: index + 1,
        })),

        metadata: {
          stepCount: steps.length,

          approvalCount:
            steps.filter(
              (step) =>
                step.approvalRequired,
            ).length,

          owners: [
            ...new Set(
              steps.map(
                (step) => step.owner,
              ),
            ),
          ],
        },
      };

      let response;

      if (workflowId) {
        response =
          await workflowService.updateWorkflow(
            workflowId,
            {
              workflowName:
                workflowName.trim(),
              workflowType:
                workflowType,
              processDescription:
                processDescription.trim(),
              workflowData,
              status: "draft",
            },
          );
      } else {
        response =
          await workflowService.createWorkflow(
            {
              workflowName:
                workflowName.trim(),
              workflowType:
                workflowType,
              processDescription:
                processDescription.trim(),
              workflowData,
              status: "draft",
            },
          );
      }

      const savedWorkflow =
        response?.workflow;

      if (savedWorkflow?.id) {
        setWorkflowId(
          savedWorkflow.id,
        );

        setSavedWorkflows((current) => {
          const withoutCurrent =
            current.filter(
              (workflow) =>
                workflow.id !==
                savedWorkflow.id,
            );

          return [
            savedWorkflow,
            ...withoutCurrent,
          ];
        });
      }

      setSaved(true);
    } catch (err) {
      console.error(
        "Workflow save error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not save workflow. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedStep = useMemo(
    () =>
      steps.find(
        (step) =>
          step.id === selectedStepId
      ) || null,
    [steps, selectedStepId]
  );

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-full min-w-0">

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

        <div className="min-w-0">

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-2 text-sm text-ink-500 transition hover:text-ink-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2 text-sm text-brand-700">
            <Workflow className="h-4 w-4" />
            Documents & HR Workflows
          </div>

          <h1 className="mt-2 text-2xl font-semibold text-ink-950">
            HR Workflow Assistant
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Turn HR processes into structured,
            repeatable workflows with clear
            owners, approvals, and deadlines.
          </p>

        </div>

        <div className="flex shrink-0 items-center gap-2">
          {workflowId ? (
            <button
              type="button"
              onClick={handleNewWorkflow}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              <Plus className="h-4 w-4" />
              New Workflow
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleSaveWorkflow}
            disabled={
              saving ||
              steps.length === 0
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                <Save className="h-4 w-4" />
                {workflowId
                  ? "Update Workflow"
                  : "Save Workflow"}
              </>
            )}
          </button>
        </div>

      </div>

      {/* ===================================================
          ERROR
      =================================================== */}

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">

          <div className="flex gap-3">

            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <div>

              <p className="text-sm font-semibold text-red-900">
                Something needs attention
              </p>

              <p className="mt-1 text-sm text-red-700">
                {error}
              </p>

            </div>

          </div>

        </div>
      ) : null}

      {/* ===================================================
          SAVED
      =================================================== */}

      {saved ? (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">

          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />

          <div>

            <p className="text-sm font-semibold text-green-900">
              Workflow saved
            </p>

            <p className="mt-0.5 text-sm text-green-700">
              Your workflow has been saved successfully
              and is available in your HR workflows.
            </p>

          </div>

        </div>
      ) : null}

      {/* ===================================================
          SAVED WORKFLOWS
      =================================================== */}

      <div className="mb-6 rounded-xl border border-ink-100 bg-white p-5">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h2 className="text-base font-semibold text-ink-900">
              Saved workflows
            </h2>

            <p className="mt-1 text-sm text-ink-500">
              Your saved HR workflows are stored and can be reopened or deleted.
            </p>
          </div>

          <button
            type="button"
            onClick={handleNewWorkflow}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
          >
            <Plus className="h-4 w-4" />
            New workflow
          </button>

        </div>

        <div className="mt-4">

          {loadingWorkflows ? (
            <div className="rounded-lg border border-dashed border-ink-200 px-4 py-5 text-sm text-ink-500">
              Loading saved workflows...
            </div>
          ) : savedWorkflows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-ink-200 px-4 py-5 text-sm text-ink-500">
              No saved workflows yet. Create and save your first workflow above.
            </div>
          ) : (
            <div className="space-y-2">
              {savedWorkflows.map((workflow) => {
                const isCurrent =
                  workflow.id === workflowId;

                const workflowTypeLabel =
                  WORKFLOW_TYPES.find(
                    (item) =>
                      item.value ===
                      workflow.workflow_type,
                  )?.label ||
                  workflow.workflow_type ||
                  "Other HR Process";

                const stepCount =
                  Array.isArray(
                    workflow?.workflow_data?.steps,
                  )
                    ? workflow.workflow_data.steps.length
                    : 0;

                return (
                  <div
                    key={workflow.id}
                    className={`flex flex-col gap-3 rounded-lg border p-4 transition sm:flex-row sm:items-center sm:justify-between ${
                      isCurrent
                        ? "border-brand-200 bg-brand-50/40"
                        : "border-ink-100 bg-white hover:border-ink-200"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-ink-900">
                          {workflow.workflow_name}
                        </h3>

                        {isCurrent ? (
                          <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                            Open
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-xs text-ink-500">
                        {workflowTypeLabel} · {stepCount} {stepCount === 1 ? "step" : "steps"}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenStartWorkflow(workflow)
                        }
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-700"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Start Workflow
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleOpenWorkflow(workflow)
                        }
                        className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
                      >
                        Open
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteWorkflow(
                            workflow.id,
                          )
                        }
                        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white p-2 text-red-600 transition hover:bg-red-50"
                        title="Delete workflow"
                        aria-label={`Delete ${workflow.workflow_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

      {activeRun ? (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/40 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                Workflow execution
              </p>
              <h2 className="mt-1 text-base font-semibold text-ink-900">
                {startWorkflow?.workflow_name || workflowName}
              </h2>
              <p className="mt-1 text-sm text-ink-600">
                Run status: {activeRun.status || "in_progress"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveRun(null)}
              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700"
            >
              Hide
            </button>
          </div>

          {Array.isArray(activeRun?.execution_data?.timeline) &&
          activeRun.execution_data.timeline.length > 0 ? (
            <div className="mt-4 space-y-2">
              {activeRun.execution_data.timeline.map((item, index) => (
                <div
                  key={`${item.step_index ?? index}-${index}`}
                  className="rounded-lg border border-ink-100 bg-white px-3 py-2"
                >
                  <p className="text-sm font-medium text-ink-900">
                    {item.title || `Step ${index + 1}`}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {item.status || "processed"}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {startWorkflow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  Start Workflow
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Select the employee for this workflow run.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseStartWorkflow}
                disabled={startingRun}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-medium text-ink-800">
                Employee
              </label>

              {loadingEmployees ? (
                <div className="rounded-lg border border-ink-200 px-3 py-2.5 text-sm text-ink-500">
                  Loading employees...
                </div>
              ) : (
                <select
                  value={selectedEmployeeId}
                  onChange={(event) =>
                    setSelectedEmployeeId(event.target.value)
                  }
                  disabled={startingRun}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400"
                >
                  <option value="">Select an employee</option>
                  {employees.map((employee) => {
                    const id =
                      employee.id ||
                      employee.employee_id;
                    const name =
                      employee.name ||
                      `${employee.first_name || ""} ${employee.last_name || ""}`.trim() ||
                      employee.email ||
                      "Employee";

                    return (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              )}

              {!loadingEmployees && employees.length === 0 ? (
                <p className="mt-2 text-xs text-red-600">
                  No employees are available. Add an employee first.
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseStartWorkflow}
                disabled={startingRun}
                className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleStartWorkflowRun}
                disabled={
                  loadingEmployees ||
                  startingRun ||
                  !selectedEmployeeId
                }
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {startingRun ? "Starting..." : "Start Workflow"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===================================================
          WORKFLOW DETAILS
      =================================================== */}

      <div className="mb-6 rounded-xl border border-ink-100 bg-white p-5">

        <div className="mb-5">

          <div className="flex items-center gap-2">

            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <ClipboardList className="h-4 w-4" />
            </span>

            <div>

              <h2 className="text-base font-semibold text-ink-900">
                Workflow details
              </h2>

              <p className="mt-0.5 text-sm text-ink-500">
                Start by describing the HR process
                you want to standardize.
              </p>

            </div>

          </div>

        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* WORKFLOW NAME */}

          <div>

            <label className="mb-1.5 block text-sm font-medium text-ink-800">
              Workflow name
            </label>

            <input
              type="text"
              value={workflowName}
              onChange={(event) => {
                setWorkflowName(
                  event.target.value
                );
                setSaved(false);
              }}
              placeholder="e.g. Employee Resignation"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-400"
            />

          </div>

          {/* WORKFLOW TYPE */}

          <div>

            <label className="mb-1.5 block text-sm font-medium text-ink-800">
              Workflow type
            </label>

            <div className="relative">

              <select
                value={workflowType}
                onChange={(event) =>
                  setWorkflowType(
                    event.target.value
                  )
                }
                className="w-full appearance-none rounded-lg border border-ink-200 bg-white px-3 py-2.5 pr-9 text-sm text-ink-700 outline-none transition focus:border-brand-400"
              >
                {WORKFLOW_TYPES.map(
                  (type) => (
                    <option
                      key={type.value}
                      value={type.value}
                    >
                      {type.label}
                    </option>
                  )
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

            </div>

          </div>

        </div>

      </div>

      {/* ===================================================
          PROCESS DESCRIPTION
      =================================================== */}

      <div className="mb-6 rounded-xl border border-ink-100 bg-white p-5">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

          <div>

            <div className="flex items-center gap-2">

              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Bot className="h-4 w-4" />
              </span>

              <div>

                <h2 className="text-base font-semibold text-ink-900">
                  Describe your HR process
                </h2>

                <p className="mt-0.5 text-sm text-ink-500">
                  Explain the process in your own
                  words. We will turn it into structured
                  workflow steps.
                </p>

              </div>

            </div>

          </div>

          <button
            type="button"
            onClick={() =>
              setProcessDescription(
                "When an employee resigns, HR should review the resignation, verify the notice period, get manager approval, collect company assets, schedule the exit interview, coordinate final settlement, and close the employee record."
              )
            }
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            Use example
          </button>

        </div>

        <textarea
          rows={7}
          value={processDescription}
          onChange={(event) => {
            setProcessDescription(
              event.target.value
            );
            setSaved(false);
          }}
          placeholder="Example: When an employee submits a resignation, HR should verify the notice period, notify the manager, collect company assets, schedule the exit interview, coordinate final settlement, and close the employee record."
          className="mt-5 w-full resize-y rounded-lg border border-ink-200 px-3 py-3 text-sm leading-relaxed text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-400"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <p className="text-xs leading-relaxed text-ink-400">
            Tip: Include who performs each action,
            approvals, documents, and important
            deadlines if you know them.
          </p>

          <button
            type="button"
            onClick={handleGenerateWorkflow}
            disabled={generating}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? (
              "Generating..."
            ) : (
              <>
                <Workflow className="h-4 w-4" />
                Generate Workflow
              </>
            )}
          </button>

        </div>

      </div>

      {/* ===================================================
          WORKFLOW BUILDER
      =================================================== */}

      {steps.length > 0 ? (

        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">

          {/* =================================================
              WORKFLOW STEPS
          ================================================= */}

          <div className="min-w-0 rounded-xl border border-ink-100 bg-white">

            <div className="flex flex-col gap-3 border-b border-ink-100 p-5 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <h2 className="text-base font-semibold text-ink-900">
                  Workflow steps
                </h2>

                <p className="mt-1 text-sm text-ink-500">
                  {steps.length} step
                  {steps.length === 1
                    ? ""
                    : "s"} in this workflow.
                </p>

              </div>

              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
              >
                <Plus className="h-4 w-4" />
                Add Step
              </button>

            </div>

            <div className="space-y-3 p-5">

              {steps.map(
                (step, index) => {

                  const isSelected =
                    selectedStepId ===
                    step.id;

                  return (
                    <div
                      key={step.id}
                      className={`rounded-xl border transition ${
                        isSelected
                          ? "border-brand-300 bg-brand-50/30"
                          : "border-ink-100 bg-white hover:border-ink-200"
                      }`}
                    >

                      <div className="flex items-start gap-3 p-4">

                        <div className="mt-1 flex shrink-0 items-center gap-2">

                          <GripVertical className="h-4 w-4 text-ink-300" />

                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
                            {index + 1}
                          </span>

                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedStepId(
                              isSelected
                                ? null
                                : step.id
                            )
                          }
                          className="min-w-0 flex-1 text-left"
                        >

                          <div className="flex flex-wrap items-center gap-2">

                            <p className="text-sm font-semibold text-ink-900">
                              {step.title ||
                                "Untitled step"}
                            </p>

                            {step.approvalRequired ? (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                Approval required
                              </span>
                            ) : null}

                          </div>

                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-500">
                            {step.description}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-400">

                            <span className="inline-flex items-center gap-1">
                              <UserRound className="h-3.5 w-3.5" />
                              {step.owner}
                            </span>

                            {step.deadline ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5" />
                                {step.deadline}
                              </span>
                            ) : null}

                          </div>

                        </button>

                        <div className="flex shrink-0 items-center gap-1">

                          <button
                            type="button"
                            onClick={() =>
                              moveStep(
                                step.id,
                                "up"
                              )
                            }
                            disabled={index === 0}
                            className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Move up"
                          >
                            ↑
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              moveStep(
                                step.id,
                                "down"
                              )
                            }
                            disabled={
                              index ===
                              steps.length - 1
                            }
                            className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Move down"
                          >
                            ↓
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removeStep(
                                step.id
                              )
                            }
                            className="rounded-md p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Delete step"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                        </div>

                      </div>

                      {isSelected ? (

                        <div className="border-t border-ink-100 bg-ink-50/40 p-4">

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                            {/* TITLE */}

                            <div className="sm:col-span-2">

                              <label className="mb-1.5 block text-sm font-medium text-ink-800">
                                Step name
                              </label>

                              <input
                                type="text"
                                value={step.title}
                                onChange={(event) =>
                                  updateStep(
                                    step.id,
                                    "title",
                                    event.target
                                      .value
                                  )
                                }
                                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400"
                              />

                            </div>

                            {/* DESCRIPTION */}

                            <div className="sm:col-span-2">

                              <label className="mb-1.5 block text-sm font-medium text-ink-800">
                                What happens?
                              </label>

                              <textarea
                                rows={3}
                                value={
                                  step.description
                                }
                                onChange={(event) =>
                                  updateStep(
                                    step.id,
                                    "description",
                                    event.target
                                      .value
                                  )
                                }
                                className="w-full resize-none rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-ink-900 outline-none focus:border-brand-400"
                              />

                            </div>

                            {/* OWNER */}

                            <div>

                              <label className="mb-1.5 block text-sm font-medium text-ink-800">
                                Owner
                              </label>

                              <div className="relative">

                                <select
                                  value={
                                    step.owner
                                  }
                                  onChange={(event) =>
                                    updateStep(
                                      step.id,
                                      "owner",
                                      event.target
                                        .value
                                    )
                                  }
                                  className="w-full appearance-none rounded-lg border border-ink-200 bg-white px-3 py-2.5 pr-9 text-sm text-ink-700 outline-none focus:border-brand-400"
                                >
                                  {OWNER_OPTIONS.map(
                                    (owner) => (
                                      <option
                                        key={owner}
                                        value={owner}
                                      >
                                        {owner}
                                      </option>
                                    )
                                  )}
                                </select>

                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

                              </div>

                            </div>

                            {/* DEADLINE */}

                            <div>

                              <label className="mb-1.5 block text-sm font-medium text-ink-800">
                                Deadline
                              </label>

                              <input
                                type="text"
                                value={
                                  step.deadline
                                }
                                onChange={(event) =>
                                  updateStep(
                                    step.id,
                                    "deadline",
                                    event.target
                                      .value
                                  )
                                }
                                placeholder="e.g. Within 2 business days"
                                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-400"
                              />

                            </div>

                          </div>

                          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-ink-200 bg-white p-3">

                            <input
                              type="checkbox"
                              checked={
                                step.approvalRequired
                              }
                              onChange={(event) =>
                                updateStep(
                                  step.id,
                                  "approvalRequired",
                                  event.target
                                    .checked
                                )
                              }
                              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                            />

                            <div>

                              <p className="text-sm font-medium text-ink-800">
                                Approval required
                              </p>

                              <p className="mt-0.5 text-xs text-ink-500">
                                This step must be approved
                                before the workflow can
                                continue.
                              </p>

                            </div>

                          </label>

                        </div>

                      ) : null}

                    </div>
                  );
                }
              )}

            </div>

          </div>

          {/* =================================================
              WORKFLOW SUMMARY
          ================================================= */}

          <div className="min-w-0 space-y-4">

            <div className="rounded-xl border border-ink-100 bg-white p-5">

              <div className="flex items-center gap-2">

                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Workflow className="h-4 w-4" />
                </span>

                <div>

                  <h2 className="text-base font-semibold text-ink-900">
                    Workflow summary
                  </h2>

                  <p className="mt-0.5 text-sm text-ink-500">
                    Quick overview of your process.
                  </p>

                </div>

              </div>

              <div className="mt-5 space-y-4">

                <SummaryItem
                  label="Workflow"
                  value={
                    workflowName ||
                    "Untitled workflow"
                  }
                />

                <SummaryItem
                  label="Type"
                  value={
                    WORKFLOW_TYPES.find(
                      (item) =>
                        item.value ===
                        workflowType
                    )?.label ||
                    "Other HR Process"
                  }
                />

                <SummaryItem
                  label="Steps"
                  value={String(steps.length)}
                />

                <SummaryItem
                  label="Approvals"
                  value={String(
                    steps.filter(
                      (step) =>
                        step.approvalRequired
                    ).length
                  )}
                />

              </div>

            </div>

            {/* PROCESS FLOW */}

            <div className="rounded-xl border border-ink-100 bg-white p-5">

              <h3 className="text-sm font-semibold text-ink-900">
                Process flow
              </h3>

              <div className="mt-4 space-y-0">

                {steps.map(
                  (step, index) => (
                    <div
                      key={step.id}
                      className="flex gap-3"
                    >

                      <div className="flex flex-col items-center">

                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                          {index + 1}
                        </span>

                        {index <
                        steps.length - 1 ? (
                          <span className="h-full min-h-7 w-px bg-ink-200" />
                        ) : null}

                      </div>

                      <div className="min-w-0 pb-4">

                        <p className="text-sm font-medium text-ink-800">
                          {step.title ||
                            "Untitled step"}
                        </p>

                        <p className="mt-0.5 text-xs text-ink-400">
                          {step.owner}
                        </p>

                      </div>

                    </div>
                  )
                )}

              </div>

            </div>

            {/* HUMAN CONTROL NOTICE */}

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">

              <div className="flex gap-3">

                <Bot className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

                <div>

                  <h3 className="text-sm font-semibold text-blue-900">
                    HR stays in control
                  </h3>

                  <p className="mt-1 text-sm leading-relaxed text-blue-800">
                    The assistant structures the
                    workflow, but HR reviews and
                    controls every step, owner,
                    deadline, and approval requirement.
                  </p>

                </div>

              </div>

            </div>

          </div>

        </div>

      ) : (

        /* =================================================
           EMPTY BUILDER STATE
        ================================================= */

        <div className="rounded-xl border border-dashed border-ink-200 bg-white px-5 py-14">

          <div className="mx-auto max-w-lg text-center">

            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <Workflow className="h-7 w-7" />
            </span>

            <h2 className="mt-5 text-base font-semibold text-ink-900">
              Your workflow will appear here
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Describe an HR process above and
              generate a structured workflow. You can
              then review, edit, reorder, and save the
              individual steps.
            </p>

          </div>

        </div>

      )}

    </div>
  );
}

/* =========================================================
   SUMMARY ITEM
========================================================= */

function SummaryItem({
  label,
  value,
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 pb-3 last:border-b-0 last:pb-0">

      <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
        {label}
      </span>

      <span className="max-w-[60%] text-right text-sm font-medium text-ink-800">
        {value}
      </span>

    </div>
  );
}