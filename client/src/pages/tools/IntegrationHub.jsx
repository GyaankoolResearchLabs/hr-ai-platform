import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpFromLine,
  Check,
  Clock3,
  Code2,
  Database,
  Edit3,
  Globe,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  X,
  Zap,
} from "lucide-react";

import { api } from "../../lib/api";
import AddIntegrationWizard from "../../components/integrations/AddIntegrationWizard";

/* ============================================================================
   HELPERS
============================================================================ */

function formatDate(value) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString();
}

function formatRelativeDate(value) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diff = Date.now() - date.getTime();

  if (diff < 60 * 1000) {
    return "Just now";
  }

  if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))}m ago`;
  }

  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
  }

  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d ago`;
  }

  return date.toLocaleDateString();
}

function getStatusClasses(status) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "error":
      return "bg-red-50 text-red-700 border-red-200";

    case "inactive":
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function getLogStatusClasses(status) {
  switch (status) {
    case "success":
      return "bg-emerald-50 text-emerald-700";

    case "failed":
      return "bg-red-50 text-red-700";

    case "running":
      return "bg-blue-50 text-blue-700";

    case "skipped":
      return "bg-amber-50 text-amber-700";

    default:
      return "bg-slate-50 text-slate-600";
  }
}

function getDirectionIcon(direction) {
  if (direction === "outbound") {
    return <ArrowUpFromLine size={15} />;
  }

  if (direction === "bidirectional") {
    return <ArrowLeftRight size={15} />;
  }

  return <ArrowDownToLine size={15} />;
}

/* ============================================================================
   COMPONENT
============================================================================ */

