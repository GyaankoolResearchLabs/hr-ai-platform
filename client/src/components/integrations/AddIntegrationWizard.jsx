import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Database,
  Globe,
  HelpCircle,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Upload,
  Webhook,
  X,
} from "lucide-react";

/* ============================================================================
   HR SYSTEMS
============================================================================ */

const SYSTEMS = [
  {
    id: "bamboohr",
    name: "BambooHR",
    provider: "BambooHR",
    description:
      "Connect employee information and HR data from BambooHR.",
    icon: "database",
  },
  {
    id: "workday",
    name: "Workday",
    provider: "Workday",
    description:
      "Connect employee, workforce, and HR information from Workday.",
    icon: "database",
  },
  {
    id: "sap_successfactors",
    name: "SAP SuccessFactors",
    provider: "SAP SuccessFactors",
    description:
      "Connect employee and HR information from SAP SuccessFactors.",
    icon: "database",
  },
  {
    id: "adp",
    name: "ADP",
    provider: "ADP",
    description:
      "Connect employee, payroll, and workforce information from ADP.",
    icon: "database",
  },
  {
    id: "greenhouse",
    name: "Greenhouse",
    provider: "Greenhouse",
    description:
      "Connect recruitment, candidate, and hiring information.",
    icon: "database",
  },
  {
    id: "other",
    name: "Another HR system",
    provider: "",
    description:
      "Connect another HR application used by your organization.",
    icon: "globe",
  },
];

/* ============================================================================
   DATA FLOW OPTIONS
============================================================================ */

const DATA_DIRECTIONS = [
  {
    id: "inbound",
    title: "Bring information into HR AI Platform",
    shortTitle: "HR system → HR AI Platform",
    description:
      "Employee and HR information will come from your HR system into HR AI Platform.",
    example:
      "Example: Employee information from Workday is brought into HR AI Platform.",
    icon: ArrowRight,
  },
  {
    id: "outbound",
    title: "Send information to your HR system",
    shortTitle: "HR AI Platform → HR system",
    description:
      "Information from HR AI Platform will be sent to your connected HR system.",
    example:
      "Example: Approved HR information can be sent back to your HR system.",
    icon: ArrowLeft,
  },
  {
    id: "bidirectional",
    title: "Keep both systems synchronized",
    shortTitle: "Both systems",
    description:
      "Information can move in both directions so the systems stay synchronized.",
    example:
      "Example: Changes made in either system can be synchronized when supported.",
    icon: RefreshCw,
  },
];

/* ============================================================================
   SYNC OPTIONS
============================================================================ */

const SYNC_OPTIONS = [
  {
    id: "manual",
    title: "Only when I choose to sync",
    description:
      "You decide when HR AI Platform should check for updates.",
    recommendedFor:
      "Good for testing or when you want full control.",
  },
  {
    id: "hourly",
    title: "Every hour",
    description:
      "Automatically check for new or changed information every hour.",
    recommendedFor:
      "Useful when your HR information changes frequently.",
  },
  {
    id: "daily",
    title: "Every day",
    description:
      "Automatically synchronize your HR information once a day.",
    recommendedFor:
      "A simple option for regular HR data updates.",
  },
  {
    id: "weekly",
    title: "Every week",
    description:
      "Automatically synchronize your HR information once a week.",
    recommendedFor:
      "Useful when HR data does not change frequently.",
  },
];

/* ============================================================================
   CONNECTION TYPES
============================================================================ */

const CONNECTION_TYPES = [
  {
    id: "rest_api",
    title: "API",
    description:
      "Connect directly to your HR software through its API.",
    explanation:
      "Choose this when your HR software provides an API for external applications.",
    icon: Globe,
  },
  {
    id: "webhook",
    title: "Webhook",
    description:
      "Your HR software sends updates to HR AI Platform when information changes.",
    explanation:
      "Choose this when your HR software can send automatic notifications or updates.",
    icon: Webhook,
  },
  {
    id: "file",
    title: "File",
    description:
      "Exchange HR information using files such as CSV files.",
    explanation:
      "Choose this when your HR team exchanges employee data through files.",
    icon: Upload,
  },
  {
    id: "database",
    title: "Database",
    description:
      "Connect HR AI Platform to an approved company database.",
    explanation:
      "Choose this when your organization stores HR information in a database that can be connected.",
    icon: Database,
  },
  {
    id: "custom",
    title: "Custom connection",
    description:
      "Use a custom connection provided by your organization's IT team.",
    explanation:
      "Choose this when your connection does not fit the other options.",
    icon: Link2,
  },
];

