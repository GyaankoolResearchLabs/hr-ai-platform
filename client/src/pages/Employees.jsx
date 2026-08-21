import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Users,
  Loader2,
  X,
  Search,
  Pencil,
  Trash2,
  Mail,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  UserRound,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  MapPin,
  BadgeCheck,
} from "lucide-react";
import { employeeService } from "../services/employeeService";

const emptyForm = {
  full_name: "",
  email: "",
  department: "",
  title: "",
  employee_code: "",
  joining_date: "",
  employment_status: "Active",
  last_working_date: "",
  address: "",
};

const EMPLOYMENT_STATUSES = [
  "Active",
  "On Leave",
  "Resigned",
  "Terminated",
  "Retired",
];

function formatDate(dateString) {
  if (!dateString) return "—";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(status) {
  if (!status) return "Active";
  return status;
}

function getStatusClasses(status) {
  switch (status) {
    case "Active":
      return "bg-emerald-50 text-emerald-700";
    case "On Leave":
      return "bg-amber-50 text-amber-700";
    case "Resigned":
      return "bg-blue-50 text-blue-700";
    case "Terminated":
      return "bg-red-50 text-red-700";
    case "Retired":
      return "bg-purple-50 text-purple-700";
    default:
      return "bg-ink-50 text-ink-600";
  }
}

/* -------------------------------------------------------
   CSV PARSING
------------------------------------------------------- */

function parseCSVLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];
    const nextCharacter = line[i + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());

  return values;
}

