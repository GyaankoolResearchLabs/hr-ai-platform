import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  Award,
  Plus,
  Search,
  Trash2,
  Archive,
  X,
  RefreshCw,
} from "lucide-react";

import toast from "react-hot-toast";
import api from "../../lib/api";

/* =========================================================
   CATEGORIES
========================================================= */

const categories = [
  {
    value: "all",
    label: "All categories",
  },
  {
    value: "teamwork",
    label: "Teamwork",
  },
  {
    value: "leadership",
    label: "Leadership",
  },
  {
    value: "innovation",
    label: "Innovation",
  },
  {
    value: "customer-focus",
    label: "Customer Focus",
  },
  {
    value: "ownership",
    label: "Ownership",
  },
  {
    value: "performance",
    label: "Performance",
  },
  {
    value: "other",
    label: "Other",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function categoryLabel(category) {
  return (
    categories.find(
      (item) => item.value === category
    )?.label || category
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function RecognitionRewards() {
  const navigate = useNavigate();

  const [recognitions, setRecognitions] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingEmployees, setLoadingEmployees] =
    useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const [showCreate, setShowCreate] =
    useState(false);

  const [form, setForm] = useState({
    employeeId: "",
    category: "teamwork",
    message: "",
    points: 0,
  });

  /* =======================================================
     LOAD RECOGNITIONS
  ======================================================= */

  async function loadRecognitions() {
    try {
      const response = await api.get(
        "/recognition-rewards"
      );

      const data = response?.data;

      setRecognitions(
        Array.isArray(data?.recognitions)
          ? data.recognitions
          : []
      );
    } catch (error) {
      console.error(
        "[RecognitionRewards] Failed to load recognitions:",
        error
      );

      throw error;
    }
  }

  /* =======================================================
     LOAD EMPLOYEES
  ======================================================= */

  async function loadEmployees() {
    try {
      setLoadingEmployees(true);

      console.log(
        "[RecognitionRewards] Loading employees..."
      );

      const response = await api.get(
        "/recognition-rewards/employees"
      );

      const data = response?.data;

      console.log(
        "[RecognitionRewards] Employee API response:",
        data
      );

      const employeeList = Array.isArray(
        data?.employees
      )
        ? data.employees
        : [];

      console.log(
        `[RecognitionRewards] Employees loaded: ${employeeList.length}`
      );

      setEmployees(employeeList);

      setForm((current) => {
        if (
          current.employeeId &&
          !employeeList.some(
            (employee) =>
              employee.id === current.employeeId
          )
        ) {
          return {
            ...current,
            employeeId: "",
          };
        }

        return current;
      });
    } catch (error) {
      console.error(
        "[RecognitionRewards] Employee loading failed:",
        error
      );

      setEmployees([]);

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to load employees."
      );
    } finally {
      setLoadingEmployees(false);
    }
  }

  /* =======================================================
     LOAD PAGE
  ======================================================= */

  async function loadData() {
    try {
      setLoading(true);

      await Promise.all([
        loadRecognitions(),
        loadEmployees(),
      ]);
    } catch (error) {
      console.error(
        "[RecognitionRewards] Load failed:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to load recognition wall."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /* =======================================================
     FILTER RECOGNITIONS
  ======================================================= */

  const filteredRecognitions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return recognitions.filter((item) => {
      const matchesCategory =
        category === "all" ||
        item.category === category;

      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const employeeName =
        item.employee?.full_name || "";

      return (
        employeeName
          .toLowerCase()
          .includes(query) ||
        (item.message || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [
    recognitions,
    search,
    category,
  ]);

  /* =======================================================
     CREATE RECOGNITION
  ======================================================= */

  async function handleCreate(event) {
    event.preventDefault();

    if (!form.employeeId) {
      toast.error("Select an employee.");
      return;
    }

    if (!form.message.trim()) {
      toast.error(
        "Enter a recognition message."
      );
      return;
    }

    try {
      setSaving(true);

      await api.post(
        "/recognition-rewards",
        {
          employeeId: form.employeeId,
          category: form.category,
          message: form.message.trim(),
          points: Number(form.points) || 0,
        }
      );

      toast.success(
        "Recognition created successfully."
      );

      setForm({
        employeeId: "",
        category: "teamwork",
        message: "",
        points: 0,
      });

      setShowCreate(false);

      await loadRecognitions();
    } catch (error) {
      console.error(
        "[RecognitionRewards] Create failed:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to create recognition."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     ARCHIVE
  ======================================================= */

  async function handleArchive(id) {
    try {
      await api.post(
        `/recognition-rewards/${id}/archive`
      );

      toast.success(
        "Recognition archived."
      );

      await loadRecognitions();
    } catch (error) {
      console.error(
        "[RecognitionRewards] Archive failed:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to archive recognition."
      );
    }
  }

  /* =======================================================
     DELETE
  ======================================================= */

  async function handleDelete(id) {
    const confirmed = window.confirm(
      "Delete this recognition permanently?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/recognition-rewards/${id}`
      );

      toast.success(
        "Recognition deleted."
      );

      await loadRecognitions();
    } catch (error) {
      console.error(
        "[RecognitionRewards] Delete failed:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to delete recognition."
      );
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* =================================================
            BACK + HEADER
        ================================================= */}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>
            {/* BACK BUTTON */}

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Award size={22} />
              </div>

              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  Recognition & Rewards
                </h1>

                <p className="text-sm text-slate-500">
                  A visible, shared home for peer recognition
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowCreate(true)
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus size={17} />
            Give Recognition
          </button>
        </div>

        {/* =================================================
            FILTERS
        ================================================= */}

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search recognitions..."
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-teal-500"
              />
            </div>

            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value
                )
              }
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
            >
              {categories.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* =================================================
            WALL
        ================================================= */}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Loading recognition wall...
          </div>
        ) : filteredRecognitions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Award
              size={32}
              className="mx-auto mb-3 text-slate-300"
            />

            <h2 className="text-base font-semibold text-slate-800">
              No recognitions yet
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Be the first to recognize someone on your team.
            </p>

            <button
              type="button"
              onClick={() =>
                setShowCreate(true)
              }
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              <Plus size={16} />
              Give Recognition
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredRecognitions.map(
              (item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-sm font-semibold text-teal-700">
                        {(
                          item.employee
                            ?.full_name || "E"
                        )
                          .split(" ")
                          .map(
                            (name) =>
                              name[0]
                          )
                          .join("")
                          .slice(0, 2)}
                      </div>

                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.employee
                            ?.full_name ||
                            "Employee"}
                        </p>

                        <p className="text-xs text-slate-500">
                          {item.employee
                            ?.title ||
                            item.employee
                              ?.department ||
                            ""}
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                      {categoryLabel(
                        item.category
                      )}
                    </span>
                  </div>

                  <p className="mt-5 text-sm leading-6 text-slate-700">
                    "{item.message}"
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <div>
                      <p className="text-xs text-slate-400">
                        Recognized
                      </p>

                      <p className="text-xs text-slate-500">
                        {formatDate(
                          item.created_at
                        )}
                      </p>
                    </div>

                    <div className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
                      +{item.points || 0} points
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleArchive(
                          item.id
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Archive size={14} />
                      Archive
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(
                          item.id
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* =================================================
            CREATE MODAL
        ================================================= */}

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">

              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Give Recognition
                  </h2>

                  <p className="text-sm text-slate-500">
                    Recognize a colleague for great work.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowCreate(false)
                  }
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X size={19} />
                </button>
              </div>

              <form
                onSubmit={handleCreate}
                className="space-y-5 p-5"
              >

                {/* EMPLOYEE */}

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">
                      Employee
                    </label>

                    <button
                      type="button"
                      onClick={
                        loadEmployees
                      }
                      disabled={
                        loadingEmployees
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 disabled:opacity-50"
                    >
                      <RefreshCw
                        size={13}
                        className={
                          loadingEmployees
                            ? "animate-spin"
                            : ""
                        }
                      />

                      Refresh
                    </button>
                  </div>

                  <select
                    value={form.employeeId}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          employeeId:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={
                      loadingEmployees ||
                      employees.length === 0
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"
                  >
                    <option value="">
                      {loadingEmployees
                        ? "Loading employees..."
                        : employees.length === 0
                        ? "No employees found"
                        : "Select employee"}
                    </option>

                    {employees.map(
                      (employee) => (
                        <option
                          key={employee.id}
                          value={employee.id}
                        >
                          {employee.full_name}
                          {employee.title
                            ? ` — ${employee.title}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>

                  {!loadingEmployees &&
                    employees.length ===
                      0 && (
                      <p className="mt-1.5 text-xs text-red-500">
                        No employees were returned by the recognition employee API.
                      </p>
                    )}
                </div>

                {/* CATEGORY */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Recognition category
                  </label>

                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          category:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {categories
                      .filter(
                        (item) =>
                          item.value !==
                          "all"
                      )
                      .map((item) => (
                        <option
                          key={item.value}
                          value={item.value}
                        >
                          {item.label}
                        </option>
                      ))}
                  </select>
                </div>

                {/* MESSAGE */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Message
                  </label>

                  <textarea
                    value={form.message}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          message:
                            event.target
                              .value,
                        })
                      )
                    }
                    rows={4}
                    placeholder="What did this person do well?"
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                {/* POINTS */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Reward points
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.points}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          points:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </div>

                {/* ACTIONS */}

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={() =>
                      setShowCreate(false)
                    }
                    className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      loadingEmployees ||
                      employees.length === 0
                    }
                    className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : "Give Recognition"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}