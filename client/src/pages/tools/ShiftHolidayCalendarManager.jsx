import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Edit3,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react";

import employeeService from "../../services/employeeService";
import shiftHolidayService from "../../services/shiftHolidayService";

/* =========================================================
   CONSTANTS
========================================================= */

const HOLIDAY_TYPES = [
  "Public Holiday",
  "Regional Holiday",
  "Company Holiday",
];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/* =========================================================
   HELPERS
========================================================= */

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const cleanValue = String(value).slice(0, 5);
  const parts = cleanValue.split(":");

  if (parts.length !== 2) {
    return cleanValue;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return cleanValue;
  }

  const period = hours >= 12 ? "PM" : "AM";

  const displayHours =
    hours % 12 === 0 ? 12 : hours % 12;

  return `${String(displayHours).padStart(
    2,
    "0"
  )}:${String(minutes).padStart(
    2,
    "0"
  )} ${period}`;
}

function getEmployeeName(employee) {
  return (
    employee?.full_name ||
    employee?.name ||
    "Unnamed Employee"
  );
}

function getEmployeeDepartment(employee) {
  return employee?.department || "—";
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    error?.message ||
    "Something went wrong."
  );
}

/* =========================================================
   SMALL FORM COMPONENTS
========================================================= */

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
      </label>

      {children}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        className={`w-full rounded-2xl bg-white shadow-xl ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-ink-950">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function ShiftHolidayCalendarManager() {
  const navigate = useNavigate();

  /* =======================================================
     DATA
  ======================================================= */

  const [locations, setLocations] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);

  /* =======================================================
     UI
  ======================================================= */

  const [activeTab, setActiveTab] = useState(
    "holidays"
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* =======================================================
     MODALS
  ======================================================= */

  const [showLocationModal, setShowLocationModal] =
    useState(false);

  const [showHolidayModal, setShowHolidayModal] =
    useState(false);

  const [showShiftModal, setShowShiftModal] =
    useState(false);

  const [showAssignmentModal, setShowAssignmentModal] =
    useState(false);

  /* =======================================================
     EDIT STATE
  ======================================================= */

  const [editingLocation, setEditingLocation] =
    useState(null);

  const [editingHoliday, setEditingHoliday] =
    useState(null);

  const [editingShift, setEditingShift] =
    useState(null);

  /* =======================================================
     FORMS
  ======================================================= */

  const [locationForm, setLocationForm] = useState({
    name: "",
    country: "India",
  });

  const [holidayForm, setHolidayForm] = useState({
    name: "",
    date: "",
    location_id: "",
    type: "Public Holiday",
    apply_to_all_locations: false,
  });

  const [shiftForm, setShiftForm] = useState({
    name: "",
    start_time: "09:00",
    end_time: "18:00",
    location_id: "",
    working_days: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ],
  });

  const [assignmentForm, setAssignmentForm] =
    useState({
      employee_id: "",
      shift_id: "",
    });

  /* =========================================================
     LOAD DATA
  ========================================================= */

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [
        calendarData,
        employeeData,
      ] = await Promise.all([
        shiftHolidayService.getAll(),
        employeeService.list(),
      ]);

      setLocations(
        Array.isArray(calendarData?.locations)
          ? calendarData.locations
          : []
      );

      setHolidays(
        Array.isArray(calendarData?.holidays)
          ? calendarData.holidays
          : []
      );

      setShifts(
        Array.isArray(calendarData?.shifts)
          ? calendarData.shifts
          : []
      );

      setAssignments(
        Array.isArray(calendarData?.assignments)
          ? calendarData.assignments
          : []
      );

      setEmployees(
        Array.isArray(employeeData)
          ? employeeData
          : []
      );
    } catch (err) {
      console.error(
        "Shift holiday load error:",
        err
      );

      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* =========================================================
     SUCCESS MESSAGE
  ========================================================= */

  function showSuccess(message) {
    setSuccess(message);

    window.setTimeout(() => {
      setSuccess("");
    }, 3500);
  }

  /* =========================================================
     LOCATION HELPERS
  ========================================================= */

  function getLocationName(locationId) {
    const location = locations.find(
      (item) => item.id === locationId
    );

    return location?.name || "Unknown location";
  }

  /* =========================================================
     LOCATION MODAL
  ========================================================= */

  function openCreateLocation() {
    setEditingLocation(null);

    setLocationForm({
      name: "",
      country: "India",
    });

    setShowLocationModal(true);
  }

  function openEditLocation(location) {
    setEditingLocation(location);

    setLocationForm({
      name: location?.name || "",
      country: location?.country || "India",
    });

    setShowLocationModal(true);
  }

  function closeLocationModal() {
    if (saving) {
      return;
    }

    setShowLocationModal(false);
    setEditingLocation(null);
  }

  async function handleSaveLocation(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: locationForm.name.trim(),
        country:
          locationForm.country.trim() || "India",
      };

      if (!payload.name) {
        throw new Error(
          "Location name is required."
        );
      }

      if (editingLocation) {
        await shiftHolidayService.updateLocation(
          editingLocation.id,
          payload
        );

        showSuccess(
          "Location updated successfully."
        );
      } else {
        await shiftHolidayService.createLocation(
          payload
        );

        showSuccess(
          "Location added successfully."
        );
      }

      closeLocationModal();

      await loadData();
    } catch (err) {
      console.error(
        "Save location error:",
        err
      );

      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLocation(location) {
    const confirmed = window.confirm(
      `Delete ${location?.name || "this location"}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await shiftHolidayService.deleteLocation(
        location.id
      );

      showSuccess(
        "Location deleted successfully."
      );

      await loadData();
    } catch (err) {
      console.error(
        "Delete location error:",
        err
      );

      setError(getErrorMessage(err));
    }
  }

  /* =========================================================
     HOLIDAY MODAL
  ========================================================= */

  function openCreateHoliday() {
    if (locations.length === 0) {
      setActiveTab("locations");
      return;
    }

    setEditingHoliday(null);

    setHolidayForm({
      name: "",
      date: "",
      location_id:
        locations[0]?.id || "",
      type: "Public Holiday",
      apply_to_all_locations: false,
    });

    setShowHolidayModal(true);
  }

  function openEditHoliday(holiday) {
    const isAllLocations =
      Boolean(holiday?.isAllLocations);

    setEditingHoliday(holiday);

    setHolidayForm({
      name: holiday?.name || "",
      date:
        holiday?.holiday_date ||
        holiday?.date ||
        "",
      location_id:
        isAllLocations
          ? ""
          : holiday?.location_id || "",
      type:
        holiday?.holiday_type ||
        holiday?.type ||
        "Public Holiday",
      apply_to_all_locations:
        isAllLocations,
    });

    setShowHolidayModal(true);
  }

  function closeHolidayModal() {
    if (saving) {
      return;
    }

    setShowHolidayModal(false);
    setEditingHoliday(null);
  }

  async function handleSaveHoliday(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const holidayName =
        holidayForm.name.trim();

      if (!holidayName) {
        throw new Error(
          "Holiday name is required."
        );
      }

      if (!holidayForm.date) {
        throw new Error(
          "Holiday date is required."
        );
      }

      if (
        !editingHoliday &&
        holidayForm.apply_to_all_locations &&
        locations.length === 0
      ) {
        throw new Error(
          "Create at least one location before applying a holiday to all locations."
        );
      }

      if (
        !editingHoliday &&
        !holidayForm.apply_to_all_locations &&
        !holidayForm.location_id
      ) {
        throw new Error(
          "Location is required."
        );
      }

      const basePayload = {
        name: holidayName,
        date: holidayForm.date,
        type: holidayForm.type,
      };

      /*
       * EDIT:
       * Keep edits location-specific. This prevents an admin from
       * accidentally changing the same holiday across every location.
       */
      if (editingHoliday) {
        /*
         * Organization-wide holiday:
         * update every underlying location record so the grouped
         * row remains consistent in the database.
         */
        if (
          editingHoliday.isAllLocations &&
          Array.isArray(
            editingHoliday.records
          )
        ) {
          await Promise.all(
            editingHoliday.records.map(
              (record) =>
                shiftHolidayService.updateHoliday(
                  record.id,
                  {
                    ...basePayload,
                    location_id:
                      record.location_id ||
                      record
                        ?.organization_locations
                        ?.id,
                  }
                )
            )
          );

          showSuccess(
            "Organization-wide holiday updated successfully."
          );

          closeHolidayModal();
          await loadData();
          return;
        }

        if (!holidayForm.location_id) {
          throw new Error(
            "Location is required."
          );
        }

        await shiftHolidayService.updateHoliday(
          editingHoliday.id,
          {
            ...basePayload,
            location_id:
              holidayForm.location_id,
          }
        );

        showSuccess(
          "Holiday updated successfully."
        );

        closeHolidayModal();
        await loadData();
        return;
      }

      /*
       * CREATE FOR ALL LOCATIONS:
       * The current holiday API stores each holiday against a
       * location_id. Therefore one "All locations" action creates
       * one location-specific holiday record for each organization
       * location.
       *
       * Existing same-name/same-date holidays are skipped so
       * repeated clicks do not create duplicates.
       */
      if (holidayForm.apply_to_all_locations) {
        const existingKeys =
          new Set(
            holidays
              .map((holiday) => {
                const existingDate =
                  holiday?.holiday_date ||
                  holiday?.date ||
                  "";

                const existingLocation =
                  holiday?.location_id ||
                  holiday?.organization_locations?.id ||
                  "";

                const existingName =
                  String(
                    holiday?.name || ""
                  )
                    .trim()
                    .toLowerCase();

                if (
                  !existingDate ||
                  !existingLocation ||
                  !existingName
                ) {
                  return null;
                }

                return `${existingDate}::${existingLocation}::${existingName}`;
              })
              .filter(Boolean)
          );

        const locationsToCreate =
          locations.filter((location) => {
            const key =
              `${holidayForm.date}::${location.id}::${holidayName.toLowerCase()}`;

            return !existingKeys.has(key);
          });

        if (
          locationsToCreate.length === 0
        ) {
          showSuccess(
            `"${holidayName}" already exists for all locations on ${formatDate(
              holidayForm.date
            )}.`
          );

          closeHolidayModal();
          return;
        }

        await Promise.all(
          locationsToCreate.map(
            (location) =>
              shiftHolidayService.createHoliday({
                ...basePayload,
                location_id:
                  location.id,
              })
          )
        );

        const skippedCount =
          locations.length -
          locationsToCreate.length;

        if (skippedCount > 0) {
          showSuccess(
            `"${holidayName}" added to ${locationsToCreate.length} locations. ${skippedCount} existing holiday record${
              skippedCount === 1 ? "" : "s"
            } skipped.`
          );
        } else {
          showSuccess(
            `"${holidayName}" added to all ${locations.length} locations.`
          );
        }
      } else {
        const duplicateExists =
          holidays.some((holiday) => {
            const existingDate =
              holiday?.holiday_date ||
              holiday?.date ||
              "";

            const existingLocation =
              holiday?.location_id ||
              holiday?.organization_locations?.id ||
              "";

            const existingName =
              String(
                holiday?.name || ""
              )
                .trim()
                .toLowerCase();

            return (
              existingDate ===
                holidayForm.date &&
              String(existingLocation) ===
                String(
                  holidayForm.location_id
                ) &&
              existingName ===
                holidayName.toLowerCase()
            );
          });

        if (duplicateExists) {
          throw new Error(
            "A holiday with the same name and date already exists for this location."
          );
        }

        await shiftHolidayService.createHoliday({
          ...basePayload,
          location_id:
            holidayForm.location_id,
        });

        showSuccess(
          "Holiday added successfully."
        );
      }

      closeHolidayModal();

      await loadData();
    } catch (err) {
      console.error(
        "Save holiday error:",
        err
      );

      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteHoliday(holiday) {
    const isAllLocations =
      Boolean(holiday?.isAllLocations);

    const recordCount =
      Array.isArray(holiday?.records)
        ? holiday.records.length
        : 1;

    const confirmed = window.confirm(
      isAllLocations
        ? `Delete "${holiday?.name || "this holiday"}" from all ${recordCount} locations?`
        : `Delete ${holiday?.name || "this holiday"}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      if (
        isAllLocations &&
        Array.isArray(holiday.records)
      ) {
        await Promise.all(
          holiday.records.map(
            (record) =>
              shiftHolidayService.deleteHoliday(
                record.id
              )
          )
        );

        showSuccess(
          `"${holiday.name}" deleted from all locations.`
        );
      } else {
        await shiftHolidayService.deleteHoliday(
          holiday.id
        );

        showSuccess(
          "Holiday deleted successfully."
        );
      }

      await loadData();
    } catch (err) {
      console.error(
        "Delete holiday error:",
        err
      );

      setError(getErrorMessage(err));
    }
  }

  /* =========================================================
     SHIFT MODAL
  ========================================================= */

  function openCreateShift() {
    if (locations.length === 0) {
      setActiveTab("locations");
      return;
    }

    setEditingShift(null);

    setShiftForm({
      name: "",
      start_time: "09:00",
      end_time: "18:00",
      location_id:
        locations[0]?.id || "",
      working_days: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
      ],
    });

    setShowShiftModal(true);
  }

  function openEditShift(shift) {
    setEditingShift(shift);

    setShiftForm({
      name: shift?.name || "",
      start_time: String(
        shift?.start_time || "09:00"
      ).slice(0, 5),
      end_time: String(
        shift?.end_time || "18:00"
      ).slice(0, 5),
      location_id:
        shift?.location_id || "",
      working_days:
        Array.isArray(shift?.working_days)
          ? shift.working_days
          : [],
    });

    setShowShiftModal(true);
  }

  function closeShiftModal() {
    if (saving) {
      return;
    }

    setShowShiftModal(false);
    setEditingShift(null);
  }

  function toggleWorkingDay(day) {
    setShiftForm((current) => {
      const exists =
        current.working_days.includes(day);

      return {
        ...current,
        working_days: exists
          ? current.working_days.filter(
              (item) => item !== day
            )
          : [
              ...current.working_days,
              day,
            ],
      };
    });
  }

  async function handleSaveShift(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      if (!shiftForm.name.trim()) {
        throw new Error(
          "Shift name is required."
        );
      }

      if (!shiftForm.location_id) {
        throw new Error(
          "Location is required."
        );
      }

      if (
        shiftForm.working_days.length === 0
      ) {
        throw new Error(
          "Select at least one working day."
        );
      }

      const payload = {
        name: shiftForm.name.trim(),
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        location_id:
          shiftForm.location_id,
        working_days:
          shiftForm.working_days,
      };

      if (editingShift) {
        await shiftHolidayService.updateShift(
          editingShift.id,
          payload
        );

        showSuccess(
          "Shift updated successfully."
        );
      } else {
        await shiftHolidayService.createShift(
          payload
        );

        showSuccess(
          "Shift created successfully."
        );
      }

      closeShiftModal();

      await loadData();
    } catch (err) {
      console.error(
        "Save shift error:",
        err
      );

      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteShift(shift) {
    const confirmed = window.confirm(
      `Delete ${shift?.name || "this shift"}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await shiftHolidayService.deleteShift(
        shift.id
      );

      showSuccess(
        "Shift deleted successfully."
      );

      await loadData();
    } catch (err) {
      console.error(
        "Delete shift error:",
        err
      );

      setError(getErrorMessage(err));
    }
  }

  /* =========================================================
     ASSIGNMENT MODAL
  ========================================================= */

  function openAssignmentModal() {
    if (
      employees.length === 0 ||
      shifts.length === 0
    ) {
      return;
    }

    setAssignmentForm({
      employee_id: "",
      shift_id:
        shifts[0]?.id || "",
    });

    setShowAssignmentModal(true);
  }

  function closeAssignmentModal() {
    if (saving) {
      return;
    }

    setShowAssignmentModal(false);
  }

  async function handleAssignShift(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      if (!assignmentForm.employee_id) {
        throw new Error(
          "Employee is required."
        );
      }

      if (!assignmentForm.shift_id) {
        throw new Error(
          "Shift is required."
        );
      }

      await shiftHolidayService.assignShift(
        assignmentForm.employee_id,
        assignmentForm.shift_id
      );

      showSuccess(
        "Employee shift assignment saved."
      );

      closeAssignmentModal();

      await loadData();
    } catch (err) {
      console.error(
        "Assign shift error:",
        err
      );

      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveAssignment(
    assignment
  ) {
    const employeeName = getEmployeeName(
      assignment?.employees
    );

    const confirmed = window.confirm(
      `Remove the shift assignment for ${employeeName}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await shiftHolidayService.removeAssignment(
        assignment.id
      );

      showSuccess(
        "Shift assignment removed."
      );

      await loadData();
    } catch (err) {
      console.error(
        "Remove assignment error:",
        err
      );

      setError(getErrorMessage(err));
    }
  }

  /* =========================================================
     SORTED DATA
  ========================================================= */

  /*
   * Display holidays intelligently:
   *
   * If the same holiday name + date + type exists for every
   * organization location, show ONE row and label it
   * "All locations" instead of showing one row per location.
   *
   * Location-specific holidays remain individual rows.
   *
   * The database still keeps one record per location, so the
   * existing attendance/leave logic does not need to change.
   */
  const groupedHolidays = useMemo(() => {
    const groups = new Map();

    holidays.forEach((holiday) => {
      const date =
        holiday?.holiday_date ||
        holiday?.date ||
        "";

      const name = String(
        holiday?.name || ""
      )
        .trim()
        .toLowerCase();

      const type = String(
        holiday?.holiday_type ||
          holiday?.type ||
          ""
      )
        .trim()
        .toLowerCase();

      const locationId =
        holiday?.location_id ||
        holiday?.organization_locations?.id ||
        "";

      /*
       * If a record does not have a location, leave it as an
       * individual record instead of trying to group it.
       */
      if (!date || !name || !locationId) {
        groups.set(
          `single:${holiday?.id}`,
          {
            ...holiday,
            isAllLocations: false,
            records: [holiday],
          }
        );

        return;
      }

      const key =
        `${date}::${name}::${type}`;

      if (!groups.has(key)) {
        groups.set(key, {
          ...holiday,
          isAllLocations: false,
          records: [],
        });
      }

      groups.get(key).records.push(holiday);
    });

    const displayRows = [];

    Array.from(groups.values()).forEach(
      (group) => {
        const records =
          Array.isArray(group.records)
            ? group.records
            : [];

        const uniqueLocationIds =
          new Set(
            records
              .map(
                (record) =>
                  record?.location_id ||
                  record?.organization_locations
                    ?.id
              )
              .filter(Boolean)
          );

        const isAllLocations =
          locations.length > 0 &&
          uniqueLocationIds.size ===
            locations.length &&
          records.length >=
            locations.length;

        if (isAllLocations) {
          /*
           * One logical row for an organization-wide holiday.
           * Keep all underlying records for edit/delete actions.
           */
          displayRows.push({
            ...group,
            isAllLocations: true,
            records,
          });

          return;
        }

        /*
         * Important:
         * If a holiday exists in only some locations, do NOT
         * collapse those records into one row. They are still
         * location-specific holidays.
         */
        records.forEach((record) => {
          displayRows.push({
            ...record,
            isAllLocations: false,
            records: [record],
          });
        });
      }
    );

    return displayRows.sort((a, b) =>
      String(
        a?.holiday_date ||
          a?.date ||
          ""
      ).localeCompare(
        String(
          b?.holiday_date ||
            b?.date ||
            ""
        )
      )
    );
  }, [holidays, locations]);

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-h-full">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-6">
        <button
          type="button"
          onClick={() =>
            navigate(
              "/app/categories/attendance-leave"
            )
          }
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Attendance & Leave
        </button>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-brand-700">
              <CalendarDays className="h-4 w-4" />
              Attendance & Leave
            </div>

            <h1 className="font-display text-2xl font-semibold text-ink-950 sm:text-3xl">
              Shift & Holiday Calendar Manager
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-ink-500 sm:text-base">
              Manage organization locations,
              holiday calendars, work shifts,
              and employee shift assignments
              from one centralized workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading
                  ? "animate-spin"
                  : ""
              }`}
            />

            Refresh
          </button>
        </div>
      </div>

      {/* =====================================================
          ALERTS
      ===================================================== */}

      {error && (
        <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Check className="h-4 w-4" />

          {success}
        </div>
      )}

      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() =>
            setActiveTab("locations")
          }
          className="card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <MapPin className="h-5 w-5" />
            </span>

            <span className="text-2xl font-semibold text-ink-950">
              {locations.length}
            </span>
          </div>

          <p className="text-sm font-medium text-ink-600">
            Locations
          </p>

          <p className="mt-1 text-xs text-ink-400">
            Organization work locations
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab("holidays")
          }
          className="card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <CalendarDays className="h-5 w-5" />
            </span>

            <span className="text-2xl font-semibold text-ink-950">
              {groupedHolidays.length}
            </span>
          </div>

          <p className="text-sm font-medium text-ink-600">
            Holidays
          </p>

          <p className="mt-1 text-xs text-ink-400">
            Location-specific and organization-wide holidays
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab("shifts")
          }
          className="card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Clock3 className="h-5 w-5" />
            </span>

            <span className="text-2xl font-semibold text-ink-950">
              {shifts.length}
            </span>
          </div>

          <p className="text-sm font-medium text-ink-600">
            Shifts
          </p>

          <p className="mt-1 text-xs text-ink-400">
            Configured work schedules
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab("assignments")
          }
          className="card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <Users className="h-5 w-5" />
            </span>

            <span className="text-2xl font-semibold text-ink-950">
              {assignments.length}
            </span>
          </div>

          <p className="text-sm font-medium text-ink-600">
            Assigned Employees
          </p>

          <p className="mt-1 text-xs text-ink-400">
            Employees with a shift
          </p>
        </button>
      </div>

      {/* =====================================================
          TABS
      ===================================================== */}

      <div className="mb-5 overflow-x-auto rounded-xl border border-ink-100 bg-white">
        <div className="flex min-w-max">
          <button
            type="button"
            onClick={() =>
              setActiveTab("holidays")
            }
            className={`inline-flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-medium transition ${
              activeTab === "holidays"
                ? "border-brand-700 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            Holiday Calendar
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab("locations")
            }
            className={`inline-flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-medium transition ${
              activeTab === "locations"
                ? "border-brand-700 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            <MapPin className="h-4 w-4" />
            Locations
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab("shifts")
            }
            className={`inline-flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-medium transition ${
              activeTab === "shifts"
                ? "border-brand-700 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            <Clock3 className="h-4 w-4" />
            Shifts
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab("assignments")
            }
            className={`inline-flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-medium transition ${
              activeTab === "assignments"
                ? "border-brand-700 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            <Users className="h-4 w-4" />
            Employee Assignments
          </button>
        </div>
      </div>

      {/* =====================================================
          LOADING
      ===================================================== */}

      {loading ? (
        <div className="card flex min-h-[300px] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-ink-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading calendar data...
          </div>
        </div>
      ) : (
        <>
          {/* =================================================
              HOLIDAYS
          ================================================= */}

          {activeTab === "holidays" && (
            <section className="card overflow-hidden">
              <div className="flex flex-col justify-between gap-4 border-b border-ink-100 px-5 py-5 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-semibold text-ink-950">
                    Holiday Calendar
                  </h2>

                  <p className="mt-1 text-sm text-ink-500">
                    Create location-specific holidays
                    or apply the same holiday across
                    all organization locations.
                    Organization-wide holidays are shown as one row.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openCreateHoliday}
                  disabled={
                    locations.length === 0
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Add Holiday
                </button>
              </div>

              {locations.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <MapPin className="mx-auto mb-3 h-8 w-8 text-ink-300" />

                  <h3 className="text-sm font-semibold text-ink-800">
                    Add a location first
                  </h3>

                  <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
                    Holidays must be
                    associated with an
                    organization location.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        "locations"
                      )
                    }
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
                  >
                    <MapPin className="h-4 w-4" />
                    Add Location
                  </button>
                </div>
              ) : groupedHolidays.length ===
                0 ? (
                <div className="px-5 py-16 text-center">
                  <CalendarDays className="mx-auto mb-3 h-8 w-8 text-ink-300" />

                  <h3 className="text-sm font-semibold text-ink-800">
                    No holidays yet
                  </h3>

                  <p className="mt-1 text-sm text-ink-500">
                    Add your organization's
                    first holiday.
                  </p>

                  <button
                    type="button"
                    onClick={
                      openCreateHoliday
                    }
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add Holiday
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full">
                    <thead>
                      <tr className="border-b border-ink-100 bg-ink-50/60 text-left">
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                          Holiday
                        </th>

                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                          Date
                        </th>

                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                          Location
                        </th>

                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                          Type
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {groupedHolidays.map(
                        (holiday) => (
                          <tr
                            key={
                              holiday.isAllLocations
                                ? `all-${holiday.name}-${holiday.holiday_date || holiday.date}-${holiday.holiday_type || holiday.type}`
                                : holiday.id
                            }
                            className="border-b border-ink-100 last:border-b-0"
                          >
                            <td className="px-5 py-4">
                              <div>
                                <p className="text-sm font-semibold text-ink-900">
                                  {holiday.name}
                                </p>

                                {holiday.isAllLocations && (
                                  <p className="mt-1 text-xs text-brand-700">
                                    Organization-wide holiday
                                  </p>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-sm text-ink-600">
                              {formatDate(
                                holiday.holiday_date ||
                                  holiday.date
                              )}
                            </td>

                            <td className="px-5 py-4 text-sm text-ink-600">
                              {holiday.isAllLocations ? (
                                <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                                  All locations
                                </span>
                              ) : (
                                holiday
                                  ?.organization_locations
                                  ?.name ||
                                getLocationName(
                                  holiday.location_id
                                )
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <span className="inline-flex rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-xs font-medium text-ink-600">
                                {holiday.holiday_type ||
                                  holiday.type}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditHoliday(
                                      holiday.isAllLocations
                                        ? {
                                            ...holiday,
                                            isAllLocations: true,
                                            records:
                                              holiday.records,
                                          }
                                        : holiday
                                    )
                                  }
                                  className="rounded-lg border border-ink-200 p-2 text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
                                  title={
                                    holiday.isAllLocations
                                      ? "Edit organization-wide holiday"
                                      : "Edit holiday"
                                  }
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteHoliday(
                                      holiday
                                    )
                                  }
                                  className="rounded-lg border border-red-200 p-2 text-red-500 transition hover:bg-red-50 hover:text-red-700"
                                  title={
                                    holiday.isAllLocations
                                      ? "Delete holiday from all locations"
                                      : "Delete holiday"
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* =================================================
              LOCATIONS
          ================================================= */}

          {activeTab === "locations" && (
            <section className="card overflow-hidden">
              <div className="flex flex-col justify-between gap-4 border-b border-ink-100 px-5 py-5 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-semibold text-ink-950">
                    Organization Locations
                  </h2>

                  <p className="mt-1 text-sm text-ink-500">
                    Locations can have their
                    own holiday calendars and
                    shifts.
                  </p>
                </div>

                {/* ONLY ONE ADD LOCATION BUTTON */}
                <button
                  type="button"
                  onClick={
                    openCreateLocation
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800"
                >
                  <Plus className="h-4 w-4" />
                  Add Location
                </button>
              </div>

              {locations.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <MapPin className="mx-auto mb-3 h-8 w-8 text-ink-300" />

                  <h3 className="text-sm font-semibold text-ink-800">
                    No locations yet
                  </h3>

                  <p className="mt-1 text-sm text-ink-500">
                    Add your first
                    organization location.
                  </p>

                  {/* EMPTY STATE BUTTON */}
                  <button
                    type="button"
                    onClick={
                      openCreateLocation
                    }
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add Location
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                  {locations.map(
                    (location) => (
                      <div
                        key={location.id}
                        className="rounded-xl border border-ink-100 bg-white p-5"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                            <MapPin className="h-5 w-5" />
                          </span>

                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                openEditLocation(
                                  location
                                )
                              }
                              className="rounded-lg p-2 text-ink-500 hover:bg-ink-50 hover:text-ink-900"
                              title="Edit location"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteLocation(
                                  location
                                )
                              }
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                              title="Delete location"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <h3 className="font-semibold text-ink-900">
                          {location.name}
                        </h3>

                        <p className="mt-1 text-sm text-ink-500">
                          {location.country ||
                            "India"}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          )}

          {/* =================================================
              SHIFTS
          ================================================= */}

          {activeTab === "shifts" && (
            <section className="card overflow-hidden">
              <div className="flex flex-col justify-between gap-4 border-b border-ink-100 px-5 py-5 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-semibold text-ink-950">
                    Shift Schedules
                  </h2>

                  <p className="mt-1 text-sm text-ink-500">
                    Define working hours and
                    working days for each
                    location.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openCreateShift}
                  disabled={
                    locations.length === 0
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Add Shift
                </button>
              </div>

              {locations.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <MapPin className="mx-auto mb-3 h-8 w-8 text-ink-300" />

                  <h3 className="text-sm font-semibold text-ink-800">
                    Add a location first
                  </h3>

                  <p className="mt-1 text-sm text-ink-500">
                    Shifts must belong to an
                    organization location.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        "locations"
                      )
                    }
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add Location
                  </button>
                </div>
              ) : shifts.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <Clock3 className="mx-auto mb-3 h-8 w-8 text-ink-300" />

                  <h3 className="text-sm font-semibold text-ink-800">
                    No shifts configured
                  </h3>

                  <p className="mt-1 text-sm text-ink-500">
                    Create a shift schedule
                    for your organization.
                  </p>

                  {/* EMPTY STATE BUTTON */}
                  <button
                    type="button"
                    onClick={openCreateShift}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add Shift
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
                  {shifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="rounded-xl border border-ink-100 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-ink-900">
                            {shift.name}
                          </h3>

                          <p className="mt-1 text-sm text-ink-500">
                            {shift
                              ?.organization_locations
                              ?.name ||
                              getLocationName(
                                shift.location_id
                              )}
                          </p>
                        </div>

                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              openEditShift(
                                shift
                              )
                            }
                            className="rounded-lg p-2 text-ink-500 hover:bg-ink-50 hover:text-ink-900"
                            title="Edit shift"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteShift(
                                shift
                              )
                            }
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                            title="Delete shift"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-ink-50 p-3">
                          <p className="text-xs font-medium text-ink-400">
                            Start
                          </p>

                          <p className="mt-1 text-sm font-semibold text-ink-800">
                            {formatTime(
                              shift.start_time
                            )}
                          </p>
                        </div>

                        <div className="rounded-lg bg-ink-50 p-3">
                          <p className="text-xs font-medium text-ink-400">
                            End
                          </p>

                          <p className="mt-1 text-sm font-semibold text-ink-800">
                            {formatTime(
                              shift.end_time
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-ink-400">
                          Working days
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          {(
                            shift.working_days ||
                            []
                          ).map((day) => (
                            <span
                              key={day}
                              className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
                            >
                              {day.slice(
                                0,
                                3
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* =================================================
              EMPLOYEE ASSIGNMENTS
          ================================================= */}

          {activeTab === "assignments" && (
            <section className="card overflow-hidden">
              <div className="flex flex-col justify-between gap-4 border-b border-ink-100 px-5 py-5 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-semibold text-ink-950">
                    Employee Shift Assignments
                  </h2>

                  <p className="mt-1 text-sm text-ink-500">
                    Assign each employee to
                    their applicable work
                    schedule.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    openAssignmentModal
                  }
                  disabled={
                    employees.length === 0 ||
                    shifts.length === 0
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Assign Employee
                </button>
              </div>

              {employees.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <Users className="mx-auto mb-3 h-8 w-8 text-ink-300" />

                  <h3 className="text-sm font-semibold text-ink-800">
                    No employees available
                  </h3>

                  <p className="mt-1 text-sm text-ink-500">
                    Add employees before
                    assigning shifts.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        "/app/employees"
                      )
                    }
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
                  >
                    <Users className="h-4 w-4" />
                    Manage Employees
                  </button>
                </div>
              ) : shifts.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <Clock3 className="mx-auto mb-3 h-8 w-8 text-ink-300" />

                  <h3 className="text-sm font-semibold text-ink-800">
                    Create a shift first
                  </h3>

                  <p className="mt-1 text-sm text-ink-500">
                    Employees can only be
                    assigned after a shift has
                    been configured.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        "shifts"
                      )
                    }
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add Shift
                  </button>
                </div>
              ) : assignments.length ===
                0 ? (
                <div className="px-5 py-16 text-center">
                  <Users className="mx-auto mb-3 h-8 w-8 text-ink-300" />

                  <h3 className="text-sm font-semibold text-ink-800">
                    No employee assignments
                  </h3>

                  <p className="mt-1 text-sm text-ink-500">
                    Assign employees to
                    configured shifts.
                  </p>

                  {/* EMPTY STATE BUTTON */}
                  <button
                    type="button"
                    onClick={
                      openAssignmentModal
                    }
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800"
                  >
                    <Plus className="h-4 w-4" />
                    Assign Employee
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[850px] w-full">
                    <thead>
                      <tr className="border-b border-ink-100 bg-ink-50/60 text-left">
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                          Employee
                        </th>

                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                          Department
                        </th>

                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                          Shift
                        </th>

                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                          Working Hours
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {assignments.map(
                        (assignment) => {
                          const employee =
                            assignment?.employees;

                          const shift =
                            assignment?.organization_shifts;

                          return (
                            <tr
                              key={
                                assignment.id
                              }
                              className="border-b border-ink-100 last:border-b-0"
                            >
                              <td className="px-5 py-4">
                                <p className="text-sm font-semibold text-ink-900">
                                  {getEmployeeName(
                                    employee
                                  )}
                                </p>

                                <p className="mt-0.5 text-xs text-ink-400">
                                  {
                                    employee?.email
                                  }
                                </p>
                              </td>

                              <td className="px-5 py-4 text-sm text-ink-600">
                                {getEmployeeDepartment(
                                  employee
                                )}
                              </td>

                              <td className="px-5 py-4">
                                <p className="text-sm font-medium text-ink-800">
                                  {shift?.name ||
                                    "—"}
                                </p>
                              </td>

                              <td className="px-5 py-4 text-sm text-ink-600">
                                {formatTime(
                                  shift?.start_time
                                )}
                                {" — "}
                                {formatTime(
                                  shift?.end_time
                                )}
                              </td>

                              <td className="px-5 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveAssignment(
                                      assignment
                                    )
                                  }
                                  className="rounded-lg border border-red-200 p-2 text-red-500 transition hover:bg-red-50 hover:text-red-700"
                                  title="Remove assignment"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* =====================================================
          LOCATION MODAL
      ===================================================== */}

      {showLocationModal && (
        <Modal
          title={
            editingLocation
              ? "Edit Location"
              : "Add Location"
          }
          onClose={closeLocationModal}
        >
          <form
            onSubmit={handleSaveLocation}
            className="space-y-5"
          >
            <Field label="Location name">
              <input
                type="text"
                value={locationForm.name}
                onChange={(event) =>
                  setLocationForm(
                    (current) => ({
                      ...current,
                      name: event.target.value,
                    })
                  )
                }
                placeholder="e.g. Bengaluru"
                className="form-input w-full"
                required
              />
            </Field>

            <Field label="Country">
              <input
                type="text"
                value={
                  locationForm.country
                }
                onChange={(event) =>
                  setLocationForm(
                    (current) => ({
                      ...current,
                      country:
                        event.target.value,
                    })
                  )
                }
                placeholder="India"
                className="form-input w-full"
              />
            </Field>

            <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
              <button
                type="button"
                onClick={
                  closeLocationModal
                }
                disabled={saving}
                className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {saving && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {editingLocation
                  ? "Save Changes"
                  : "Add Location"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =====================================================
          HOLIDAY MODAL
      ===================================================== */}

      {showHolidayModal && (
        <Modal
          title={
            editingHoliday
              ? "Edit Holiday"
              : "Add Holiday"
          }
          onClose={closeHolidayModal}
        >
          <form
            onSubmit={handleSaveHoliday}
            className="space-y-5"
          >
            <Field label="Holiday name">
              <input
                type="text"
                value={holidayForm.name}
                onChange={(event) =>
                  setHolidayForm(
                    (current) => ({
                      ...current,
                      name: event.target.value,
                    })
                  )
                }
                placeholder="e.g. Independence Day"
                className="form-input w-full"
                required
              />
            </Field>

            <Field label="Date">
              <input
                type="date"
                value={holidayForm.date}
                onChange={(event) =>
                  setHolidayForm(
                    (current) => ({
                      ...current,
                      date: event.target.value,
                    })
                  )
                }
                className="form-input w-full"
                required
              />
            </Field>

            <Field label="Holiday scope">
              <select
                value={
                  holidayForm.apply_to_all_locations
                    ? "all"
                    : "location"
                }
                onChange={(event) => {
                  const value =
                    event.target.value;

                  setHolidayForm(
                    (current) => ({
                      ...current,
                      apply_to_all_locations:
                        value === "all",
                      location_id:
                        value === "all"
                          ? ""
                          : current.location_id ||
                            locations[0]?.id ||
                            "",
                    })
                  );
                }}
                className="form-input w-full"
                disabled={
                  Boolean(
                    editingHoliday &&
                    !editingHoliday.isAllLocations
                  )
                }
              >
                <option value="location">
                  One location
                </option>
                <option value="all">
                  All locations
                </option>
              </select>

              {editingHoliday && (
                <p className="mt-1.5 text-xs text-ink-400">
                  Editing a holiday affects only its existing location.
                </p>
              )}
            </Field>

            {holidayForm.apply_to_all_locations ? (
              <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                <p className="text-sm font-semibold text-brand-800">
                  Applies to all locations
                </p>

                <p className="mt-1 text-xs leading-5 text-brand-700">
                  {editingHoliday?.isAllLocations
                    ? "This organization-wide holiday applies to all current organization locations."
                    : (
                        <>
                          This holiday will be added to all{" "}
                          <span className="font-semibold">
                            {locations.length}
                          </span>{" "}
                          organization location
                          {locations.length === 1
                            ? ""
                            : "s"}.
                        </>
                      )}
                </p>

                {locations.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {locations.map(
                      (location) => (
                        <span
                          key={location.id}
                          className="rounded-full border border-brand-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-700"
                        >
                          {location.name}
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Field label="Location">
                <select
                  value={
                    holidayForm.location_id
                  }
                  onChange={(event) =>
                    setHolidayForm(
                      (current) => ({
                        ...current,
                        location_id:
                          event.target.value,
                      })
                    )
                  }
                  className="form-input w-full"
                  required
                >
                  <option value="">
                    Select location
                  </option>

                  {locations.map(
                    (location) => (
                      <option
                        key={location.id}
                        value={location.id}
                      >
                        {location.name}
                      </option>
                    )
                  )}
                </select>
              </Field>
            )}

            <Field label="Holiday type">
              <select
                value={holidayForm.type}
                onChange={(event) =>
                  setHolidayForm(
                    (current) => ({
                      ...current,
                      type: event.target.value,
                    })
                  )
                }
                className="form-input w-full"
              >
                {HOLIDAY_TYPES.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  )
                )}
              </select>
            </Field>

            <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
              <button
                type="button"
                onClick={
                  closeHolidayModal
                }
                disabled={saving}
                className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {saving && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {editingHoliday
                  ? "Save Changes"
                  : "Add Holiday"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =====================================================
          SHIFT MODAL
      ===================================================== */}

      {showShiftModal && (
        <Modal
          title={
            editingShift
              ? "Edit Shift"
              : "Add Shift"
          }
          onClose={closeShiftModal}
          wide
        >
          <form
            onSubmit={handleSaveShift}
            className="space-y-5"
          >
            <Field label="Shift name">
              <input
                type="text"
                value={shiftForm.name}
                onChange={(event) =>
                  setShiftForm(
                    (current) => ({
                      ...current,
                      name: event.target.value,
                    })
                  )
                }
                placeholder="e.g. General Shift"
                className="form-input w-full"
                required
              />
            </Field>

            <Field label="Location">
              <select
                value={
                  shiftForm.location_id
                }
                onChange={(event) =>
                  setShiftForm(
                    (current) => ({
                      ...current,
                      location_id:
                        event.target.value,
                    })
                  )
                }
                className="form-input w-full"
                required
              >
                <option value="">
                  Select location
                </option>

                {locations.map(
                  (location) => (
                    <option
                      key={location.id}
                      value={location.id}
                    >
                      {location.name}
                    </option>
                  )
                )}
              </select>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Start time">
                <input
                  type="time"
                  value={
                    shiftForm.start_time
                  }
                  onChange={(event) =>
                    setShiftForm(
                      (current) => ({
                        ...current,
                        start_time:
                          event.target.value,
                      })
                    )
                  }
                  className="form-input w-full"
                  required
                />
              </Field>

              <Field label="End time">
                <input
                  type="time"
                  value={
                    shiftForm.end_time
                  }
                  onChange={(event) =>
                    setShiftForm(
                      (current) => ({
                        ...current,
                        end_time:
                          event.target.value,
                      })
                    )
                  }
                  className="form-input w-full"
                  required
                />
              </Field>
            </div>

            <Field label="Working days">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DAYS.map((day) => {
                  const selected =
                    shiftForm.working_days.includes(
                      day
                    );

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        toggleWorkingDay(
                          day
                        )
                      }
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        selected
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-ink-200 bg-white text-ink-500 hover:bg-ink-50"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
              <button
                type="button"
                onClick={closeShiftModal}
                disabled={saving}
                className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  saving ||
                  shiftForm.working_days
                    .length === 0
                }
                className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {saving && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {editingShift
                  ? "Save Changes"
                  : "Add Shift"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =====================================================
          ASSIGNMENT MODAL
      ===================================================== */}

      {showAssignmentModal && (
        <Modal
          title="Assign Employee to Shift"
          onClose={
            closeAssignmentModal
          }
        >
          <form
            onSubmit={
              handleAssignShift
            }
            className="space-y-5"
          >
            <Field label="Employee">
              <select
                value={
                  assignmentForm.employee_id
                }
                onChange={(event) =>
                  setAssignmentForm(
                    (current) => ({
                      ...current,
                      employee_id:
                        event.target.value,
                    })
                  )
                }
                className="form-input w-full"
                required
              >
                <option value="">
                  Select employee
                </option>

                {employees.map(
                  (employee) => (
                    <option
                      key={employee.id}
                      value={employee.id}
                    >
                      {getEmployeeName(
                        employee
                      )}
                      {employee.department
                        ? ` — ${employee.department}`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Shift">
              <select
                value={
                  assignmentForm.shift_id
                }
                onChange={(event) =>
                  setAssignmentForm(
                    (current) => ({
                      ...current,
                      shift_id:
                        event.target.value,
                    })
                  )
                }
                className="form-input w-full"
                required
              >
                <option value="">
                  Select shift
                </option>

                {shifts.map((shift) => (
                  <option
                    key={shift.id}
                    value={shift.id}
                  >
                    {shift.name}
                    {" — "}
                    {formatTime(
                      shift.start_time
                    )}
                    {" - "}
                    {formatTime(
                      shift.end_time
                    )}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
              <button
                type="button"
                onClick={
                  closeAssignmentModal
                }
                disabled={saving}
                className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {saving && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                Assign Employee
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}