function parseCSV(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    throw new Error(
      "The CSV file must contain a header and at least one employee."
    );
  }

  const headers = parseCSVLine(lines[0]).map((header) =>
    header.trim().toLowerCase().replace(/\s+/g, "_")
  );

  const requiredHeaders = ["full_name", "email"];

  const missingHeaders = requiredHeaders.filter(
    (header) => !headers.includes(header)
  );

  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing required columns: ${missingHeaders.join(", ")}`
    );
  }

  const employees = [];
  const validationErrors = [];
  const emailSet = new Set();
  const employeeCodeSet = new Set();

  lines.slice(1).forEach((line, index) => {
    const rowNumber = index + 2;
    const values = parseCSVLine(line);

    const employee = {
      full_name: "",
      email: "",
      department: "",
      title: "",
      employee_code: "",
      joining_date: "",
      employment_status: "Active",
      last_working_date: "",
      address: "",
    };

    headers.forEach((header, columnIndex) => {
      if (header in employee) {
        employee[header] = values[columnIndex] || "";
      }
    });

    employee.full_name = employee.full_name.trim();
    employee.email = employee.email.trim().toLowerCase();
    employee.department = employee.department.trim();
    employee.title = employee.title.trim();
    employee.employee_code = employee.employee_code.trim();
    employee.joining_date = employee.joining_date.trim();
    employee.employment_status =
      employee.employment_status.trim() || "Active";
    employee.last_working_date = employee.last_working_date.trim();
    employee.address = employee.address.trim();

    const errors = [];

    if (!employee.full_name) {
      errors.push("Full name is required");
    }

    if (!employee.email) {
      errors.push("Email is required");
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)
    ) {
      errors.push("Invalid email");
    }

    if (employee.email && emailSet.has(employee.email)) {
      errors.push("Duplicate email in this CSV");
    }

    if (employee.email) {
      emailSet.add(employee.email);
    }

    if (
      employee.employee_code &&
      employeeCodeSet.has(employee.employee_code.toLowerCase())
    ) {
      errors.push("Duplicate employee code in this CSV");
    }

    if (employee.employee_code) {
      employeeCodeSet.add(employee.employee_code.toLowerCase());
    }

    if (
      employee.employment_status &&
      !EMPLOYMENT_STATUSES.includes(employee.employment_status)
    ) {
      errors.push(
        `Invalid employment status. Use: ${EMPLOYMENT_STATUSES.join(", ")}`
      );
    }

    if (
      employee.joining_date &&
      Number.isNaN(new Date(employee.joining_date).getTime())
    ) {
      errors.push("Invalid joining date");
    }

    if (
      employee.last_working_date &&
      Number.isNaN(new Date(employee.last_working_date).getTime())
    ) {
      errors.push("Invalid last working date");
    }

    if (errors.length > 0) {
      validationErrors.push({
        row: rowNumber,
        employee,
        errors,
      });
    } else {
      employees.push(employee);
    }
  });

  return {
    employees,
    validationErrors,
  };
}

/* -------------------------------------------------------
   CSV TEMPLATE
------------------------------------------------------- */

function downloadTemplate() {
  const csv = [
    "full_name,email,department,title,employee_code,joining_date,employment_status,last_working_date,address",
    "Rahul Sharma,rahul@company.com,Marketing,Marketing Manager,EMP001,2026-01-15,Active,,Bangalore",
    "Priya Rao,priya@company.com,Marketing,Marketing Executive,EMP002,2026-02-10,Active,,Mumbai",
    "Amit Kumar,amit@company.com,IT,Software Engineer,EMP003,2025-08-20,Active,,Delhi",
    "Sneha Patel,sneha@company.com,Finance,Accountant,EMP004,2024-05-12,Resigned,2026-03-31,Pune",
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "employee-import-template.csv";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------
   MAIN COMPONENT
------------------------------------------------------- */

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [deletingEmployee, setDeletingEmployee] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkEmployees, setBulkEmployees] = useState([]);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  /* -------------------------------------------------------
     LOAD EMPLOYEES
  ------------------------------------------------------- */

  async function loadEmployees() {
    setLoading(true);
    setError("");

    try {
      const data = await employeeService.list();

      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load employees:", err);

      setError(
        "Couldn't load employees. Make sure the backend is running and your session is active."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  /* -------------------------------------------------------
     FILTER DATA
  ------------------------------------------------------- */

  const departments = useMemo(() => {
    const values = employees
      .map((employee) => employee.department?.trim())
      .filter(Boolean);

    return [...new Set(values)].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !query ||
        employee.full_name?.toLowerCase().includes(query) ||
        employee.email?.toLowerCase().includes(query) ||
        employee.department?.toLowerCase().includes(query) ||
        employee.title?.toLowerCase().includes(query) ||
        employee.employee_code?.toLowerCase().includes(query) ||
        employee.address?.toLowerCase().includes(query) ||
        employee.employment_status?.toLowerCase().includes(query);

      const matchesDepartment =
        departmentFilter === "all" ||
        employee.department === departmentFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (employee.employment_status || "Active") === statusFilter;

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesStatus
      );
    });
  }, [employees, search, departmentFilter, statusFilter]);

  /* -------------------------------------------------------
     FORM
  ------------------------------------------------------- */

  function openAddForm() {
    setEditingEmployee(null);
    setForm(emptyForm);
    setShowForm(true);
    setError("");
  }

  function openEditForm(employee) {
    setEditingEmployee(employee);
    setSelectedEmployee(null);

    setForm({
      full_name: employee.full_name || "",
      email: employee.email || "",
      department: employee.department || "",
      title: employee.title || "",
      employee_code: employee.employee_code || "",
      joining_date: employee.joining_date || "",
      employment_status:
        employee.employment_status || "Active",
      last_working_date: employee.last_working_date || "",
      address: employee.address || "",
    });

    setShowForm(true);
    setError("");
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingEmployee(null);
    setForm(emptyForm);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.full_name.trim() || !form.email.trim()) {
      setError("Full name and email are required.");
      return;
    }

    if (
      form.employment_status !== "Active" &&
      !form.last_working_date
    ) {
      setError(
        "Please provide the last working date for employees who are no longer active."
      );
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      department: form.department.trim(),
      title: form.title.trim(),
      employee_code: form.employee_code.trim(),
      joining_date: form.joining_date || null,
      employment_status:
        form.employment_status || "Active",
      last_working_date:
        form.last_working_date || null,
      address: form.address.trim(),
    };

    try {
      if (editingEmployee) {
        const updated = await employeeService.update(
          editingEmployee.id,
          payload
        );

        setEmployees((current) =>
          current.map((employee) =>
            employee.id === editingEmployee.id
              ? updated
              : employee
          )
        );

        setSelectedEmployee(updated);
      } else {
        const created = await employeeService.create(payload);

        setEmployees((current) => [
          created,
          ...current,
        ]);
      }

      closeForm();
    } catch (err) {
      console.error("Failed to save employee:", err);

      setError(
        err?.response?.data?.message ||
          (editingEmployee
            ? "Couldn't update this employee. Please try again."
            : "Couldn't save this employee. Please try again.")
      );
    } finally {
      setSaving(false);
    }
  }

  /* -------------------------------------------------------
     DELETE
  ------------------------------------------------------- */

  async function handleDelete() {
    if (!deletingEmployee) return;

    setDeleting(true);
    setError("");

    try {
      await employeeService.delete(
        deletingEmployee.id
      );

      setEmployees((current) =>
        current.filter(
          (employee) =>
            employee.id !== deletingEmployee.id
        )
      );

      if (
        selectedEmployee?.id ===
        deletingEmployee.id
      ) {
        setSelectedEmployee(null);
      }

      setDeletingEmployee(null);
    } catch (err) {
      console.error("Failed to delete employee:", err);

      setError(
        err?.response?.data?.message ||
          "Couldn't delete this employee. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  }

  /* -------------------------------------------------------
     BULK IMPORT
  ------------------------------------------------------- */

  function openBulkImport() {
    setBulkEmployees([]);
    setBulkErrors([]);
    setBulkFileName("");
    setBulkResult(null);
    setShowBulkImport(true);
    setError("");
  }

  function closeBulkImport() {
    if (bulkImporting) return;

    setShowBulkImport(false);
    setBulkEmployees([]);
    setBulkErrors([]);
    setBulkFileName("");
    setBulkResult(null);
  }

  function handleCSVFile(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setBulkFileName(file.name);
    setBulkResult(null);
    setBulkEmployees([]);
    setBulkErrors([]);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setBulkErrors([
        {
          row: null,
          employee: {},
          errors: ["Please upload a CSV file"],
        },
      ]);

      return;
    }

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      try {
        const result = parseCSV(
          loadEvent.target.result
        );

        setBulkEmployees(result.employees);
        setBulkErrors(result.validationErrors);
      } catch (err) {
        setBulkErrors([
          {
            row: null,
            employee: {},
            errors: [
              err.message ||
                "Could not read this CSV file",
            ],
          },
        ]);
      }
    };

    reader.onerror = () => {
      setBulkErrors([
        {
          row: null,
          employee: {},
          errors: ["Could not read this file"],
        },
      ]);
    };

    reader.readAsText(file);
  }

  async function handleBulkImport() {
    if (bulkEmployees.length === 0) {
      setError(
        "There are no valid employee records to import."
      );
      return;
    }

    setBulkImporting(true);
    setError("");
    setBulkResult(null);

    try {
      const result =
        await employeeService.bulkCreate(
          bulkEmployees
        );

      setBulkResult(result);

      if (result.employees?.length) {
        setEmployees((current) => [
          ...result.employees,
          ...current,
        ]);
      }

      if (result.rejectedRecords?.length) {
        setBulkErrors(
          result.rejectedRecords.map((record) => ({
            row: record.row,
            employee: {
              full_name: record.full_name,
              email: record.email,
            },
            errors: record.errors,
          }))
        );
      }

      setBulkEmployees([]);
    } catch (err) {
      console.error("Bulk import failed:", err);

      setError(
        err?.response?.data?.message ||
          "Couldn't import the employees. Please try again."
      );
    } finally {
      setBulkImporting(false);
    }
  }

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <div className="min-w-0">
      {/* HEADER */}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Employee Data Hub
          </h1>

          <p className="mt-1 text-sm text-ink-500">
            One authoritative employee record for your
            organization.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openBulkImport}
            className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            <Upload className="h-4 w-4" />
            Bulk import
          </button>

          <button
            type="button"
            onClick={
              showForm ? closeForm : openAddForm
            }
            className="flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-900"
          >
            {showForm ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}

            {showForm ? "Cancel" : "Add employee"}
          </button>
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <div className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-soft px-4 py-3 text-sm text-ink-800">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            className="shrink-0 text-ink-500 hover:text-ink-900"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ADD / EDIT FORM */}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card mb-6 p-5"
        >
          <div className="mb-5">
            <h2 className="text-base font-semibold text-ink-900">
              {editingEmployee
                ? "Edit employee record"
                : "Add employee"}
            </h2>

            <p className="mt-1 text-sm text-ink-500">
              {editingEmployee
                ? "Update the authoritative employee information."
                : "Create a centralized employee record for your organization."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* NAME */}

            <div>
              <label
                htmlFor="full_name"
                className="mb-1.5 block text-sm font-medium text-ink-700"
              >
                Full name
              </label>

              <input
                id="full_name"
                name="full_name"
                required
                value={form.full_name}
                onChange={handleChange}
                placeholder="e.g. Raju Kumar"
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {/* EMAIL */}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-ink-700"
              >
                Email
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="employee@company.com"
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {/* EMPLOYEE CODE */}

            <div>
              <label
                htmlFor="employee_code"
                className="mb-1.5 block text-sm font-medium text-ink-700"
              >
                Employee code
              </label>

              <input
                id="employee_code"
                name="employee_code"
                value={form.employee_code}
                onChange={handleChange}
                placeholder="e.g. EMP001"
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {/* DEPARTMENT */}

            <div>
              <label
                htmlFor="department"
                className="mb-1.5 block text-sm font-medium text-ink-700"
              >
                Department
              </label>

              <input
                id="department"
                name="department"
                value={form.department}
                onChange={handleChange}
                placeholder="e.g. Marketing"
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {/* TITLE */}

            <div>
              <label
                htmlFor="title"
                className="mb-1.5 block text-sm font-medium text-ink-700"
              >
                Job title
              </label>

              <input
                id="title"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Marketing Manager"
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {/* JOINING DATE */}

            <div>
              <label
                htmlFor="joining_date"
                className="mb-1.5 block text-sm font-medium text-ink-700"
              >
                Joining date
              </label>

              <input
                id="joining_date"
                name="joining_date"
                type="date"
                value={form.joining_date}
                onChange={handleChange}
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {/* STATUS */}

            <div>
              <label
                htmlFor="employment_status"
                className="mb-1.5 block text-sm font-medium text-ink-700"
              >
                Employment status
              </label>

              <select
                id="employment_status"
                name="employment_status"
                value={form.employment_status}
                onChange={handleChange}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                {EMPLOYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* LAST WORKING DATE */}

            <div>
              <label
                htmlFor="last_working_date"
                className="mb-1.5 block text-sm font-medium text-ink-700"
              >
                Last working date
              </label>

              <input
                id="last_working_date"
                name="last_working_date"
                type="date"
                value={form.last_working_date}
                onChange={handleChange}
                disabled={
                  form.employment_status === "Active"
                }
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400"
              />
            </div>

            {/* ADDRESS */}

            <div className="sm:col-span-2">
              <label
                htmlFor="address"
                className="mb-1.5 block text-sm font-medium text-ink-700"
              >
                Address
              </label>

              <textarea
                id="address"
                name="address"
                rows={3}
                value={form.address}
                onChange={handleChange}
                placeholder="Employee residential address"
                className="w-full resize-y rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              {editingEmployee
                ? "Update employee"
                : "Save employee"}
            </button>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* SUMMARY */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Users className="h-5 w-5" />
            </span>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Total employees
              </p>

              <p className="mt-1 text-xl font-semibold text-ink-950">
                {employees.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Building2 className="h-5 w-5" />
            </span>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Departments
              </p>

              <p className="mt-1 text-xl font-semibold text-ink-950">
                {departments.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Search className="h-5 w-5" />
            </span>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Showing
              </p>

              <p className="mt-1 text-xl font-semibold text-ink-950">
                {filteredEmployees.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH / FILTER */}

      <div className="card mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="relative min-w-0 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search employees..."
              className="w-full rounded-lg border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(event) =>
              setDepartmentFilter(event.target.value)
            }
            className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="all">
              All departments
            </option>

            {departments.map((department) => (
              <option
                key={department}
                value={department}
              >
                {department}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="all">
              All employment statuses
            </option>

            {EMPLOYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {(search ||
          departmentFilter !== "all" ||
          statusFilter !== "all") && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-400">
              Showing {filteredEmployees.length} of{" "}
              {employees.length} employees
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDepartmentFilter("all");
                setStatusFilter("all");
              }}
              className="text-xs font-medium text-brand-700 hover:text-brand-900"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* EMPLOYEE TABLE */}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading employee records...
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-50 text-ink-400">
              <Users className="h-6 w-6" />
            </span>

            <div>
              <p className="text-sm font-medium text-ink-800">
                No employees yet
              </p>

              <p className="mt-1 text-sm text-ink-500">
                Add your first employee or import a CSV.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={openAddForm}
                className="flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
              >
                <Plus className="h-4 w-4" />
                Add employee
              </button>

              <button
                type="button"
                onClick={openBulkImport}
                className="flex items-center gap-2 rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                <Upload className="h-4 w-4" />
                Bulk import
              </button>
            </div>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Search className="h-8 w-8 text-ink-300" />

            <div>
              <p className="text-sm font-medium text-ink-800">
                No matching employees
              </p>

              <p className="mt-1 text-sm text-ink-500">
                Try a different search or filter.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDepartmentFilter("all");
                setStatusFilter("all");
              }}
              className="text-sm font-medium text-brand-700 hover:text-brand-900"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/50 text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-5 py-3 font-medium">
                    Employee
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Employee code
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Department
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Job title
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Joining date
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Status
                  </th>

                  <th className="px-5 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredEmployees.map((employee) => {
                  const status =
                    employee.employment_status ||
                    "Active";

                  return (
                    <tr
                      key={employee.id}
                      className="border-b border-ink-50 last:border-0 hover:bg-ink-50/40"
                    >
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedEmployee(employee)
                          }
                          className="group flex items-center gap-3 text-left"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                            <UserRound className="h-4 w-4" />
                          </span>

                          <span className="min-w-0">
                            <span className="block font-medium text-ink-900 group-hover:text-brand-700">
                              {employee.full_name}
                            </span>

                            <span className="mt-0.5 block text-xs text-ink-500">
                              {employee.email}
                            </span>
                          </span>
                        </button>
                      </td>

                      <td className="px-5 py-4 text-ink-600">
                        {employee.employee_code || "—"}
                      </td>

                      <td className="px-5 py-4 text-ink-600">
                        {employee.department || "—"}
                      </td>

                      <td className="px-5 py-4 text-ink-600">
                        {employee.title || "—"}
                      </td>

                      <td className="px-5 py-4 text-ink-500">
                        {formatDate(employee.joining_date)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedEmployee(employee)
                            }
                            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                          >
                            View
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openEditForm(employee)
                            }
                            className="flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setDeletingEmployee(employee)
                            }
                            className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EMPLOYEE DETAIL PANEL */}

      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/30 p-0 sm:items-center sm:p-6">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between border-b border-ink-100 px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                  Employee record
                </p>

                <h2 className="mt-1 text-lg font-semibold text-ink-950">
                  {selectedEmployee.full_name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedEmployee(null)
                }
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-800"
                aria-label="Close employee details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* CONTACT */}

              <div className="rounded-xl bg-canvas p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                  Contact
                </p>

                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 shrink-0 text-brand-700" />

                  <div>
                    <p className="text-xs text-ink-400">
                      Email
                    </p>

                    <p className="text-sm font-medium text-ink-800">
                      {selectedEmployee.email}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />

                  <div>
                    <p className="text-xs text-ink-400">
                      Address
                    </p>

                    <p className="text-sm font-medium leading-relaxed text-ink-800">
                      {selectedEmployee.address ||
                        "Not specified"}
                    </p>
                  </div>
                </div>
              </div>

              {/* EMPLOYEE INFORMATION */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-ink-100 p-4">
                  <BadgeCheck className="mb-3 h-5 w-5 text-brand-700" />

                  <p className="text-xs text-ink-400">
                    Employee code
                  </p>

                  <p className="mt-1 text-sm font-medium text-ink-800">
                    {selectedEmployee.employee_code ||
                      "Not specified"}
                  </p>
                </div>

                <div className="rounded-xl border border-ink-100 p-4">
                  <Building2 className="mb-3 h-5 w-5 text-brand-700" />

                  <p className="text-xs text-ink-400">
                    Department
                  </p>

                  <p className="mt-1 text-sm font-medium text-ink-800">
                    {selectedEmployee.department ||
                      "Not specified"}
                  </p>
                </div>

                <div className="rounded-xl border border-ink-100 p-4">
                  <BriefcaseBusiness className="mb-3 h-5 w-5 text-brand-700" />

                  <p className="text-xs text-ink-400">
                    Job title
                  </p>

                  <p className="mt-1 text-sm font-medium text-ink-800">
                    {selectedEmployee.title ||
                      "Not specified"}
                  </p>
                </div>

                <div className="rounded-xl border border-ink-100 p-4">
                  <BadgeCheck className="mb-3 h-5 w-5 text-brand-700" />

                  <p className="text-xs text-ink-400">
                    Employment status
                  </p>

                  <span
                    className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                      selectedEmployee.employment_status ||
                        "Active"
                    )}`}
                  >
                    {formatStatus(
                      selectedEmployee.employment_status
                    )}
                  </span>
                </div>
              </div>

              {/* DATES */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-ink-100 p-4">
                  <CalendarDays className="mb-3 h-5 w-5 text-brand-700" />

                  <p className="text-xs text-ink-400">
                    Joining date
                  </p>

                  <p className="mt-1 text-sm font-medium text-ink-800">
                    {formatDate(
                      selectedEmployee.joining_date
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-ink-100 p-4">
                  <CalendarDays className="mb-3 h-5 w-5 text-brand-700" />

                  <p className="text-xs text-ink-400">
                    Last working date
                  </p>

                  <p className="mt-1 text-sm font-medium text-ink-800">
                    {formatDate(
                      selectedEmployee.last_working_date
                    )}
                  </p>
                </div>
              </div>

              {/* RECORD CREATED */}

              <div className="rounded-xl border border-ink-100 p-4">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-brand-700" />

                  <div>
                    <p className="text-xs text-ink-400">
                      Employee record created
                    </p>

                    <p className="mt-1 text-sm font-medium text-ink-800">
                      {formatDate(
                        selectedEmployee.created_at
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* AUTHORITATIVE RECORD */}

              <div className="rounded-xl bg-brand-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                  Authoritative record
                </p>

                <p className="mt-1 text-sm leading-relaxed text-ink-700">
                  This information is stored in your
                  organization's central employee database
                  and can be updated here instead of
                  maintaining another manual employee
                  record.
                </p>
              </div>

              {/* ACTIONS */}

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setDeletingEmployee(
                      selectedEmployee
                    )
                  }
                  className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openEditForm(selectedEmployee)
                  }
                  className="flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900"
                >
                  <Pencil className="h-4 w-4" />
                  Edit employee
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}

      {deletingEmployee && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" />
            </div>

            <h2 className="mt-4 text-lg font-semibold text-ink-950">
              Delete employee?
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              You are about to permanently delete{" "}
              <span className="font-medium text-ink-800">
                {deletingEmployee.full_name}
              </span>{" "}
              from the employee database.
            </p>

            <p className="mt-2 text-xs text-red-600">
              This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  setDeletingEmployee(null)
                }
                className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                Delete employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK IMPORT MODAL */}

      {showBulkImport && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 p-0 sm:items-center sm:p-6">
          <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-5xl sm:rounded-2xl">
            {/* HEADER */}

            <div className="flex items-start justify-between border-b border-ink-100 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <FileSpreadsheet className="h-5 w-5" />
                  </span>

                  <div>
                    <h2 className="text-lg font-semibold text-ink-950">
                      Bulk Employee Import
                    </h2>

                    <p className="text-xs text-ink-500">
                      Add hundreds or thousands of employee
                      records at once.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeBulkImport}
                disabled={bulkImporting}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-800 disabled:opacity-50"
                aria-label="Close bulk import"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* BODY */}

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {!bulkResult ? (
                <>
                  {/* CSV FORMAT */}

                  <div className="mb-5 rounded-xl bg-canvas p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-ink-800">
                          CSV format
                        </p>

                        <p className="mt-1 text-sm leading-relaxed text-ink-500">
                          Required:
                          <span className="font-medium text-ink-700">
                            {" "}
                            full_name, email
                          </span>
                        </p>

                        <p className="mt-1 text-xs leading-relaxed text-ink-400">
                          Optional: department, title,
                          employee_code, joining_date,
                          employment_status,
                          last_working_date, address
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={downloadTemplate}
                        className="flex shrink-0 items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
                      >
                        <Download className="h-4 w-4" />
                        Download template
                      </button>
                    </div>
                  </div>

                  {/* UPLOAD */}

                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 px-6 py-10 text-center transition hover:border-brand-400 hover:bg-brand-50/30">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <Upload className="h-6 w-6" />
                    </span>

                    <p className="mt-3 text-sm font-medium text-ink-800">
                      {bulkFileName
                        ? bulkFileName
                        : "Choose a CSV file"}
                    </p>

                    <p className="mt-1 text-xs text-ink-400">
                      CSV files only
                    </p>

                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCSVFile}
                      className="hidden"
                    />
                  </label>

                  {/* VALIDATION ERRORS */}

                  {bulkErrors.length > 0 && (
                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-soft p-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-700" />

                        <p className="text-sm font-semibold text-ink-800">
                          {bulkErrors.length} record
                          {bulkErrors.length === 1
                            ? ""
                            : "s"} need attention
                        </p>
                      </div>

                      <div className="mt-3 max-h-40 overflow-y-auto">
                        {bulkErrors.map(
                          (item, index) => (
                            <div
                              key={`${item.row}-${index}`}
                              className="border-t border-amber-200 py-2 first:border-0"
                            >
                              <p className="text-xs font-medium text-ink-700">
                                {item.row
                                  ? `Row ${item.row}`
                                  : "Import error"}

                                {item.employee
                                  ?.email
                                  ? ` — ${item.employee.email}`
                                  : ""}
                              </p>

                              <p className="mt-0.5 text-xs text-ink-500">
                                {item.errors.join(", ")}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* PREVIEW */}

                  {bulkEmployees.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink-800">
                            Import preview
                          </p>

                          <p className="mt-0.5 text-xs text-ink-400">
                            {bulkEmployees.length} valid
                            record
                            {bulkEmployees.length ===
                            1
                              ? ""
                              : "s"} ready to import
                          </p>
                        </div>

                        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                          {bulkEmployees.length} valid
                        </span>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-ink-100">
                        <div className="max-h-72 overflow-auto">
                          <table className="w-full min-w-[1100px] text-left text-sm">
                            <thead className="sticky top-0 border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
                              <tr>
                                <th className="px-4 py-3 font-medium">
                                  Name
                                </th>

                                <th className="px-4 py-3 font-medium">
                                  Email
                                </th>

                                <th className="px-4 py-3 font-medium">
                                  Employee code
                                </th>

                                <th className="px-4 py-3 font-medium">
                                  Department
                                </th>

                                <th className="px-4 py-3 font-medium">
                                  Title
                                </th>

                                <th className="px-4 py-3 font-medium">
                                  Joining date
                                </th>

                                <th className="px-4 py-3 font-medium">
                                  Status
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {bulkEmployees.map(
                                (employee, index) => (
                                  <tr
                                    key={`${employee.email}-${index}`}
                                    className="border-b border-ink-50 last:border-0"
                                  >
                                    <td className="px-4 py-3 font-medium text-ink-800">
                                      {
                                        employee.full_name
                                      }
                                    </td>

                                    <td className="px-4 py-3 text-ink-600">
                                      {employee.email}
                                    </td>

                                    <td className="px-4 py-3 text-ink-600">
                                      {employee.employee_code ||
                                        "—"}
                                    </td>

                                    <td className="px-4 py-3 text-ink-600">
                                      {employee.department ||
                                        "—"}
                                    </td>

                                    <td className="px-4 py-3 text-ink-600">
                                      {employee.title ||
                                        "—"}
                                    </td>

                                    <td className="px-4 py-3 text-ink-600">
                                      {formatDate(
                                        employee.joining_date
                                      )}
                                    </td>

                                    <td className="px-4 py-3">
                                      <span
                                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                                          employee.employment_status
                                        )}`}
                                      >
                                        {
                                          employee.employment_status
                                        }
                                      </span>
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* IMPORT RESULT */

                <div className="py-8 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <CheckCircle2 className="h-7 w-7" />
                  </span>

                  <h3 className="mt-4 text-lg font-semibold text-ink-950">
                    Import completed
                  </h3>

                  <p className="mt-1 text-sm text-ink-500">
                    The valid employee records have been
                    added to your organization.
                  </p>

                  <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3">
                    <div className="rounded-xl border border-ink-100 p-4">
                      <p className="text-xs uppercase tracking-wide text-ink-400">
                        Imported
                      </p>

                      <p className="mt-1 text-2xl font-semibold text-ink-950">
                        {bulkResult.imported || 0}
                      </p>
                    </div>

                    <div className="rounded-xl border border-ink-100 p-4">
                      <p className="text-xs uppercase tracking-wide text-ink-400">
                        Rejected
                      </p>

                      <p className="mt-1 text-2xl font-semibold text-ink-950">
                        {bulkResult.rejected || 0}
                      </p>
                    </div>
                  </div>

                  {bulkResult.rejected > 0 && (
                    <div className="mx-auto mt-5 max-w-md rounded-xl bg-amber-soft p-4 text-left">
                      <p className="text-sm font-medium text-ink-800">
                        Some records were not imported.
                      </p>

                      <p className="mt-1 text-xs leading-relaxed text-ink-500">
                        They may already exist in your
                        employee database or may have
                        failed validation.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* FOOTER */}

            <div className="flex flex-col-reverse gap-2 border-t border-ink-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-400">
                Existing employees with the same email
                will not be duplicated.
              </p>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeBulkImport}
                  disabled={bulkImporting}
                  className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
                >
                  {bulkResult ? "Close" : "Cancel"}
                </button>

                {!bulkResult && (
                  <button
                    type="button"
                    onClick={handleBulkImport}
                    disabled={
                      bulkImporting ||
                      bulkEmployees.length === 0
                    }
                    className="flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkImporting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    Import{" "}
                    {bulkEmployees.length > 0
                      ? `${bulkEmployees.length} employees`
                      : "employees"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}