/* ============================================================================
   AUTHENTICATION OPTIONS
============================================================================ */

const AUTH_OPTIONS = [
  {
    id: "none",
    title: "No authentication",
    description:
      "Your HR system does not require credentials for this connection.",
  },
  {
    id: "api_key",
    title: "API key",
    description:
      "Your HR system gives you an API key for connecting applications.",
  },
  {
    id: "bearer",
    title: "Access token",
    description:
      "Your HR system gives you an access token for connecting applications.",
  },
  {
    id: "basic",
    title: "Username and password",
    description:
      "Your HR system uses a username and password to verify access.",
  },
];

/* ============================================================================
   INITIAL FORM
============================================================================ */

const INITIAL_FORM = {
  systemId: "",
  name: "",
  provider: "",
  description: "",

  purpose: "employee_data",

  integration_type: "rest_api",

  base_url: "",

  auth_type: "none",

  api_key: "",
  token: "",
  username: "",
  password: "",
  header_name: "x-api-key",

  sync_direction: "inbound",
  sync_frequency: "manual",

  status: "inactive",
};

/* ============================================================================
   COMPONENT
============================================================================ */

export default function AddIntegrationWizard({
  open,
  onClose,
  onSubmit,
  saving = false,
  editingIntegration = null,
}) {
  const isEditing = Boolean(editingIntegration);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");

  /* ==========================================================================
     INITIALIZE FORM
  ========================================================================== */

  useEffect(() => {
    if (!open) {
      return;
    }

    if (editingIntegration) {
      setForm({
        systemId: "other",

        name: editingIntegration.name || "",

        provider: editingIntegration.provider || "",

        description: editingIntegration.description || "",

        purpose: "employee_data",

        integration_type:
          editingIntegration.integration_type || "rest_api",

        base_url: editingIntegration.base_url || "",

        auth_type: editingIntegration.auth_type || "none",

        api_key: "",
        token: "",
        username: "",
        password: "",

        header_name: "x-api-key",

        sync_direction:
          editingIntegration.sync_direction || "inbound",

        sync_frequency:
          editingIntegration.sync_frequency || "manual",

        status:
          editingIntegration.status || "inactive",
      });

      setStep(3);
    } else {
      setForm(INITIAL_FORM);
      setStep(1);
    }

    setError("");
  }, [open, editingIntegration]);

  /* ==========================================================================
     CLOSED
  ========================================================================== */

  if (!open) {
    return null;
  }

  /* ==========================================================================
     HELPERS
  ========================================================================== */

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
  }

  function selectSystem(system) {
    setForm((current) => ({
      ...current,

      systemId: system.id,

      name:
        system.id === "other"
          ? ""
          : system.name,

      provider:
        system.provider || "",

      description:
        system.description || "",
    }));

    setError("");
  }

  function selectDirection(direction) {
    updateForm("sync_direction", direction);
  }

  function selectConnectionType(type) {
    setForm((current) => ({
      ...current,

      integration_type: type,

      base_url:
        type === "rest_api"
          ? current.base_url
          : "",
    }));

    setError("");
  }

  function selectAuthentication(type) {
    setForm((current) => ({
      ...current,

      auth_type: type,

      api_key:
        type === "api_key"
          ? current.api_key
          : "",

      token:
        type === "bearer"
          ? current.token
          : "",

      username:
        type === "basic"
          ? current.username
          : "",

      password:
        type === "basic"
          ? current.password
          : "",
    }));

    setError("");
  }

  /* ==========================================================================
     VALIDATION - STEP 1
  ========================================================================== */

  function validateStepOne() {
    if (!form.systemId) {
      setError(
        "Please choose the HR system your organization uses."
      );

      return false;
    }

    if (
      form.systemId === "other" &&
      !form.provider.trim()
    ) {
      setError(
        "Please enter the name of your HR system."
      );

      return false;
    }

    if (!form.name.trim()) {
      setError(
        "Please give this connection a name so your team can easily recognize it."
      );

      return false;
    }

    return true;
  }

  /* ==========================================================================
     VALIDATION - STEP 2
  ========================================================================== */

  function validateStepTwo() {
    if (!form.sync_direction) {
      setError(
        "Please choose how information should move between the systems."
      );

      return false;
    }

    if (!form.sync_frequency) {
      setError(
        "Please choose how often the information should be synchronized."
      );

      return false;
    }

    return true;
  }

  /* ==========================================================================
     VALIDATION - STEP 3
  ========================================================================== */

  function validateStepThree() {
    if (!form.integration_type) {
      setError(
        "Please choose how your HR system connects."
      );

      return false;
    }

    if (
      form.integration_type === "rest_api" &&
      !form.base_url.trim()
    ) {
      setError(
        "Please enter the API address provided by your HR system or IT team."
      );

      return false;
    }

    if (
      form.integration_type === "rest_api" &&
      form.base_url.trim()
    ) {
      try {
        new URL(form.base_url.trim());
      } catch {
        setError(
          "Please enter a valid API address, for example https://api.example.com"
        );

        return false;
      }
    }

    if (
      form.auth_type === "api_key" &&
      !form.api_key.trim()
    ) {
      setError(
        "Please enter the API key provided by your HR system or IT team."
      );

      return false;
    }

    if (
      form.auth_type === "bearer" &&
      !form.token.trim()
    ) {
      setError(
        "Please enter the access token provided by your HR system or IT team."
      );

      return false;
    }

    if (
      form.auth_type === "basic" &&
      (
        !form.username.trim() ||
        !form.password.trim()
      )
    ) {
      setError(
        "Please enter both the username and password."
      );

      return false;
    }

    return true;
  }

  /* ==========================================================================
     NAVIGATION
  ========================================================================== */

  function handleNext() {
    setError("");

    if (step === 1) {
      if (!validateStepOne()) {
        return;
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      if (!validateStepTwo()) {
        return;
      }

      setStep(3);
      return;
    }

    if (step === 3) {
      if (!validateStepThree()) {
        return;
      }

      setStep(4);
    }
  }

  function handleBack() {
    setError("");

    if (step > 1) {
      setStep((current) => current - 1);
    }
  }

  function handleClose() {
    if (saving) {
      return;
    }

    setError("");
    onClose();
  }

  /* ==========================================================================
     SUBMIT
  ========================================================================== */

  function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!validateStepOne()) {
      setStep(1);
      return;
    }

    if (!validateStepTwo()) {
      setStep(2);
      return;
    }

    if (!validateStepThree()) {
      setStep(3);
      return;
    }

    const payload = {
      name: form.name.trim(),

      provider: form.provider.trim(),

      description: form.description.trim(),

      integration_type:
        form.integration_type,

      base_url:
        form.base_url.trim(),

      auth_type:
        form.auth_type,

      sync_direction:
        form.sync_direction,

      sync_frequency:
        form.sync_frequency,

      status:
        form.status,
    };

    /* ------------------------------------------------------------------------
       CREDENTIALS
    ------------------------------------------------------------------------ */

    if (
      form.auth_type === "api_key" &&
      form.api_key.trim()
    ) {
      payload.credentials = {
        api_key:
          form.api_key.trim(),

        header_name:
          form.header_name.trim() ||
          "x-api-key",
      };
    }

    if (
      form.auth_type === "bearer" &&
      form.token.trim()
    ) {
      payload.credentials = {
        token:
          form.token.trim(),
      };
    }

    if (
      form.auth_type === "basic" &&
      form.username.trim() &&
      form.password.trim()
    ) {
      payload.credentials = {
        username:
          form.username.trim(),

        password:
          form.password,
      };
    }

    onSubmit(payload);
  }

  /* ==========================================================================
     CURRENT SYSTEM
  ========================================================================== */

  const selectedSystem =
    SYSTEMS.find(
      (system) =>
        system.id === form.systemId
    );

  const selectedDirection =
    DATA_DIRECTIONS.find(
      (option) =>
        option.id ===
        form.sync_direction
    );

  const selectedFrequency =
    SYNC_OPTIONS.find(
      (option) =>
        option.id ===
        form.sync_frequency
    );

  const selectedConnection =
    CONNECTION_TYPES.find(
      (option) =>
        option.id ===
        form.integration_type
    );

  const selectedAuth =
    AUTH_OPTIONS.find(
      (option) =>
        option.id ===
        form.auth_type
    );

  /* ==========================================================================
     RENDER
  ========================================================================== */

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          handleClose();
        }
      }}
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* ====================================================================
           HEADER
        ==================================================================== */}

        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">

          <div className="min-w-0">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Link2 size={19} />
              </div>

              <div className="min-w-0">

                <h2 className="text-lg font-semibold text-slate-900">
                  {isEditing
                    ? "Update HR System"
                    : "Connect an HR System"}
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  {isEditing
                    ? "Update how this HR system connects to your organization."
                    : "We'll guide you through the connection step by step."}
                </p>

              </div>

            </div>

          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            aria-label="Close"
            className="ml-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} />
          </button>

        </div>

        {/* ====================================================================
           PROGRESS
        ==================================================================== */}

        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">

          <div className="flex items-center justify-between">

            {[
              {
                number: 1,
                title: "Choose system",
              },
              {
                number: 2,
                title: "Data flow",
              },
              {
                number: 3,
                title: "Connect",
              },
              {
                number: 4,
                title: "Review",
              },
            ].map((item, index) => (
              <React.Fragment key={item.number}>

                <div className="flex items-center gap-2">

                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                      step > item.number
                        ? "bg-emerald-600 text-white"
                        : step === item.number
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-400 ring-1 ring-slate-200"
                    }`}
                  >
                    {step > item.number ? (
                      <Check size={15} />
                    ) : (
                      item.number
                    )}
                  </div>

                  <span
                    className={`hidden text-xs font-medium sm:block ${
                      step === item.number
                        ? "text-slate-900"
                        : "text-slate-400"
                    }`}
                  >
                    {item.title}
                  </span>

                </div>

                {index < 3 && (
                  <div
                    className={`mx-2 h-px flex-1 ${
                      step > item.number
                        ? "bg-emerald-300"
                        : "bg-slate-200"
                    }`}
                  />
                )}

              </React.Fragment>
            ))}

          </div>

        </div>

        {/* ====================================================================
           FORM
        ==================================================================== */}

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >

          {/* ==================================================================
             CONTENT
          ================================================================== */}

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">

            {/* ================================================================
               ERROR
            ================================================================ */}

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

                <span className="mt-0.5 shrink-0 font-semibold">
                  !
                </span>

                <p>{error}</p>

              </div>
            )}

            {/* ================================================================
               STEP 1
            ================================================================ */}

            {step === 1 && (
              <div>

                <div className="mb-7">

                  <h3 className="text-xl font-semibold text-slate-900">
                    Which HR system do you use?
                  </h3>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Select the HR software your organization
                    already uses. We will use your selection
                    to guide you through the connection.
                  </p>

                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                  {SYSTEMS.map((system) => {

                    const selected =
                      form.systemId ===
                      system.id;

                    return (
                      <button
                        key={system.id}
                        type="button"
                        onClick={() =>
                          selectSystem(system)
                        }
                        className={`group flex items-start gap-4 rounded-xl border p-4 text-left transition ${
                          selected
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >

                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                            selected
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {system.icon ===
                          "database" ? (
                            <Database size={19} />
                          ) : (
                            <Globe size={19} />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">

                          <div className="flex items-center justify-between gap-2">

                            <span className="text-sm font-semibold text-slate-900">
                              {system.name}
                            </span>

                            {selected && (
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                                <Check size={12} />
                              </span>
                            )}

                          </div>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {system.description}
                          </p>

                        </div>

                      </button>
                    );
                  })}

                </div>

                {/* OTHER SYSTEM */}

                {form.systemId === "other" && (
                  <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-5">

                    <div className="flex items-start gap-3">

                      <HelpCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-blue-600"
                      />

                      <div className="flex-1">

                        <label className="block text-sm font-semibold text-slate-800">
                          What is the name of your HR software?
                        </label>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Enter the name of the HR application
                          your organization uses.
                        </p>

                        <input
                          type="text"
                          value={form.provider}
                          onChange={(event) =>
                            updateForm(
                              "provider",
                              event.target.value
                            )
                          }
                          placeholder="e.g. PeopleStrong"
                          className={inputClass}
                        />

                      </div>

                    </div>

                  </div>
                )}

                {/* CONNECTION NAME */}

                {form.systemId && (
                  <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">

                    <div className="flex items-start gap-3">

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Link2 size={17} />
                      </div>

                      <div className="flex-1">

                        <label className="block text-sm font-semibold text-slate-800">
                          Give this connection a name
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        </label>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          This is the name your HR team will
                          see inside the Integration Hub.
                        </p>

                        <input
                          type="text"
                          value={form.name}
                          onChange={(event) =>
                            updateForm(
                              "name",
                              event.target.value
                            )
                          }
                          placeholder={
                            form.provider
                              ? `e.g. ${form.provider} - Employee Data`
                              : "e.g. Company HR System"
                          }
                          className={inputClass}
                        />

                      </div>

                    </div>

                  </div>
                )}

                {/* PURPOSE */}

                {form.systemId && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">

                    <label className="block text-sm font-semibold text-slate-800">
                      What is this connection for?
                    </label>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Tell your team what information this
                      connection is intended to handle.
                    </p>

                    <textarea
                      value={form.description}
                      onChange={(event) =>
                        updateForm(
                          "description",
                          event.target.value
                        )
                      }
                      rows={3}
                      placeholder="Example: Keep employee information synchronized with our HR system."
                      className={`${inputClass} resize-none`}
                    />

                  </div>
                )}

              </div>
            )}

            {/* ================================================================
               STEP 2
            ================================================================ */}

            {step === 2 && (
              <div>

                <div className="mb-7">

                  <h3 className="text-xl font-semibold text-slate-900">
                    What should happen to the information?
                  </h3>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Choose how information should move between
                    your HR system and HR AI Platform.
                  </p>

                </div>

                <div className="space-y-3">

                  {DATA_DIRECTIONS.map((option) => {

                    const selected =
                      form.sync_direction ===
                      option.id;

                    const Icon =
                      option.icon;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          selectDirection(
                            option.id
                          )
                        }
                        className={`flex w-full items-start gap-4 rounded-xl border p-5 text-left transition ${
                          selected
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >

                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                            selected
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Icon size={20} />
                        </div>

                        <div className="min-w-0 flex-1">

                          <div className="flex items-center justify-between gap-3">

                            <h4 className="text-sm font-semibold text-slate-900">
                              {option.title}
                            </h4>

                            {selected && (
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                                <Check size={12} />
                              </div>
                            )}

                          </div>

                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            {option.description}
                          </p>

                          <p className="mt-2 text-xs font-medium text-blue-700">
                            {option.example}
                          </p>

                        </div>

                      </button>
                    );
                  })}

                </div>

                {/* SYNC FREQUENCY */}

                <div className="mt-8">

                  <div className="mb-4">

                    <h4 className="text-base font-semibold text-slate-900">
                      How often should information be updated?
                    </h4>

                    <p className="mt-1 text-sm text-slate-500">
                      Choose how frequently HR AI Platform
                      should synchronize information.
                    </p>

                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                    {SYNC_OPTIONS.map((option) => {

                      const selected =
                        form.sync_frequency ===
                        option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            updateForm(
                              "sync_frequency",
                              option.id
                            )
                          }
                          className={`rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >

                          <div className="flex items-start justify-between gap-3">

                            <div>

                              <p className="text-sm font-semibold text-slate-900">
                                {option.title}
                              </p>

                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {option.description}
                              </p>

                              <p className="mt-2 text-xs font-medium text-blue-700">
                                {option.recommendedFor}
                              </p>

                            </div>

                            {selected && (
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                                <Check size={12} />
                              </span>
                            )}

                          </div>

                        </button>
                      );
                    })}

                  </div>

                </div>

                {/* DATA FLOW SUMMARY */}

                {selectedDirection && (
                  <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">

                    <RefreshCw
                      size={18}
                      className="mt-0.5 shrink-0 text-slate-500"
                    />

                    <div>

                      <p className="text-sm font-semibold text-slate-800">
                        Your selected setup
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {selectedDirection.shortTitle}
                        {" · "}
                        {selectedFrequency?.title ||
                          "Manual"}
                      </p>

                    </div>

                  </div>
                )}

              </div>
            )}

            {/* ================================================================
               STEP 3
            ================================================================ */}

            {step === 3 && (
              <div>

                <div className="mb-7">

                  <h3 className="text-xl font-semibold text-slate-900">
                    Let's connect your HR system
                  </h3>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Choose how your HR software provides access.
                    We will only ask for the information required
                    for your selected connection.
                  </p>

                </div>

                {/* CONNECTION METHOD */}

                <div>

                  <div className="mb-3">

                    <label className="text-sm font-semibold text-slate-800">
                      How does your HR software connect?
                    </label>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      If you're unsure, ask your HR software
                      administrator or IT team which option
                      they support.
                    </p>

                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                    {CONNECTION_TYPES.map((option) => {

                      const selected =
                        form.integration_type ===
                        option.id;

                      const Icon =
                        option.icon;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            selectConnectionType(
                              option.id
                            )
                          }
                          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >

                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              selected
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <Icon size={17} />
                          </div>

                          <div className="min-w-0 flex-1">

                            <div className="flex items-center justify-between gap-2">

                              <span className="text-sm font-semibold text-slate-900">
                                {option.title}
                              </span>

                              {selected && (
                                <Check
                                  size={15}
                                  className="shrink-0 text-blue-600"
                                />
                              )}

                            </div>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {option.description}
                            </p>

                          </div>

                        </button>
                      );
                    })}

                  </div>

                </div>

                {/* REST API */}

                {form.integration_type ===
                  "rest_api" && (
                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">

                    <div className="flex items-start gap-3">

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
                        <Globe size={17} />
                      </div>

                      <div>

                        <h4 className="text-sm font-semibold text-slate-900">
                          API connection
                        </h4>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Your HR software should provide an
                          API address for connecting external
                          applications.
                        </p>

                      </div>

                    </div>

                    {/* API ADDRESS */}

                    <div className="mt-5">

                      <label className="block text-sm font-semibold text-slate-700">

                        API address

                        <span className="ml-1 text-red-500">
                          *
                        </span>

                      </label>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Usually provided by your HR software
                        administrator or IT team.
                      </p>

                      <input
                        type="url"
                        value={form.base_url}
                        onChange={(event) =>
                          updateForm(
                            "base_url",
                            event.target.value
                          )
                        }
                        placeholder="https://api.example.com"
                        className={inputClass}
                      />

                      <div className="mt-2 flex items-start gap-2">

                        <HelpCircle
                          size={13}
                          className="mt-0.5 shrink-0 text-slate-400"
                        />

                        <p className="text-xs text-slate-500">
                          If you don't know this address,
                          ask your HR software administrator
                          or IT team.
                        </p>

                      </div>

                    </div>

                    {/* AUTHENTICATION */}

                    <div className="mt-6">

                      <label className="block text-sm font-semibold text-slate-700">
                        How does your HR software verify access?
                      </label>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Select the authentication method provided
                        by your HR software.
                      </p>

                      <div className="relative mt-3">

                        <select
                          value={form.auth_type}
                          onChange={(event) =>
                            selectAuthentication(
                              event.target.value
                            )
                          }
                          className={`${inputClass} appearance-none pr-10`}
                        >
                          {AUTH_OPTIONS.map(
                            (option) => (
                              <option
                                key={option.id}
                                value={option.id}
                              >
                                {option.title}
                              </option>
                            )
                          )}
                        </select>

                        <ChevronDown
                          size={16}
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                      </div>

                      {selectedAuth && (
                        <p className="mt-2 text-xs text-slate-500">
                          {selectedAuth.description}
                        </p>
                      )}

                    </div>

                    {/* API KEY */}

                    {form.auth_type ===
                      "api_key" && (
                      <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">

                        <div className="flex items-center gap-2">

                          <KeyRound
                            size={16}
                            className="text-emerald-600"
                          />

                          <label className="text-sm font-semibold text-slate-700">

                            API key

                            <span className="ml-1 text-red-500">
                              *
                            </span>

                          </label>

                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Enter the API key provided by your
                          HR software administrator.
                        </p>

                        <input
                          type="password"
                          value={form.api_key}
                          onChange={(event) =>
                            updateForm(
                              "api_key",
                              event.target.value
                            )
                          }
                          placeholder="Enter your API key"
                          autoComplete="new-password"
                          className={inputClass}
                        />

                        <div className="mt-4">

                          <label className="block text-sm font-medium text-slate-700">
                            API key header name
                          </label>

                          <input
                            type="text"
                            value={form.header_name}
                            onChange={(event) =>
                              updateForm(
                                "header_name",
                                event.target.value
                              )
                            }
                            placeholder="x-api-key"
                            className={inputClass}
                          />

                          <p className="mt-2 text-xs text-slate-500">
                            Leave the default value unless
                            your HR software provides a
                            different header name.
                          </p>

                        </div>

                      </div>
                    )}

                    {/* BEARER TOKEN */}

                    {form.auth_type ===
                      "bearer" && (
                      <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">

                        <div className="flex items-center gap-2">

                          <Lock
                            size={16}
                            className="text-emerald-600"
                          />

                          <label className="text-sm font-semibold text-slate-700">

                            Access token

                            <span className="ml-1 text-red-500">
                              *
                            </span>

                          </label>

                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Enter the access token provided by
                          your HR software administrator.
                        </p>

                        <input
                          type="password"
                          value={form.token}
                          onChange={(event) =>
                            updateForm(
                              "token",
                              event.target.value
                            )
                          }
                          placeholder="Enter your access token"
                          autoComplete="new-password"
                          className={inputClass}
                        />

                      </div>
                    )}

                    {/* BASIC AUTH */}

                    {form.auth_type ===
                      "basic" && (
                      <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">

                        <div className="flex items-center gap-2">

                          <Lock
                            size={16}
                            className="text-emerald-600"
                          />

                          <h4 className="text-sm font-semibold text-slate-800">
                            Login details
                          </h4>

                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Enter the username and password
                          provided for this integration.
                        </p>

                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">

                          <div>

                            <label className="block text-sm font-medium text-slate-700">

                              Username

                              <span className="ml-1 text-red-500">
                                *
                              </span>

                            </label>

                            <input
                              type="text"
                              value={form.username}
                              onChange={(event) =>
                                updateForm(
                                  "username",
                                  event.target.value
                                )
                              }
                              placeholder="Enter username"
                              autoComplete="off"
                              className={inputClass}
                            />

                          </div>

                          <div>

                            <label className="block text-sm font-medium text-slate-700">

                              Password

                              <span className="ml-1 text-red-500">
                                *
                              </span>

                            </label>

                            <input
                              type="password"
                              value={form.password}
                              onChange={(event) =>
                                updateForm(
                                  "password",
                                  event.target.value
                                )
                              }
                              placeholder="Enter password"
                              autoComplete="new-password"
                              className={inputClass}
                            />

                          </div>

                        </div>

                      </div>
                    )}

                  </div>
                )}

                {/* NON API METHODS */}

                {form.integration_type !==
                  "rest_api" && (
                  <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5">

                    <div className="flex items-start gap-3">

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600">
                        <ShieldCheck size={17} />
                      </div>

                      <div>

                        <h4 className="text-sm font-semibold text-slate-900">
                          {selectedConnection?.title ||
                            "Connection method"}{" "}
                          selected
                        </h4>

                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {selectedConnection?.explanation ||
                            "Additional configuration may be required after the connection is created."}
                        </p>

                        <p className="mt-2 text-xs leading-5 text-blue-700">
                          You can complete the detailed
                          configuration after creating the
                          connection.
                        </p>

                      </div>

                    </div>

                  </div>
                )}

                {/* SECURITY NOTICE */}

                <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">

                  <ShieldCheck
                    size={18}
                    className="mt-0.5 shrink-0 text-emerald-600"
                  />

                  <div>

                    <p className="text-sm font-semibold text-slate-800">
                      Connection security
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Connection credentials are used to
                      authenticate with the connected HR system.
                      Never share credentials with anyone who
                      does not need access.
                    </p>

                  </div>

                </div>

              </div>
            )}

            {/* ================================================================
               STEP 4
            ================================================================ */}

            {step === 4 && (
              <div>

                <div className="mb-7">

                  <h3 className="text-xl font-semibold text-slate-900">
                    Review your connection
                  </h3>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Check the information below before creating
                    the connection. You can go back and change
                    anything if needed.
                  </p>

                </div>

                <div className="space-y-4">

                  {/* SYSTEM */}

                  <ReviewCard
                    title="HR system"
                    icon={<Database size={17} />}
                    onEdit={() =>
                      setStep(1)
                    }
                  >

                    <ReviewRow
                      label="System"
                      value={
                        form.provider ||
                        selectedSystem?.name ||
                        "Not specified"
                      }
                    />

                    <ReviewRow
                      label="Connection name"
                      value={
                        form.name ||
                        "Not specified"
                      }
                    />

                    {form.description && (
                      <ReviewRow
                        label="Purpose"
                        value={
                          form.description
                        }
                      />
                    )}

                  </ReviewCard>

                  {/* DATA FLOW */}

                  <ReviewCard
                    title="Data flow"
                    icon={<RefreshCw size={17} />}
                    onEdit={() =>
                      setStep(2)
                    }
                  >

                    <ReviewRow
                      label="Information flow"
                      value={formatDirection(
                        form.sync_direction
                      )}
                    />

                    <ReviewRow
                      label="Update frequency"
                      value={formatFrequency(
                        form.sync_frequency
                      )}
                    />

                  </ReviewCard>

                  {/* CONNECTION */}

                  <ReviewCard
                    title="Connection"
                    icon={<Globe size={17} />}
                    onEdit={() =>
                      setStep(3)
                    }
                  >

                    <ReviewRow
                      label="Connection method"
                      value={formatConnectionType(
                        form.integration_type
                      )}
                    />

                    {form.integration_type ===
                      "rest_api" && (
                      <>
                        <ReviewRow
                          label="API address"
                          value={
                            form.base_url ||
                            "Not specified"
                          }
                        />

                        <ReviewRow
                          label="Authentication"
                          value={formatAuthType(
                            form.auth_type
                          )}
                        />

                        <ReviewRow
                          label="Credentials"
                          value={
                            form.auth_type ===
                            "none"
                              ? "Not required"
                              : "Configured"
                          }
                        />
                      </>
                    )}

                  </ReviewCard>

                </div>

                {/* READY */}

                <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-5">

                  <ShieldCheck
                    size={20}
                    className="mt-0.5 shrink-0 text-emerald-600"
                  />

                  <div>

                    <p className="text-sm font-semibold text-emerald-900">
                      Ready to connect
                    </p>

                    <p className="mt-1 text-xs leading-5 text-emerald-700">
                      Once you create this connection, you
                      can test it, configure field mappings,
                      and monitor synchronization activity
                      from the Integration Hub.
                    </p>

                  </div>

                </div>

              </div>
            )}

          </div>

          {/* ==================================================================
             FOOTER
          ================================================================== */}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">

            {/* LEFT */}

            <div>

              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              )}

            </div>

            {/* RIGHT */}

            <div className="flex items-center gap-3">

              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {saving ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                      {isEditing
                        ? "Saving changes..."
                        : "Creating connection..."}
                    </>
                  ) : (
                    <>
                      <Check size={16} />

                      {isEditing
                        ? "Save Changes"
                        : "Create Connection"}
                    </>
                  )}

                </button>
              )}

            </div>

          </div>

        </form>

      </div>
    </div>
  );
}