export default function IntegrationHub() {
  const navigate = useNavigate();

  const [integrations, setIntegrations] = useState([]);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    error: 0,
    manual: 0,
    automatic: 0,
  });

  const [selectedIntegration, setSelectedIntegration] =
    useState(null);

  const [mappings, setMappings] = useState([]);
  const [logs, setLogs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [showWizard, setShowWizard] = useState(false);

  const [showMappingModal, setShowMappingModal] =
    useState(false);

  const [editingIntegration, setEditingIntegration] =
    useState(null);

  const [editingMapping, setEditingMapping] =
    useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [mappingForm, setMappingForm] = useState({
    source_object: "",
    source_field: "",
    target_object: "",
    target_field: "",
    direction: "inbound",
    transform_rule: "",
    is_active: true,
  });

  /* ==========================================================================
     NOTIFICATIONS
  ========================================================================== */

  function showSuccess(message) {
    setSuccessMessage(message);
    setErrorMessage("");

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 4000);
  }

  function showError(message) {
    setErrorMessage(
      message || "Something went wrong. Please try again."
    );

    setSuccessMessage("");
  }

  /* ==========================================================================
     LOAD INTEGRATIONS
  ========================================================================== */

  async function loadIntegrations() {
    try {
      setLoading(true);
      setErrorMessage("");

      const params = {};

      if (search.trim()) {
        params.search = search.trim();
      }

      if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      const [
        integrationsResponse,
        statsResponse,
      ] = await Promise.all([
        api.get("/integrations", {
          params,
        }),

        api.get("/integrations/stats"),
      ]);

      setIntegrations(
        integrationsResponse.data?.integrations || []
      );

      setStats(
        statsResponse.data?.stats || {
          total: 0,
          active: 0,
          inactive: 0,
          error: 0,
          manual: 0,
          automatic: 0,
        }
      );
    } catch (error) {
      console.error(
        "Failed to load integrations:",
        error
      );

      showError(
        error.response?.data?.message ||
          "Failed to load integrations."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIntegrations();
  }, [statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadIntegrations();
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  /* ==========================================================================
     SELECT INTEGRATION
  ========================================================================== */

  async function selectIntegration(integration) {
    try {
      setSelectedIntegration(integration);
      setActiveTab("overview");
      setLoadingDetails(true);
      setErrorMessage("");

      const [
        mappingResponse,
        logResponse,
      ] = await Promise.all([
        api.get(
          `/integrations/${integration.id}/mappings`
        ),

        api.get(
          `/integrations/${integration.id}/logs`
        ),
      ]);

      setMappings(
        mappingResponse.data?.mappings || []
      );

      setLogs(
        logResponse.data?.logs || []
      );
    } catch (error) {
      console.error(
        "Failed to load integration details:",
        error
      );

      showError(
        error.response?.data?.message ||
          "Failed to load integration details."
      );
    } finally {
      setLoadingDetails(false);
    }
  }

  /* ==========================================================================
     INTEGRATION WIZARD
  ========================================================================== */

  function openCreateWizard() {
    setEditingIntegration(null);
    setShowWizard(true);
    setErrorMessage("");
  }

  function openEditWizard(integration) {
    setEditingIntegration(integration);
    setShowWizard(true);
    setErrorMessage("");
  }

  function closeWizard() {
    if (saving) return;

    setShowWizard(false);
    setEditingIntegration(null);
  }

  /* ==========================================================================
     SAVE INTEGRATION
  ========================================================================== */

  async function handleWizardSubmit(payload) {
    try {
      setSaving(true);
      setErrorMessage("");

      let response;

      if (editingIntegration) {
        response = await api.put(
          `/integrations/${editingIntegration.id}`,
          payload
        );
      } else {
        response = await api.post(
          "/integrations",
          payload
        );
      }

      const savedIntegration =
        response.data?.integration;

      showSuccess(
        editingIntegration
          ? "Integration updated successfully."
          : "Integration created successfully."
      );

      setShowWizard(false);
      setEditingIntegration(null);

      await loadIntegrations();

      if (savedIntegration) {
        await selectIntegration(
          savedIntegration
        );
      }
    } catch (error) {
      console.error(
        "Failed to save integration:",
        error
      );

      showError(
        error.response?.data?.message ||
          "Failed to save integration."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================================
     DELETE INTEGRATION
  ========================================================================== */

  async function handleDeleteIntegration(
    integration
  ) {
    const confirmed = window.confirm(
      `Delete "${integration.name}"?\n\nThis will also delete its field mappings and sync logs.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setErrorMessage("");

      await api.delete(
        `/integrations/${integration.id}`
      );

      if (
        selectedIntegration?.id ===
        integration.id
      ) {
        setSelectedIntegration(null);
        setMappings([]);
        setLogs([]);
      }

      showSuccess(
        "Integration deleted successfully."
      );

      await loadIntegrations();
    } catch (error) {
      console.error(
        "Failed to delete integration:",
        error
      );

      showError(
        error.response?.data?.message ||
          "Failed to delete integration."
      );
    } finally {
      setDeleting(false);
    }
  }

  /* ==========================================================================
     TEST CONNECTION
  ========================================================================== */

  async function handleTestConnection() {
    if (!selectedIntegration) {
      return;
    }

    if (
      selectedIntegration.integration_type !==
      "rest_api"
    ) {
      showError(
        "Connection testing is currently available for API connections."
      );

      return;
    }

    try {
      setTesting(true);
      setErrorMessage("");

      const response = await api.post(
        `/integrations/${selectedIntegration.id}/test`
      );

      const result =
        response.data || {};

      showSuccess(
        result.message ||
          "Connection test completed."
      );

      await loadIntegrations();

      const refreshed = await api.get(
        `/integrations/${selectedIntegration.id}`
      );

      const updatedIntegration =
        refreshed.data?.integration;

      if (updatedIntegration) {
        setSelectedIntegration(
          updatedIntegration
        );

        await selectIntegration(
          updatedIntegration
        );
      }
    } catch (error) {
      console.error(
        "Connection test failed:",
        error
      );

      showError(
        error.response?.data?.message ||
          "Connection test failed."
      );

      await loadIntegrations();
    } finally {
      setTesting(false);
    }
  }

  /* ==========================================================================
     SYNC NOW
  ========================================================================== */

  async function handleSync() {
    if (!selectedIntegration) {
      return;
    }

    if (selectedIntegration.integration_type !== "rest_api") {
      showError("Manual synchronization is currently available for API connections.");
      return;
    }

    try {
      setSyncing(true);
      setErrorMessage("");

      const response = await api.post(
  `/integrations/${selectedIntegration.id}/sync-employees`
);

      const result = response.data || {};

      setSyncResult({
        success: result.success !== false,
        message:
          result.message ||
          "Synchronization completed successfully.",
        recordsProcessed: Number(
          result.records_processed ??
            result.recordsProcessed ??
            0
        ),
        recordsCreated: Number(
          result.records_created ??
            result.recordsCreated ??
            0
        ),
        recordsUpdated: Number(
          result.records_updated ??
            result.recordsUpdated ??
            0
        ),
        recordsFailed: Number(
          result.records_failed ??
            result.recordsFailed ??
            0
        ),
        durationMs: Number(
          result.duration_ms ??
            result.durationMs ??
            0
        ),
        errors: Array.isArray(result.errors)
          ? result.errors
          : [],
      });

      showSuccess(
        result.message ||
          "Synchronization completed successfully."
      );

      await loadIntegrations();

      const refreshed = await api.get(
        `/integrations/${selectedIntegration.id}`
      );

      const updatedIntegration =
        refreshed.data?.integration;

      if (updatedIntegration) {
        await selectIntegration(updatedIntegration);
      } else {
        await refreshLogs();
      }
    } catch (error) {
      console.error(
        "Synchronization failed:",
        error
      );

      showError(
        error.response?.data?.message ||
          "Synchronization failed."
      );

      await loadIntegrations();

      try {
        const refreshed = await api.get(
          `/integrations/${selectedIntegration.id}`
        );
        const updatedIntegration =
          refreshed.data?.integration;

        if (updatedIntegration) {
          await selectIntegration(updatedIntegration);
        }
      } catch (refreshError) {
        console.error(
          "Failed to refresh integration after sync error:",
          refreshError
        );
      }
    } finally {
      setSyncing(false);
    }
  }

  /* ==========================================================================
     MAPPING FORM
  ========================================================================== */

  function updateMappingForm(field, value) {
    setMappingForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openCreateMappingModal() {
    setEditingMapping(null);

    setMappingForm({
      source_object: "",
      source_field: "",
      target_object: "",
      target_field: "",
      direction:
        selectedIntegration?.sync_direction ===
        "outbound"
          ? "outbound"
          : "inbound",
      transform_rule: "",
      is_active: true,
    });

    setShowMappingModal(true);
  }

  function openEditMappingModal(mapping) {
    setEditingMapping(mapping);

    setMappingForm({
      source_object:
        mapping.source_object || "",

      source_field:
        mapping.source_field || "",

      target_object:
        mapping.target_object || "",

      target_field:
        mapping.target_field || "",

      direction:
        mapping.direction || "inbound",

      transform_rule:
        mapping.transform_rule || "",

      is_active:
        mapping.is_active !== false,
    });

    setShowMappingModal(true);
  }

  function closeMappingModal() {
    setShowMappingModal(false);
    setEditingMapping(null);
  }

  /* ==========================================================================
     SAVE MAPPING
  ========================================================================== */

  async function handleSaveMapping(event) {
    event.preventDefault();

    if (!selectedIntegration) {
      return;
    }

    if (
      !mappingForm.source_object.trim() ||
      !mappingForm.source_field.trim() ||
      !mappingForm.target_object.trim() ||
      !mappingForm.target_field.trim()
    ) {
      showError(
        "Please complete all required mapping fields."
      );

      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");

      let response;

      if (editingMapping) {
        response = await api.put(
          `/integrations/${selectedIntegration.id}/mappings/${editingMapping.id}`,
          mappingForm
        );
      } else {
        response = await api.post(
          `/integrations/${selectedIntegration.id}/mappings`,
          mappingForm
        );
      }

      showSuccess(
        editingMapping
          ? "Mapping updated successfully."
          : "Mapping created successfully."
      );

      closeMappingModal();

      const mappingResponse =
        await api.get(
          `/integrations/${selectedIntegration.id}/mappings`
        );

      setMappings(
        mappingResponse.data?.mappings || []
      );
    } catch (error) {
      console.error(
        "Failed to save mapping:",
        error
      );

      showError(
        error.response?.data?.message ||
          "Failed to save mapping."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================================
     DELETE MAPPING
  ========================================================================== */

  async function handleDeleteMapping(
    mapping
  ) {
    if (!selectedIntegration) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this field mapping?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setErrorMessage("");

      await api.delete(
        `/integrations/${selectedIntegration.id}/mappings/${mapping.id}`
      );

      showSuccess(
        "Mapping deleted successfully."
      );

      const response = await api.get(
        `/integrations/${selectedIntegration.id}/mappings`
      );

      setMappings(
        response.data?.mappings || []
      );
    } catch (error) {
      console.error(
        "Failed to delete mapping:",
        error
      );

      showError(
        error.response?.data?.message ||
          "Failed to delete mapping."
      );
    }
  }

  /* ==========================================================================
     REFRESH LOGS
  ========================================================================== */

  async function refreshLogs() {
    if (!selectedIntegration) {
      return;
    }

    try {
      setErrorMessage("");

      const response = await api.get(
        `/integrations/${selectedIntegration.id}/logs`
      );

      setLogs(
        response.data?.logs || []
      );

      showSuccess("Logs refreshed.");
    } catch (error) {
      console.error(
        "Failed to refresh logs:",
        error
      );

      showError(
        error.response?.data?.message ||
          "Failed to refresh logs."
      );
    }
  }

  /* ==========================================================================
     DERIVED DATA
  ========================================================================== */

  const activeMappings = useMemo(
    () =>
      mappings.filter(
        (mapping) => mapping.is_active
      ),
    [mappings]
  );

  /* ==========================================================================
     RENDER
  ========================================================================== */

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* ======================================================================
         PAGE HEADER
      ====================================================================== */}

      <header className="border-b border-slate-200 bg-white">

        <div className="mx-auto max-w-[1500px] px-6 py-6">

          {/* BACK BUTTON */}

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div className="min-w-0">

              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
                <Link2 size={17} />
                HR Technology
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Integration Hub
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Connect your HR systems, manage data
                flow, and monitor synchronization from
                one place.
              </p>

            </div>

            <div className="flex flex-wrap items-center gap-3">

              <button
                type="button"
                onClick={loadIntegrations}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh
              </button>

              <button
                type="button"
                onClick={openCreateWizard}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                <Plus size={17} />

                Add Integration
              </button>

            </div>

          </div>

        </div>

      </header>

      {/* ======================================================================
         NOTIFICATIONS
      ====================================================================== */}

      <div className="mx-auto max-w-[1500px] px-6 pt-5">

        {successMessage && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">

            <Check
              size={18}
              className="mt-0.5 shrink-0"
            />

            <span>
              {successMessage}
            </span>

            <button
              type="button"
              onClick={() =>
                setSuccessMessage("")
              }
              className="ml-auto rounded p-1 hover:bg-emerald-100"
            >
              <X size={16} />
            </button>

          </div>
        )}

        {errorMessage && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">

            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <span>
              {errorMessage}
            </span>

            <button
              type="button"
              onClick={() =>
                setErrorMessage("")
              }
              className="ml-auto rounded p-1 hover:bg-red-100"
            >
              <X size={16} />
            </button>

          </div>
        )}

      </div>

      {/* ======================================================================
         MAIN
      ====================================================================== */}

      <main className="mx-auto max-w-[1500px] px-6 py-6">

        {/* STATS */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <StatCard
            label="Total Integrations"
            value={stats.total}
            icon={<Link2 size={18} />}
          />

          <StatCard
            label="Active"
            value={stats.active}
            icon={<Check size={18} />}
            valueClass="text-emerald-600"
          />

          <StatCard
            label="Inactive"
            value={stats.inactive}
            icon={<Clock3 size={18} />}
            valueClass="text-slate-600"
          />

          <StatCard
            label="Connection Errors"
            value={stats.error}
            icon={<AlertCircle size={18} />}
            valueClass="text-red-600"
          />

          <StatCard
            label="Automatic Sync"
            value={stats.automatic}
            icon={<Zap size={18} />}
            valueClass="text-blue-600"
          />

        </div>

        {/* CONTENT */}

        <div className="mt-6 grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">

          {/* ==================================================================
             INTEGRATION LIST
          ================================================================== */}

          <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

            <div className="border-b border-slate-200 p-4">

              <div className="flex items-center justify-between">

                <h2 className="font-semibold text-slate-900">
                  Integrations
                </h2>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {integrations.length}
                </span>

              </div>

              <div className="mt-4 flex gap-2">

                <div className="relative min-w-0 flex-1">

                  <Globe
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search integrations..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />

                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  <option value="all">
                    All
                  </option>

                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>

                  <option value="error">
                    Error
                  </option>
                </select>

              </div>

            </div>

            <div className="max-h-[680px] overflow-y-auto">

              {loading ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <Loader2
                    size={26}
                    className="animate-spin text-blue-600"
                  />
                </div>
              ) : integrations.length === 0 ? (
                <EmptyIntegrations
                  onAdd={openCreateWizard}
                />
              ) : (
                <div className="divide-y divide-slate-100">

                  {integrations.map(
                    (integration) => (
                      <IntegrationListItem
                        key={integration.id}
                        integration={
                          integration
                        }
                        selected={
                          selectedIntegration?.id ===
                          integration.id
                        }
                        onClick={() =>
                          selectIntegration(
                            integration
                          )
                        }
                        onEdit={() =>
                          openEditWizard(
                            integration
                          )
                        }
                        onDelete={() =>
                          handleDeleteIntegration(
                            integration
                          )
                        }
                        deleting={deleting}
                      />
                    )
                  )}

                </div>
              )}

            </div>

          </section>

          {/* ==================================================================
             DETAILS
          ================================================================== */}

          <section className="min-w-0">

            {!selectedIntegration ? (
              <EmptyDetails
                onAdd={openCreateWizard}
              />
            ) : (
              <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

                {/* DETAILS HEADER */}

                <div className="border-b border-slate-200 p-5">

                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                    <div className="flex min-w-0 items-start gap-4">

                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        <Database size={22} />
                      </div>

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <h2 className="truncate text-lg font-semibold text-slate-900">
                            {
                              selectedIntegration.name
                            }
                          </h2>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(
                              selectedIntegration.status
                            )}`}
                          >
                            {
                              selectedIntegration.status
                            }
                          </span>

                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          {
                            selectedIntegration.provider
                          }
                        </p>

                        {selectedIntegration.description && (
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                            {
                              selectedIntegration.description
                            }
                          </p>
                        )}

                      </div>

                    </div>

                    <div className="flex flex-wrap items-center gap-2">

                      <button
                        type="button"
                        onClick={
                          handleTestConnection
                        }
                        disabled={
                          testing ||
                          selectedIntegration.integration_type !==
                            "rest_api"
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {testing ? (
                          <Loader2
                            size={16}
                            className="animate-spin"
                          />
                        ) : (
                          <Activity
                            size={16}
                          />
                        )}

                        {testing
                          ? "Testing..."
                          : "Test Connection"}
                      </button>

                      <button
                        type="button"
                        onClick={handleSync}
                        disabled={
                          syncing ||
                          selectedIntegration.integration_type !==
                            "rest_api"
                        }
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {syncing ? (
                          <Loader2
                            size={16}
                            className="animate-spin"
                          />
                        ) : (
                          <RefreshCw size={16} />
                        )}
                        {syncing ? "Syncing..." : "Sync Now"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openEditWizard(
                            selectedIntegration
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <Edit3 size={16} />
                        Edit
                      </button>

                    </div>

                  </div>

                  {/* TABS */}

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">

                    <TabButton
                      active={
                        activeTab ===
                        "overview"
                      }
                      onClick={() =>
                        setActiveTab(
                          "overview"
                        )
                      }
                    >
                      Overview
                    </TabButton>

                    <TabButton
                      active={
                        activeTab ===
                        "mappings"
                      }
                      onClick={() =>
                        setActiveTab(
                          "mappings"
                        )
                      }
                    >
                      Field Mappings

                      <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px]">
                        {
                          activeMappings.length
                        }
                      </span>
                    </TabButton>

                    <TabButton
                      active={
                        activeTab ===
                        "logs"
                      }
                      onClick={() =>
                        setActiveTab(
                          "logs"
                        )
                      }
                    >
                      Sync Logs
                    </TabButton>

                  </div>

                </div>

                {/* DETAILS CONTENT */}

                <div className="min-w-0 p-5">

                  {loadingDetails ? (
                    <div className="flex min-h-[400px] items-center justify-center">
                      <Loader2
                        size={28}
                        className="animate-spin text-blue-600"
                      />
                    </div>
                  ) : (
                    <>
                      {activeTab ===
                        "overview" && (
                        <OverviewTab
                          integration={
                            selectedIntegration
                          }
                          mappings={
                            mappings
                          }
                          logs={logs}
                        />
                      )}

                      {activeTab ===
                        "mappings" && (
                        <MappingsTab
                          mappings={
                            mappings
                          }
                          onAdd={
                            openCreateMappingModal
                          }
                          onEdit={
                            openEditMappingModal
                          }
                          onDelete={
                            handleDeleteMapping
                          }
                        />
                      )}

                      {activeTab ===
                        "logs" && (
                        <LogsTab
                          logs={logs}
                          onRefresh={
                            refreshLogs
                          }
                          syncResult={syncResult}
                        />
                      )}
                    </>
                  )}

                </div>

              </div>
            )}

          </section>

        </div>

      </main>

      {/* ======================================================================
         NEW INTEGRATION WIZARD
      ====================================================================== */}

      <AddIntegrationWizard
        open={showWizard}
        onClose={closeWizard}
        onSubmit={handleWizardSubmit}
        saving={saving}
        editingIntegration={
          editingIntegration
        }
      />

      {/* ======================================================================
         FIELD MAPPING MODAL
      ====================================================================== */}

      {showMappingModal && (
        <Modal
          title={
            editingMapping
              ? "Edit Field Mapping"
              : "Add Field Mapping"
          }
          subtitle="Define how data moves between your HR system and HR AI Platform."
          onClose={closeMappingModal}
        >
          <form
            onSubmit={
              handleSaveMapping
            }
          >

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

              <FormField
                label="Source Object"
                required
              >
                <input
                  type="text"
                  value={
                    mappingForm.source_object
                  }
                  onChange={(event) =>
                    updateMappingForm(
                      "source_object",
                      event.target.value
                    )
                  }
                  placeholder="employee"
                  className={inputClass}
                />
              </FormField>

              <FormField
                label="Source Field"
                required
              >
                <input
                  type="text"
                  value={
                    mappingForm.source_field
                  }
                  onChange={(event) =>
                    updateMappingForm(
                      "source_field",
                      event.target.value
                    )
                  }
                  placeholder="employee_id"
                  className={inputClass}
                />
              </FormField>

              <FormField
                label="Target Object"
                required
              >
                <input
                  type="text"
                  value={
                    mappingForm.target_object
                  }
                  onChange={(event) =>
                    updateMappingForm(
                      "target_object",
                      event.target.value
                    )
                  }
                  placeholder="employees"
                  className={inputClass}
                />
              </FormField>

              <FormField
                label="Target Field"
                required
              >
                <input
                  type="text"
                  value={
                    mappingForm.target_field
                  }
                  onChange={(event) =>
                    updateMappingForm(
                      "target_field",
                      event.target.value
                    )
                  }
                  placeholder="external_employee_id"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Direction">
                <select
                  value={
                    mappingForm.direction
                  }
                  onChange={(event) =>
                    updateMappingForm(
                      "direction",
                      event.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option value="inbound">
                    Inbound
                  </option>

                  <option value="outbound">
                    Outbound
                  </option>
                </select>
              </FormField>

              <FormField
                label="Transform Rule"
                hint="Optional rule applied while synchronizing the value."
              >
                <input
                  type="text"
                  value={
                    mappingForm.transform_rule
                  }
                  onChange={(event) =>
                    updateMappingForm(
                      "transform_rule",
                      event.target.value
                    )
                  }
                  placeholder="e.g. lowercase"
                  className={inputClass}
                />
              </FormField>

            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">

              <input
                type="checkbox"
                checked={
                  mappingForm.is_active
                }
                onChange={(event) =>
                  updateMappingForm(
                    "is_active",
                    event.target.checked
                  )
                }
                className="h-4 w-4 rounded border-slate-300"
              />

              <span>

                <span className="block text-sm font-medium text-slate-800">
                  Mapping active
                </span>

                <span className="block text-xs text-slate-500">
                  Include this mapping during synchronization.
                </span>

              </span>

            </label>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-5">

              <button
                type="button"
                onClick={
                  closeMappingModal
                }
                disabled={saving}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                )}

                {editingMapping
                  ? "Save Mapping"
                  : "Add Mapping"}
              </button>

            </div>

          </form>
        </Modal>
      )}

    </div>
  );
}

/* ============================================================================
   STAT CARD
============================================================================ */

function StatCard({
  label,
  value,
  icon,
  valueClass = "text-slate-900",
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-center justify-between">

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>

      </div>

      <div
        className={`mt-4 text-2xl font-semibold ${valueClass}`}
      >
        {value}
      </div>

      <div className="mt-1 text-sm text-slate-500">
        {label}
      </div>

    </div>
  );
}

/* ============================================================================
   INTEGRATION LIST ITEM
============================================================================ */

function IntegrationListItem({
  integration,
  selected,
  onClick,
  onEdit,
  onDelete,
  deleting,
}) {
  return (
    <div
      className={`group cursor-pointer p-4 transition ${
        selected
          ? "bg-blue-50/60"
          : "hover:bg-slate-50"
      }`}
      onClick={onClick}
    >

      <div className="flex items-start gap-3">

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            selected
              ? "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <Database size={18} />
        </div>

        <div className="min-w-0 flex-1">

          <div className="flex items-start justify-between gap-2">

            <div className="min-w-0">

              <p className="truncate text-sm font-semibold text-slate-900">
                {integration.name}
              </p>

              <p className="mt-0.5 truncate text-xs text-slate-500">
                {integration.provider}
              </p>

            </div>

            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${getStatusClasses(
                integration.status
              )}`}
            >
              {integration.status}
            </span>

          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">

            <span className="inline-flex items-center gap-1">
              {getDirectionIcon(
                integration.sync_direction
              )}

              {integration.sync_direction}
            </span>

            <span className="text-slate-300">
              •
            </span>

            <span className="capitalize">
              {integration.sync_frequency}
            </span>

          </div>

          <div className="mt-3 flex items-center justify-between">

            <span className="text-[11px] text-slate-400">
              {integration.last_tested_at
                ? `Tested ${formatRelativeDate(
                    integration.last_tested_at
                  )}`
                : "Never tested"}
            </span>

            <div
              className={`flex items-center gap-1 ${
                selected
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              } transition`}
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <button
                type="button"
                onClick={onEdit}
                className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
                title="Edit integration"
              >
                <Edit3 size={14} />
              </button>

              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                title="Delete integration"
              >
                <Trash2 size={14} />
              </button>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

/* ============================================================================
   OVERVIEW TAB
============================================================================ */

function OverviewTab({
  integration,
  mappings,
  logs,
}) {
  const successLogs = logs.filter(
    (log) => log.status === "success"
  );

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

        <InfoCard
          label="Integration Type"
          value={
            integration.integration_type
          }
          icon={<Code2 size={17} />}
        />

        <InfoCard
          label="Authentication"
          value={
            integration.auth_type
          }
          icon={<Settings2 size={17} />}
        />

        <InfoCard
          label="Sync Direction"
          value={
            integration.sync_direction
          }
          icon={getDirectionIcon(
            integration.sync_direction
          )}
        />

        <InfoCard
          label="Sync Frequency"
          value={
            integration.sync_frequency
          }
          icon={<Clock3 size={17} />}
        />

      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        <div className="rounded-xl border border-slate-200 p-5">

          <div className="flex items-center gap-2">

            <Globe
              size={18}
              className="text-slate-500"
            />

            <h3 className="font-semibold text-slate-900">
              Connection
            </h3>

          </div>

          <div className="mt-5 space-y-4">

            <DetailRow
              label="Provider"
              value={
                integration.provider
              }
            />

            <DetailRow
              label="Base URL"
              value={
                integration.base_url ||
                "Not configured"
              }
              mono
            />

            <DetailRow
              label="Authentication"
              value={
                integration.auth_type
              }
            />

            <DetailRow
              label="Credentials"
              value={
                integration.has_credentials
                  ? "Configured"
                  : "Not configured"
              }
            />

          </div>

        </div>

        <div className="rounded-xl border border-slate-200 p-5">

          <div className="flex items-center gap-2">

            <RefreshCw
              size={18}
              className="text-slate-500"
            />

            <h3 className="font-semibold text-slate-900">
              Synchronization
            </h3>

          </div>

          <div className="mt-5 space-y-4">

            <DetailRow
              label="Last tested"
              value={formatDate(
                integration.last_tested_at
              )}
            />

            <DetailRow
              label="Last successful sync"
              value={formatDate(
                integration.last_success_at
              )}
            />

            <DetailRow
              label="Active mappings"
              value={
                mappings.filter(
                  (mapping) =>
                    mapping.is_active
                ).length
              }
            />

            <DetailRow
              label="Successful operations"
              value={
                successLogs.length
              }
            />

          </div>

        </div>

      </div>

      {integration.last_error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">

          <div className="flex items-start gap-3">

            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <div>

              <h3 className="text-sm font-semibold text-red-800">
                Last connection error
              </h3>

              <p className="mt-1 text-sm text-red-700">
                {integration.last_error}
              </p>

            </div>

          </div>

        </div>
      )}

      <div className="rounded-xl border border-slate-200 p-5">

        <div>

          <h3 className="font-semibold text-slate-900">
            Recent Activity
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Latest synchronization and connection activity.
          </p>

        </div>

        {logs.length === 0 ? (
          <div className="mt-6 rounded-lg bg-slate-50 px-4 py-8 text-center">

            <Activity
              size={24}
              className="mx-auto text-slate-400"
            />

            <p className="mt-2 text-sm text-slate-500">
              No sync activity yet.
            </p>

          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">

            <table className="w-full min-w-[700px] text-left">

              <thead>

                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">

                  <th className="px-3 py-3 font-medium">
                    Operation
                  </th>

                  <th className="px-3 py-3 font-medium">
                    Status
                  </th>

                  <th className="px-3 py-3 font-medium">
                    Records
                  </th>

                  <th className="px-3 py-3 font-medium">
                    Duration
                  </th>

                  <th className="px-3 py-3 font-medium">
                    Time
                  </th>

                </tr>

              </thead>

              <tbody>

                {logs.slice(0, 5).map(
                  (log) => (
                    <tr
                      key={log.id}
                      className="border-b border-slate-100 last:border-0"
                    >

                      <td className="px-3 py-3 text-sm text-slate-700">
                        {log.operation}
                      </td>

                      <td className="px-3 py-3">

                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${getLogStatusClasses(
                            log.status
                          )}`}
                        >
                          {log.status}
                        </span>

                      </td>

                      <td className="px-3 py-3 text-sm text-slate-600">
                        {
                          log.records_processed ??
                          0
                        }
                      </td>

                      <td className="px-3 py-3 text-sm text-slate-600">
                        {log.duration_ms !=
                        null
                          ? `${log.duration_ms} ms`
                          : "—"}
                      </td>

                      <td className="px-3 py-3 text-sm text-slate-500">
                        {formatRelativeDate(
                          log.started_at
                        )}
                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>
        )}

      </div>

    </div>
  );
}

/* ============================================================================
   MAPPINGS TAB
============================================================================ */

function MappingsTab({
  mappings,
  onAdd,
  onEdit,
  onDelete,
}) {
  return (
    <div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <h3 className="font-semibold text-slate-900">
            Field Mappings
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Define how information from your HR system maps into HR AI Platform.
          </p>

        </div>

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Plus size={16} />
          Add Mapping
        </button>

      </div>

      {mappings.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">

          <ArrowLeftRight
            size={28}
            className="mx-auto text-slate-400"
          />

          <h4 className="mt-3 text-sm font-semibold text-slate-800">
            No field mappings
          </h4>

          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Add mappings to define how information should move between this integration and HR AI Platform.
          </p>

          <button
            type="button"
            onClick={onAdd}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Plus size={15} />
            Create first mapping
          </button>

        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">

          <div className="overflow-x-auto">

            <table className="w-full min-w-[900px] text-left">

              <thead className="bg-slate-50">

                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">

                  <th className="px-4 py-3 font-medium">
                    Source
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Target
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Direction
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Transform
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Status
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody>

                {mappings.map(
                  (mapping) => (
                    <tr
                      key={mapping.id}
                      className="border-b border-slate-100 last:border-0"
                    >

                      <td className="px-4 py-4">

                        <div className="text-sm font-medium text-slate-800">
                          {
                            mapping.source_object
                          }
                        </div>

                        <div className="mt-0.5 font-mono text-xs text-slate-500">
                          {
                            mapping.source_field
                          }
                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <div className="text-sm font-medium text-slate-800">
                          {
                            mapping.target_object
                          }
                        </div>

                        <div className="mt-0.5 font-mono text-xs text-slate-500">
                          {
                            mapping.target_field
                          }
                        </div>

                      </td>

                      <td className="px-4 py-4">

                        <span className="inline-flex items-center gap-1.5 text-sm capitalize text-slate-600">

                          {getDirectionIcon(
                            mapping.direction
                          )}

                          {
                            mapping.direction
                          }

                        </span>

                      </td>

                      <td className="max-w-[220px] px-4 py-4">

                        <span className="block truncate font-mono text-xs text-slate-500">
                          {
                            mapping.transform_rule ||
                            "None"
                          }
                        </span>

                      </td>

                      <td className="px-4 py-4">

                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            mapping.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {mapping.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>

                      </td>

                      <td className="px-4 py-4">

                        <div className="flex justify-end gap-1">

                          <button
                            type="button"
                            onClick={() =>
                              onEdit(
                                mapping
                              )
                            }
                            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Edit mapping"
                          >
                            <Edit3
                              size={15}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onDelete(
                                mapping
                              )
                            }
                            className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            title="Delete mapping"
                          >
                            <Trash2
                              size={15}
                            />
                          </button>

                        </div>

                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>

        </div>
      )}

    </div>
  );
}

/* ============================================================================
   LOGS TAB
============================================================================ */

function LogsTab({
  logs,
  onRefresh,
  syncResult,
}) {
  const latestSyncLog = logs.find(
    (log) => log.operation === "sync"
  );

  function getRecordValue(log, field, fallback = 0) {
    const value = log?.[field];

    if (value === null || value === undefined || value === "") {
      return fallback;
    }

    const numericValue = Number(value);

    return Number.isFinite(numericValue)
      ? numericValue
      : fallback;
  }



  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">
            Sync Logs
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Review connection tests and synchronization operations.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh Logs
        </button>
      </div>

      {syncResult && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check size={17} />
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-emerald-900">
                    Latest synchronization
                  </h4>

                  <p className="mt-0.5 text-xs text-emerald-700">
                    {syncResult.message}
                  </p>
                </div>
              </div>
            </div>

            {syncResult.durationMs > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Clock3 size={14} />
                {syncResult.durationMs} ms
              </span>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SyncMetric
              label="Processed"
              value={syncResult.recordsProcessed}
            />

            <SyncMetric
              label="Created"
              value={syncResult.recordsCreated}
              valueClass="text-blue-700"
            />

            <SyncMetric
              label="Updated"
              value={syncResult.recordsUpdated}
              valueClass="text-indigo-700"
            />

            <SyncMetric
              label="Failed"
              value={syncResult.recordsFailed}
              valueClass={
                syncResult.recordsFailed > 0
                  ? "text-red-700"
                  : "text-emerald-700"
              }
            />
          </div>

          {syncResult.errors.length > 0 && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              <div className="font-semibold">
                Synchronization errors
              </div>

              <ul className="mt-1 list-disc space-y-1 pl-4">
                {syncResult.errors.slice(0, 5).map(
                  (error, index) => (
                    <li key={index}>
                      {typeof error === "string"
                        ? error
                        : error?.message ||
                          JSON.stringify(error)}
                    </li>
                  )
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {logs.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <Activity
            size={28}
            className="mx-auto text-slate-400"
          />

          <h4 className="mt-3 text-sm font-semibold text-slate-800">
            No sync logs
          </h4>

          <p className="mt-1 text-sm text-slate-500">
            Connection tests and synchronization activity will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">
                    Operation
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Direction
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Status
                  </th>

                  <th className="px-4 py-3 font-medium">
                    HTTP
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Processed
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Created
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Updated
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Failed
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Duration
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Started
                  </th>
                </tr>
              </thead>

              <tbody>
                {logs.map((log, index) => {
                  const isLatestSync =
                    index === 0 &&
                    log.operation === "sync" &&
                    syncResult;

                  const processed = isLatestSync
                    ? syncResult.recordsProcessed
                    : getRecordValue(
                        log,
                        "records_processed"
                      );

                  const created = isLatestSync
                    ? syncResult.recordsCreated
                    : getRecordValue(
                        log,
                        "records_created"
                      );

                  const updated = isLatestSync
                    ? syncResult.recordsUpdated
                    : getRecordValue(
                        log,
                        "records_updated"
                      );

                  const failed = isLatestSync
                    ? syncResult.recordsFailed
                    : getRecordValue(
                        log,
                        "records_failed"
                      );

                  return (
                    <tr
                      key={log.id}
                      className="border-b border-slate-100 align-top last:border-0"
                    >
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium capitalize text-slate-800">
                          {String(
                            log.operation || "—"
                          ).replace(/_/g, " ")}
                        </div>

                        {log.message && (
                          <div className="mt-1 max-w-[300px] text-xs leading-5 text-slate-500">
                            {log.message}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm capitalize text-slate-600">
                          {getDirectionIcon(
                            log.direction
                          )}
                          {log.direction || "—"}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${getLogStatusClasses(
                            log.status
                          )}`}
                        >
                          {log.status || "—"}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {log.http_status ?? "—"}
                      </td>

                      <td className="px-4 py-4 text-sm font-medium text-slate-700">
                        {processed}
                      </td>

                      <td className="px-4 py-4 text-sm font-medium text-blue-700">
                        {created}
                      </td>

                      <td className="px-4 py-4 text-sm font-medium text-indigo-700">
                        {updated}
                      </td>

                      <td
                        className={`px-4 py-4 text-sm font-medium ${
                          failed > 0
                            ? "text-red-700"
                            : "text-slate-600"
                        }`}
                      >
                        {failed}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {log.duration_ms != null
                          ? `${log.duration_ms} ms`
                          : "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500">
                        {formatDate(
                          log.started_at
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   SYNC METRIC
============================================================================ */

function SyncMetric({
  label,
  value,
  valueClass = "text-slate-900",
}) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-white/80 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div
        className={`mt-1 text-xl font-semibold ${valueClass}`}
      >
        {value ?? 0}
      </div>
    </div>
  );
}

/* ============================================================================
   INFO CARD
============================================================================ */

function InfoCard({
  label,
  value,
  icon,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">

      <div className="flex items-center gap-2 text-slate-500">

        {icon}

        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>

      </div>

      <div className="mt-3 text-sm font-semibold capitalize text-slate-800">
        {String(value || "—").replace(
          /_/g,
          " "
        )}
      </div>

    </div>
  );
}

/* ============================================================================
   DETAIL ROW
============================================================================ */

function DetailRow({
  label,
  value,
  mono = false,
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">

      <span className="shrink-0 text-sm text-slate-500">
        {label}
      </span>

      <span
        className={`break-all text-right text-sm font-medium text-slate-700 ${
          mono
            ? "font-mono text-xs"
            : ""
        }`}
      >
        {value}
      </span>

    </div>
  );
}

/* ============================================================================
   TAB BUTTON
============================================================================ */

function TabButton({
  active,
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

/* ============================================================================
   FORM FIELD
============================================================================ */

function FormField({
  label,
  required = false,
  hint,
  children,
  className = "",
}) {
  return (
    <div className={className}>

      <label className="mb-1.5 block text-sm font-medium text-slate-700">

        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}

      </label>

      {children}

      {hint && (
        <p className="mt-1.5 text-xs text-slate-400">
          {hint}
        </p>
      )}

    </div>
  );
}

/* ============================================================================
   EMPTY INTEGRATIONS
============================================================================ */

function EmptyIntegrations({
  onAdd,
}) {
  return (
    <div className="px-5 py-12 text-center">

      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Link2 size={22} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-800">
        No integrations yet
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Connect your first HR system to get started.
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        <Plus size={16} />
        Add Integration
      </button>

    </div>
  );
}

/* ============================================================================
   EMPTY DETAILS
============================================================================ */

function EmptyDetails({
  onAdd,
}) {
  return (
    <div className="flex min-h-[620px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">

      <div className="max-w-md">

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Link2 size={25} />
        </div>

        <h2 className="mt-5 text-lg font-semibold text-slate-900">
          Integration Hub
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Select an integration to view its configuration, field mappings, and synchronization history.
        </p>

        <button
          type="button"
          onClick={onAdd}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Plus size={16} />
          Add Integration
        </button>

      </div>

    </div>
  );
}

/* ============================================================================
   MODAL
============================================================================ */

function Modal({
  title,
  subtitle,
  onClose,
  children,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >

      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">

        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">

          <div>

            <h2 className="text-lg font-semibold text-slate-900">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-1 text-sm text-slate-500">
                {subtitle}
              </p>
            )}

          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>

        </div>

        <div className="max-h-[calc(92vh-100px)] overflow-y-auto px-6 py-6">
          {children}
        </div>

      </div>

    </div>
  );
}

/* ============================================================================
   INPUT CLASS
============================================================================ */

const inputClass =  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"