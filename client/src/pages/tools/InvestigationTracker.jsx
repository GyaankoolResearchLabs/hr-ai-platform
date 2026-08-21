import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  User,
  X,
} from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("supabase_access_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under Review" },
  { value: "investigation", label: "Investigation" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const TYPE_OPTIONS = [
  { value: "general", label: "General" },
  { value: "misconduct", label: "Misconduct" },
  { value: "grievance", label: "Grievance" },
  { value: "policy_violation", label: "Policy Violation" },
  { value: "workplace_conflict", label: "Workplace Conflict" },
  { value: "harassment", label: "Harassment" },
  { value: "attendance", label: "Attendance" },
  { value: "disciplinary", label: "Disciplinary" },
  { value: "other", label: "Other" },
];

const EVENT_TYPES = [
  { value: "interview", label: "Interview" },
  { value: "evidence", label: "Evidence" },
  { value: "finding", label: "Finding" },
  { value: "action", label: "Action" },
  { value: "note", label: "Note" },
  { value: "resolution", label: "Resolution" },
  { value: "other", label: "Other" },
];

const EVIDENCE_TYPES = [
  { value: "document", label: "Document" },
  { value: "email", label: "Email" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "message", label: "Message" },
  { value: "interview", label: "Interview" },
  { value: "other", label: "Other" },
];

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelFor(options, value) {
  return (
    options.find((item) => item.value === value)?.label ||
    value ||
    "—"
  );
}

function getEmployeeName(employee) {
  if (!employee) return "Unknown employee";

  return (
    employee.name ||
    employee.full_name ||
    employee.employee_name ||
    `${employee.first_name || ""} ${
      employee.last_name || ""
    }`.trim() ||
    employee.email ||
    employee.id ||
    "Unknown employee"
  );
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

const EMPTY_FORM = {
  employee_id: "",
  title: "",
  description: "",
  investigation_type: "general",
  priority: "normal",
  status: "open",
  investigator_id: "",
  target_date: "",
  findings: "",
  resolution: "",
  notes: "",
};

const EMPTY_EVENT_FORM = {
  event_type: "note",
  title: "",
  description: "",
  event_at: "",
};

const EMPTY_EVIDENCE_FORM = {
  evidence_type: "document",
  title: "",
  description: "",
  source_url: "",
  collected_at: "",
  collected_by: "",
};

export default function InvestigationTracker() {
  const [investigations, setInvestigations] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] =
    useState(true);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] =
    useState("");

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [selectedInvestigation, setSelectedInvestigation] =
    useState(null);

  const [showDetails, setShowDetails] =
    useState(false);

  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [events, setEvents] = useState([]);
  const [evidence, setEvidence] = useState([]);

  const [eventsLoading, setEventsLoading] =
    useState(false);

  const [evidenceLoading, setEvidenceLoading] =
    useState(false);

  const [showEventForm, setShowEventForm] =
    useState(false);

  const [showEvidenceForm, setShowEvidenceForm] =
    useState(false);

  const [eventForm, setEventForm] =
    useState(EMPTY_EVENT_FORM);

  const [evidenceForm, setEvidenceForm] =
    useState(EMPTY_EVIDENCE_FORM);

  const [savingEvent, setSavingEvent] =
    useState(false);

  const [savingEvidence, setSavingEvidence] =
    useState(false);

  const [updatingStatus, setUpdatingStatus] =
    useState(false);

  const employeeMap = useMemo(() => {
    const map = {};

    employees.forEach((employee) => {
      map[employee.id] = employee;
    });

    return map;
  }, [employees]);

  const filteredInvestigations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return investigations.filter((item) => {
      const matchesSearch =
        !query ||
        String(item.investigation_number || "")
          .toLowerCase()
          .includes(query) ||
        String(item.title || "")
          .toLowerCase()
          .includes(query) ||
        String(
          getEmployeeName(employeeMap[item.employee_id])
        )
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        !statusFilter ||
        item.status === statusFilter;

      const matchesPriority =
        !priorityFilter ||
        item.priority === priorityFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      );
    });
  }, [
    investigations,
    search,
    statusFilter,
    priorityFilter,
    employeeMap,
  ]);

  const stats = useMemo(() => {
    return {
      total: investigations.length,

      open: investigations.filter(
        (item) =>
          item.status === "open"
      ).length,

      active: investigations.filter(
        (item) =>
          item.status === "under_review" ||
          item.status === "investigation"
      ).length,

      resolved: investigations.filter(
        (item) =>
          item.status === "resolved" ||
          item.status === "closed"
      ).length,

      critical: investigations.filter(
        (item) =>
          item.priority === "critical"
      ).length,
    };
  }, [investigations]);

  async function loadInvestigations() {
    try {
      setLoading(true);
      setError("");

      const params = {};

      if (search.trim()) {
        params.search = search.trim();
      }

      if (statusFilter) {
        params.status = statusFilter;
      }

      if (priorityFilter) {
        params.priority = priorityFilter;
      }

      const response = await api.get(
        "/investigations",
        { params }
      );

      setInvestigations(
        response.data?.investigations || []
      );
    } catch (err) {
      console.error(
        "[InvestigationTracker] Load investigations error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Failed to load investigations."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadEmployees() {
    try {
      setEmployeesLoading(true);

      const response = await api.get(
        "/employees"
      );

      const data =
        response.data?.employees ||
        response.data?.data ||
        response.data ||
        [];

      setEmployees(
        Array.isArray(data) ? data : []
      );
    } catch (err) {
      console.error(
        "[InvestigationTracker] Load employees error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Failed to load employees."
        )
      );
    } finally {
      setEmployeesLoading(false);
    }
  }

  async function loadInvestigationDetails(id) {
    try {
      setEventsLoading(true);
      setEvidenceLoading(true);

      const [
        investigationResponse,
        eventsResponse,
        evidenceResponse,
      ] = await Promise.all([
        api.get(`/investigations/${id}`),
        api.get(`/investigations/${id}/events`),
        api.get(`/investigations/${id}/evidence`),
      ]);

      const investigation =
        investigationResponse.data?.investigation;

      setSelectedInvestigation(
        investigation || null
      );

      setEvents(
        eventsResponse.data?.events || []
      );

      setEvidence(
        evidenceResponse.data?.evidence || []
      );
    } catch (err) {
      console.error(
        "[InvestigationTracker] Load details error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Failed to load investigation details."
        )
      );
    } finally {
      setEventsLoading(false);
      setEvidenceLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    loadInvestigations();
  }, [statusFilter, priorityFilter]);

  async function handleSearchSubmit(event) {
    event.preventDefault();

    await loadInvestigations();
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(false);
    setShowCreateModal(true);
  }

  function closeCreate() {
    if (saving) return;

    setShowCreateModal(false);
    setEditing(false);
    setForm(EMPTY_FORM);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function openInvestigation(item) {
    setSelectedInvestigation(item);

    setForm({
      employee_id: item.employee_id || "",
      title: item.title || "",
      description: item.description || "",
      investigation_type:
        item.investigation_type || "general",
      priority: item.priority || "normal",
      status: item.status || "open",
      investigator_id:
        item.investigator_id || "",
      target_date: item.target_date
        ? item.target_date.slice(0, 10)
        : "",
      findings: item.findings || "",
      resolution: item.resolution || "",
      notes: item.notes || "",
    });

    setEditing(false);
    setShowDetails(true);

    loadInvestigationDetails(item.id);
  }

  function closeDetails() {
    setShowDetails(false);
    setSelectedInvestigation(null);
    setEditing(false);
    setEvents([]);
    setEvidence([]);
  }

  function startEditing() {
    if (!selectedInvestigation) return;

    setForm({
      employee_id:
        selectedInvestigation.employee_id || "",
      title:
        selectedInvestigation.title || "",
      description:
        selectedInvestigation.description || "",
      investigation_type:
        selectedInvestigation.investigation_type ||
        "general",
      priority:
        selectedInvestigation.priority ||
        "normal",
      status:
        selectedInvestigation.status ||
        "open",
      investigator_id:
        selectedInvestigation.investigator_id ||
        "",
      target_date:
        selectedInvestigation.target_date
          ? selectedInvestigation.target_date.slice(
              0,
              10
            )
          : "",
      findings:
        selectedInvestigation.findings || "",
      resolution:
        selectedInvestigation.resolution || "",
      notes:
        selectedInvestigation.notes || "",
    });

    setEditing(true);
  }

  async function handleCreateOrUpdate(event) {
    event.preventDefault();

    if (!form.employee_id) {
      setError("Please select an employee.");
      return;
    }

    if (!form.title.trim()) {
      setError(
        "Please enter an investigation title."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        employee_id: form.employee_id,
        title: form.title.trim(),
        description:
          form.description.trim() || null,
        investigation_type:
          form.investigation_type,
        priority: form.priority,
        status: form.status,
        investigator_id:
          form.investigator_id || null,
        target_date:
          form.target_date
            ? new Date(
                `${form.target_date}T23:59:59`
              ).toISOString()
            : null,
        findings:
          form.findings.trim() || null,
        resolution:
          form.resolution.trim() || null,
        notes:
          form.notes.trim() || null,
      };

      if (editing && selectedInvestigation) {
        const response = await api.put(
          `/investigations/${selectedInvestigation.id}`,
          payload
        );

        const updated =
          response.data?.investigation;

        setSelectedInvestigation(updated);

        setInvestigations((current) =>
          current.map((item) =>
            item.id === updated.id
              ? updated
              : item
          )
        );

        setEditing(false);

        await loadInvestigationDetails(
          updated.id
        );
      } else {
        const response = await api.post(
          "/investigations",
          payload
        );

        const created =
          response.data?.investigation;

        if (created) {
          setInvestigations((current) => [
            created,
            ...current,
          ]);

          setShowCreateModal(false);
          setForm(EMPTY_FORM);

          setSelectedInvestigation(created);
          setShowDetails(true);

          await loadInvestigationDetails(
            created.id
          );
        }
      }
    } catch (err) {
      console.error(
        "[InvestigationTracker] Save error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Failed to save investigation."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedInvestigation) return;

    const confirmed = window.confirm(
      `Delete investigation ${selectedInvestigation.investigation_number}? This will also delete its timeline and evidence records.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      await api.delete(
        `/investigations/${selectedInvestigation.id}`
      );

      setInvestigations((current) =>
        current.filter(
          (item) =>
            item.id !== selectedInvestigation.id
        )
      );

      closeDetails();
    } catch (err) {
      console.error(
        "[InvestigationTracker] Delete error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Failed to delete investigation."
        )
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleStatusChange(status) {
    if (
      !selectedInvestigation ||
      status === selectedInvestigation.status
    ) {
      return;
    }

    try {
      setUpdatingStatus(true);
      setError("");

      const response = await api.patch(
        `/investigations/${selectedInvestigation.id}/status`,
        { status }
      );

      const updated =
        response.data?.investigation;

      setSelectedInvestigation(updated);

      setInvestigations((current) =>
        current.map((item) =>
          item.id === updated.id
            ? updated
            : item
        )
      );

      await loadInvestigationDetails(
        updated.id
      );
    } catch (err) {
      console.error(
        "[InvestigationTracker] Status error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Failed to update investigation status."
        )
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  function handleEventFormChange(event) {
    const { name, value } = event.target;

    setEventForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleAddEvent(event) {
    event.preventDefault();

    if (!selectedInvestigation) return;

    if (!eventForm.title.trim()) {
      setError("Event title is required.");
      return;
    }

    try {
      setSavingEvent(true);
      setError("");

      await api.post(
        `/investigations/${selectedInvestigation.id}/events`,
        {
          event_type:
            eventForm.event_type,
          title:
            eventForm.title.trim(),
          description:
            eventForm.description.trim() ||
            null,
          event_at:
            eventForm.event_at
              ? new Date(
                  eventForm.event_at
                ).toISOString()
              : null,
        }
      );

      setEventForm(EMPTY_EVENT_FORM);
      setShowEventForm(false);

      await loadInvestigationDetails(
        selectedInvestigation.id
      );
    } catch (err) {
      console.error(
        "[InvestigationTracker] Add event error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Failed to add event."
        )
      );
    } finally {
      setSavingEvent(false);
    }
  }

  function handleEvidenceFormChange(event) {
    const { name, value } = event.target;

    setEvidenceForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleAddEvidence(event) {
    event.preventDefault();

    if (!selectedInvestigation) return;

    if (!evidenceForm.title.trim()) {
      setError("Evidence title is required.");
      return;
    }

    try {
      setSavingEvidence(true);
      setError("");

      await api.post(
        `/investigations/${selectedInvestigation.id}/evidence`,
        {
          evidence_type:
            evidenceForm.evidence_type,
          title:
            evidenceForm.title.trim(),
          description:
            evidenceForm.description.trim() ||
            null,
          source_url:
            evidenceForm.source_url.trim() ||
            null,
          collected_at:
            evidenceForm.collected_at
              ? new Date(
                  evidenceForm.collected_at
                ).toISOString()
              : null,
          collected_by:
            evidenceForm.collected_by ||
            null,
        }
      );

      setEvidenceForm(
        EMPTY_EVIDENCE_FORM
      );

      setShowEvidenceForm(false);

      await loadInvestigationDetails(
        selectedInvestigation.id
      );
    } catch (err) {
      console.error(
        "[InvestigationTracker] Add evidence error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Failed to add evidence."
        )
      );
    } finally {
      setSavingEvidence(false);
    }
  }

  async function handleDeleteEvidence(
    evidenceId
  ) {
    if (!selectedInvestigation) return;

    const confirmed = window.confirm(
      "Delete this evidence record?"
    );

    if (!confirmed) return;

    try {
      setError("");

      await api.delete(
        `/investigations/${selectedInvestigation.id}/evidence/${evidenceId}`
      );

      await loadInvestigationDetails(
        selectedInvestigation.id
      );
    } catch (err) {
      console.error(
        "[InvestigationTracker] Delete evidence error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Failed to delete evidence."
        )
      );
    }
  }

  function getPriorityClass(priority) {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-700";
      case "high":
        return "bg-orange-100 text-orange-700";
      case "normal":
        return "bg-blue-100 text-blue-700";
      case "low":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  function getStatusClass(status) {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-700";
      case "under_review":
        return "bg-yellow-100 text-yellow-700";
      case "investigation":
        return "bg-purple-100 text-purple-700";
      case "resolved":
        return "bg-green-100 text-green-700";
      case "closed":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  return (
    <div className="min-w-0 w-full space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <Shield size={22} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Investigation Tracker
              </h1>

              <p className="text-sm text-gray-500">
                Manage employee investigations,
                evidence, findings and resolutions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadInvestigations}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={17} />
            New Investigation
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <div className="flex-1">
            {error}
          </div>

          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-500 hover:text-red-700"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total"
          value={stats.total}
          icon={<ClipboardList size={20} />}
        />

        <StatCard
          title="Open"
          value={stats.open}
          icon={<Clock size={20} />}
        />

        <StatCard
          title="Active"
          value={stats.active}
          icon={<Shield size={20} />}
        />

        <StatCard
          title="Resolved"
          value={stats.resolved}
          icon={<CheckCircle2 size={20} />}
        />

        <StatCard
          title="Critical"
          value={stats.critical}
          icon={<AlertCircle size={20} />}
        />
      </div>

      {/* FILTERS */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 xl:flex-row"
        >
          <div className="relative min-w-0 flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search investigation number, title or employee..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <SelectField
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            options={[
              {
                value: "",
                label: "All statuses",
              },
              ...STATUS_OPTIONS,
            ]}
          />

          <SelectField
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(
                event.target.value
              )
            }
            options={[
              {
                value: "",
                label: "All priorities",
              },
              ...PRIORITY_OPTIONS,
            ]}
          />

          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Search
          </button>
        </form>
      </div>

      {/* TABLE */}
      <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Investigation
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Employee
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Type
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Priority
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Target Date
                </th>

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-14 text-center text-sm text-gray-500"
                  >
                    Loading investigations...
                  </td>
                </tr>
              ) : filteredInvestigations.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-14 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <ClipboardList
                        size={38}
                        className="mb-3 text-gray-300"
                      />

                      <p className="font-medium text-gray-700">
                        No investigations found
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Create your first investigation
                        to start tracking it.
                      </p>

                      <button
                        type="button"
                        onClick={openCreate}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        <Plus size={16} />
                        New Investigation
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvestigations.map(
                  (item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            openInvestigation(
                              item
                            )
                          }
                          className="text-left"
                        >
                          <div className="font-semibold text-indigo-600 hover:text-indigo-800">
                            {
                              item.investigation_number
                            }
                          </div>

                          <div className="mt-1 max-w-[280px] truncate text-sm font-medium text-gray-900">
                            {item.title}
                          </div>
                        </button>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                            <User size={15} />
                          </div>

                          <span className="text-sm text-gray-700">
                            {getEmployeeName(
                              employeeMap[
                                item.employee_id
                              ]
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {labelFor(
                          TYPE_OPTIONS,
                          item.investigation_type
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getPriorityClass(
                            item.priority
                          )}`}
                        >
                          {labelFor(
                            PRIORITY_OPTIONS,
                            item.priority
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(
                            item.status
                          )}`}
                        >
                          {labelFor(
                            STATUS_OPTIONS,
                            item.status
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {formatDate(
                          item.target_date
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            openInvestigation(
                              item
                            )
                          }
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <Modal
          title="Create Investigation"
          onClose={closeCreate}
          size="large"
        >
          <InvestigationForm
            form={form}
            employees={employees}
            employeesLoading={employeesLoading}
            onChange={handleFormChange}
            onSubmit={handleCreateOrUpdate}
            onCancel={closeCreate}
            saving={saving}
            submitLabel="Create Investigation"
          />
        </Modal>
      )}

      {/* DETAILS */}
      {showDetails &&
        selectedInvestigation && (
          <Modal
            title={
              selectedInvestigation.investigation_number
            }
            subtitle={
              selectedInvestigation.title
            }
            onClose={closeDetails}
            size="xl"
          >
            <div className="space-y-6">
              {/* DETAIL HEADER */}
              <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(
                        selectedInvestigation.status
                      )}`}
                    >
                      {labelFor(
                        STATUS_OPTIONS,
                        selectedInvestigation.status
                      )}
                    </span>

                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getPriorityClass(
                        selectedInvestigation.priority
                      )}`}
                    >
                      {labelFor(
                        PRIORITY_OPTIONS,
                        selectedInvestigation.priority
                      )}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-gray-500">
                    Opened{" "}
                    {formatDateTime(
                      selectedInvestigation.opened_at
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={startEditing}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={16} />

                    {deleting
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </div>
              </div>

              {/* EDIT */}
              {editing ? (
                <InvestigationForm
                  form={form}
                  employees={employees}
                  employeesLoading={
                    employeesLoading
                  }
                  onChange={handleFormChange}
                  onSubmit={
                    handleCreateOrUpdate
                  }
                  onCancel={() =>
                    setEditing(false)
                  }
                  saving={saving}
                  submitLabel="Save Changes"
                />
              ) : (
                <>
                  {/* OVERVIEW */}
                  <section>
                    <SectionTitle
                      icon={
                        <FileText size={18} />
                      }
                      title="Investigation Details"
                    />

                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <DetailItem
                        label="Employee"
                        value={getEmployeeName(
                          employeeMap[
                            selectedInvestigation
                              .employee_id
                          ]
                        )}
                      />

                      <DetailItem
                        label="Investigation Type"
                        value={labelFor(
                          TYPE_OPTIONS,
                          selectedInvestigation.investigation_type
                        )}
                      />

                      <DetailItem
                        label="Investigator"
                        value={
                          selectedInvestigation.investigator_id ||
                          "Not assigned"
                        }
                      />

                      <DetailItem
                        label="Target Date"
                        value={formatDate(
                          selectedInvestigation.target_date
                        )}
                      />

                      <DetailItem
                        label="Created"
                        value={formatDateTime(
                          selectedInvestigation.created_at
                        )}
                      />

                      <DetailItem
                        label="Last Updated"
                        value={formatDateTime(
                          selectedInvestigation.updated_at
                        )}
                      />
                    </div>

                    <div className="mt-4 space-y-4">
                      <TextBlock
                        label="Description"
                        value={
                          selectedInvestigation.description
                        }
                      />

                      <TextBlock
                        label="Findings"
                        value={
                          selectedInvestigation.findings
                        }
                      />

                      <TextBlock
                        label="Resolution"
                        value={
                          selectedInvestigation.resolution
                        }
                      />

                      <TextBlock
                        label="Notes"
                        value={
                          selectedInvestigation.notes
                        }
                      />
                    </div>
                  </section>

                  {/* STATUS */}
                  <section>
                    <SectionTitle
                      icon={
                        <CheckCircle2 size={18} />
                      }
                      title="Update Status"
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map(
                        (option) => (
                          <button
                            key={option.value}
                            type="button"
                            disabled={
                              updatingStatus
                            }
                            onClick={() =>
                              handleStatusChange(
                                option.value
                              )
                            }
                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                              selectedInvestigation.status ===
                              option.value
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {option.label}
                          </button>
                        )
                      )}
                    </div>
                  </section>

                  {/* TIMELINE */}
                  <section>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <SectionTitle
                        icon={
                          <Clock size={18} />
                        }
                        title="Investigation Timeline"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setEventForm(
                            EMPTY_EVENT_FORM
                          );
                          setShowEventForm(
                            (value) => !value
                          );
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                      >
                        <Plus size={16} />
                        Add Event
                      </button>
                    </div>

                    {showEventForm && (
                      <form
                        onSubmit={
                          handleAddEvent
                        }
                        className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <SelectField
                            label="Event Type"
                            name="event_type"
                            value={
                              eventForm.event_type
                            }
                            onChange={
                              handleEventFormChange
                            }
                            options={EVENT_TYPES}
                          />

                          <InputField
                            label="Event Title"
                            name="title"
                            value={
                              eventForm.title
                            }
                            onChange={
                              handleEventFormChange
                            }
                            placeholder="e.g. Employee interview completed"
                            required
                          />

                          <InputField
                            label="Event Date"
                            name="event_at"
                            type="datetime-local"
                            value={
                              eventForm.event_at
                            }
                            onChange={
                              handleEventFormChange
                            }
                          />

                          <div className="md:col-span-2">
                            <TextAreaField
                              label="Description"
                              name="description"
                              value={
                                eventForm.description
                              }
                              onChange={
                                handleEventFormChange
                              }
                              rows={3}
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setShowEventForm(
                                false
                              )
                            }
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
                          >
                            Cancel
                          </button>

                          <button
                            type="submit"
                            disabled={savingEvent}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {savingEvent
                              ? "Saving..."
                              : "Add Event"}
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="mt-4 space-y-3">
                      {eventsLoading ? (
                        <LoadingBox text="Loading timeline..." />
                      ) : events.length === 0 ? (
                        <EmptyBox text="No timeline events yet." />
                      ) : (
                        events.map((event) => (
                          <div
                            key={event.id}
                            className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4"
                          >
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                              <Clock
                                size={17}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {event.title}
                                  </p>

                                  <p className="text-xs text-gray-500">
                                    {labelFor(
                                      EVENT_TYPES,
                                      event.event_type
                                    )}
                                  </p>
                                </div>

                                <span className="text-xs text-gray-500">
                                  {formatDateTime(
                                    event.event_at
                                  )}
                                </span>
                              </div>

                              {event.description && (
                                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                                  {
                                    event.description
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  {/* EVIDENCE */}
                  <section>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <SectionTitle
                        icon={
                          <FileText size={18} />
                        }
                        title="Evidence"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setEvidenceForm(
                            EMPTY_EVIDENCE_FORM
                          );
                          setShowEvidenceForm(
                            (value) => !value
                          );
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                      >
                        <Plus size={16} />
                        Add Evidence
                      </button>
                    </div>

                    {showEvidenceForm && (
                      <form
                        onSubmit={
                          handleAddEvidence
                        }
                        className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <SelectField
                            label="Evidence Type"
                            name="evidence_type"
                            value={
                              evidenceForm.evidence_type
                            }
                            onChange={
                              handleEvidenceFormChange
                            }
                            options={
                              EVIDENCE_TYPES
                            }
                          />

                          <InputField
                            label="Title"
                            name="title"
                            value={
                              evidenceForm.title
                            }
                            onChange={
                              handleEvidenceFormChange
                            }
                            placeholder="Evidence title"
                            required
                          />

                          <InputField
                            label="Collected At"
                            name="collected_at"
                            type="datetime-local"
                            value={
                              evidenceForm.collected_at
                            }
                            onChange={
                              handleEvidenceFormChange
                            }
                          />

                          <InputField
                            label="Source URL"
                            name="source_url"
                            value={
                              evidenceForm.source_url
                            }
                            onChange={
                              handleEvidenceFormChange
                            }
                            placeholder="https://..."
                          />

                          <SelectField
                            label="Collected By"
                            name="collected_by"
                            value={
                              evidenceForm.collected_by
                            }
                            onChange={
                              handleEvidenceFormChange
                            }
                            options={[
                              {
                                value: "",
                                label:
                                  "Current user",
                              },
                              ...employees.map(
                                (employee) => ({
                                  value:
                                    employee.id,
                                  label:
                                    getEmployeeName(
                                      employee
                                    ),
                                })
                              ),
                            ]}
                          />

                          <div className="md:col-span-2">
                            <TextAreaField
                              label="Description"
                              name="description"
                              value={
                                evidenceForm.description
                              }
                              onChange={
                                handleEvidenceFormChange
                              }
                              rows={3}
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setShowEvidenceForm(
                                false
                              )
                            }
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
                          >
                            Cancel
                          </button>

                          <button
                            type="submit"
                            disabled={
                              savingEvidence
                            }
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {savingEvidence
                              ? "Saving..."
                              : "Add Evidence"}
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="mt-4 space-y-3">
                      {evidenceLoading ? (
                        <LoadingBox text="Loading evidence..." />
                      ) : evidence.length === 0 ? (
                        <EmptyBox text="No evidence has been added." />
                      ) : (
                        evidence.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-gray-200 bg-white p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex min-w-0 gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                                  <FileText
                                    size={17}
                                  />
                                </div>

                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900">
                                    {item.title}
                                  </p>

                                  <p className="mt-0.5 text-xs text-gray-500">
                                    {labelFor(
                                      EVIDENCE_TYPES,
                                      item.evidence_type
                                    )}
                                  </p>

                                  {item.description && (
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                                      {
                                        item.description
                                      }
                                    </p>
                                  )}

                                  {item.source_url && (
                                    <a
                                      href={
                                        item.source_url
                                      }
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-2 block break-all text-sm text-indigo-600 hover:underline"
                                    >
                                      {
                                        item.source_url
                                      }
                                    </a>
                                  )}

                                  <p className="mt-2 text-xs text-gray-500">
                                    Collected{" "}
                                    {formatDateTime(
                                      item.collected_at
                                    )}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteEvidence(
                                    item.id
                                  )
                                }
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                              >
                                <Trash2
                                  size={15}
                                />
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
          </Modal>
        )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Reusable UI components
|--------------------------------------------------------------------------
*/

function StatCard({
  title,
  value,
  icon,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {title}
          </p>

          <p className="mt-1 text-2xl font-bold text-gray-900">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  size = "large",
}) {
  const widthClass =
    size === "xl"
      ? "max-w-6xl"
      : "max-w-3xl";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div
        className={`relative flex max-h-[92vh] w-full ${widthClass} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-gray-900">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-0.5 truncate text-sm text-gray-500">
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-4 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={19} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function InvestigationForm({
  form,
  employees,
  employeesLoading,
  onChange,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField
          label="Employee"
          name="employee_id"
          value={form.employee_id}
          onChange={onChange}
          disabled={employeesLoading}
          required
          options={[
            {
              value: "",
              label: employeesLoading
                ? "Loading employees..."
                : "Select employee",
            },
            ...employees.map((employee) => ({
              value: employee.id,
              label: getEmployeeName(
                employee
              ),
            })),
          ]}
        />

        <InputField
          label="Investigation Title"
          name="title"
          value={form.title}
          onChange={onChange}
          placeholder="Enter investigation title"
          required
        />

        <SelectField
          label="Investigation Type"
          name="investigation_type"
          value={form.investigation_type}
          onChange={onChange}
          options={TYPE_OPTIONS}
        />

        <SelectField
          label="Priority"
          name="priority"
          value={form.priority}
          onChange={onChange}
          options={PRIORITY_OPTIONS}
        />

        <SelectField
          label="Status"
          name="status"
          value={form.status}
          onChange={onChange}
          options={STATUS_OPTIONS}
        />

        <SelectField
          label="Investigator"
          name="investigator_id"
          value={form.investigator_id}
          onChange={onChange}
          options={[
            {
              value: "",
              label: "Assign later",
            },
            ...employees.map((employee) => ({
              value: employee.id,
              label: getEmployeeName(
                employee
              ),
            })),
          ]}
        />

        <InputField
          label="Target Date"
          name="target_date"
          type="date"
          value={form.target_date}
          onChange={onChange}
        />

        <div className="hidden md:block" />
      </div>

      <TextAreaField
        label="Description"
        name="description"
        value={form.description}
        onChange={onChange}
        placeholder="Describe the investigation..."
        rows={4}
      />

      <TextAreaField
        label="Findings"
        name="findings"
        value={form.findings}
        onChange={onChange}
        placeholder="Investigation findings..."
        rows={4}
      />

      <TextAreaField
        label="Resolution"
        name="resolution"
        value={form.resolution}
        onChange={onChange}
        placeholder="Resolution or outcome..."
        rows={4}
      />

      <TextAreaField
        label="Notes"
        name="notes"
        value={form.notes}
        onChange={onChange}
        placeholder="Additional notes..."
        rows={3}
      />

      <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : submitLabel}
        </button>
      </div>
    </form>
  );
}

function InputField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  disabled = false,
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </span>
      )}

      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-9 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
      </div>
    </label>
  );
}

function TextAreaField({
  label,
  name,
  value,
  onChange,
  placeholder,
  rows = 4,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </span>

      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  );
}

function DetailItem({
  label,
  value,
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-medium text-gray-900">
        {value || "—"}
      </p>
    </div>
  );
}

function TextBlock({
  label,
  value,
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-gray-800">
        {label}
      </p>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600">
          {value || "No information provided."}
        </p>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-indigo-600">
        {icon}
      </div>

      <h3 className="text-base font-semibold text-gray-900">
        {title}
      </h3>
    </div>
  );
}

function LoadingBox({ text }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
      {text}
    </div>
  );
}

function EmptyBox({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
      {text}
    </div>
  );
}