/* ============================================================================
   REVIEW CARD
============================================================================ */

function ReviewCard({
  title,
  icon,
  children,
  onEdit,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">

      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

        <div className="flex items-center gap-2">

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            {icon}
          </div>

          <h4 className="text-sm font-semibold text-slate-900">
            {title}
          </h4>

        </div>

        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium text-blue-600 transition hover:text-blue-700"
        >
          Edit
        </button>

      </div>

      <div className="space-y-3 px-5 py-4">
        {children}
      </div>

    </div>
  );
}

/* ============================================================================
   REVIEW ROW
============================================================================ */

function ReviewRow({
  label,
  value,
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">

      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className="break-all text-sm font-medium text-slate-800 sm:max-w-[65%] sm:text-right">
        {value}
      </span>

    </div>
  );
}

/* ============================================================================
   FORMATTERS
============================================================================ */

function formatDirection(value) {
  switch (value) {
    case "inbound":
      return "HR system → HR AI Platform";

    case "outbound":
      return "HR AI Platform → HR system";

    case "bidirectional":
      return "Both systems";

    default:
      return "Not specified";
  }
}

function formatFrequency(value) {
  switch (value) {
    case "manual":
      return "Manual";

    case "hourly":
      return "Every hour";

    case "daily":
      return "Every day";

    case "weekly":
      return "Every week";

    default:
      return "Not specified";
  }
}

function formatConnectionType(value) {
  switch (value) {
    case "rest_api":
      return "API";

    case "webhook":
      return "Webhook";

    case "database":
      return "Database";

    case "file":
      return "File";

    case "custom":
      return "Custom connection";

    default:
      return "Not specified";
  }
}

function formatAuthType(value) {
  switch (value) {
    case "none":
      return "No authentication";

    case "api_key":
      return "API key";

    case "bearer":
      return "Access token";

    case "basic":
      return "Username and password";

    default:
      return "Not specified";
  }
}

/* ============================================================================
   SHARED INPUT STYLE
============================================================================ */

const inputClass =
  "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";