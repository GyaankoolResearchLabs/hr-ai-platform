import api from "./api";

/*
|--------------------------------------------------------------------------
| Shift & Holiday Calendar Service
|--------------------------------------------------------------------------
| Centralized API calls for:
|
| - Locations
| - Holidays
| - Shifts
| - Employee shift assignments
|
| All organization isolation is handled by the backend.
|--------------------------------------------------------------------------
*/

const shiftHolidayService = {
  /* =========================================================
     GET ALL CALENDAR DATA
  ========================================================= */

  async getAll() {
    const { data } = await api.get(
      "/shift-holiday"
    );

    return {
      locations:
        Array.isArray(data?.locations)
          ? data.locations
          : [],

      holidays:
        Array.isArray(data?.holidays)
          ? data.holidays
          : [],

      shifts:
        Array.isArray(data?.shifts)
          ? data.shifts
          : [],

      assignments:
        Array.isArray(data?.assignments)
          ? data.assignments
          : [],
    };
  },

  /* =========================================================
     LOCATIONS
  ========================================================= */

  async getLocations() {
    const { data } = await api.get(
      "/shift-holiday/locations"
    );

    return Array.isArray(data)
      ? data
      : [];
  },

  async createLocation(location) {
    if (!location) {
      throw new Error(
        "Location data is required."
      );
    }

    const { data } = await api.post(
      "/shift-holiday/locations",
      location
    );

    return data;
  },

  async updateLocation(id, location) {
    if (!id) {
      throw new Error(
        "Location ID is required."
      );
    }

    if (!location) {
      throw new Error(
        "Location data is required."
      );
    }

    const { data } = await api.put(
      `/shift-holiday/locations/${id}`,
      location
    );

    return data;
  },

  async deleteLocation(id) {
    if (!id) {
      throw new Error(
        "Location ID is required."
      );
    }

    const { data } = await api.delete(
      `/shift-holiday/locations/${id}`
    );

    return data;
  },

  /* =========================================================
     HOLIDAYS
  ========================================================= */

  async getHolidays(
    locationId = null,
    year = null
  ) {
    const params = {};

    if (locationId) {
      params.location_id =
        locationId;
    }

    if (year) {
      params.year = year;
    }

    const { data } = await api.get(
      "/shift-holiday/holidays",
      {
        params,
      }
    );

    return Array.isArray(data)
      ? data
      : [];
  },

  async createHoliday(holiday) {
    if (!holiday) {
      throw new Error(
        "Holiday data is required."
      );
    }

    const { data } = await api.post(
      "/shift-holiday/holidays",
      holiday
    );

    return data;
  },

  async updateHoliday(
    id,
    holiday
  ) {
    if (!id) {
      throw new Error(
        "Holiday ID is required."
      );
    }

    if (!holiday) {
      throw new Error(
        "Holiday data is required."
      );
    }

    const { data } = await api.put(
      `/shift-holiday/holidays/${id}`,
      holiday
    );

    return data;
  },

  async deleteHoliday(id) {
    if (!id) {
      throw new Error(
        "Holiday ID is required."
      );
    }

    const { data } = await api.delete(
      `/shift-holiday/holidays/${id}`
    );

    return data;
  },

  /* =========================================================
     SHIFTS
  ========================================================= */

  async getShifts(
    locationId = null
  ) {
    const params = {};

    if (locationId) {
      params.location_id =
        locationId;
    }

    const { data } = await api.get(
      "/shift-holiday/shifts",
      {
        params,
      }
    );

    return Array.isArray(data)
      ? data
      : [];
  },

  async createShift(shift) {
    if (!shift) {
      throw new Error(
        "Shift data is required."
      );
    }

    const { data } = await api.post(
      "/shift-holiday/shifts",
      shift
    );

    return data;
  },

  async updateShift(
    id,
    shift
  ) {
    if (!id) {
      throw new Error(
        "Shift ID is required."
      );
    }

    if (!shift) {
      throw new Error(
        "Shift data is required."
      );
    }

    const { data } = await api.put(
      `/shift-holiday/shifts/${id}`,
      shift
    );

    return data;
  },

  async deleteShift(id) {
    if (!id) {
      throw new Error(
        "Shift ID is required."
      );
    }

    const { data } = await api.delete(
      `/shift-holiday/shifts/${id}`
    );

    return data;
  },

  /* =========================================================
     EMPLOYEE SHIFT ASSIGNMENTS
  ========================================================= */

  async getAssignments(
    employeeId = null
  ) {
    const params = {};

    if (employeeId) {
      params.employee_id =
        employeeId;
    }

    const { data } = await api.get(
      "/shift-holiday/assignments",
      {
        params,
      }
    );

    return Array.isArray(data)
      ? data
      : [];
  },

  async assignShift(
    employeeId,
    shiftId
  ) {
    if (!employeeId) {
      throw new Error(
        "Employee ID is required."
      );
    }

    if (!shiftId) {
      throw new Error(
        "Shift ID is required."
      );
    }

    const { data } = await api.post(
      "/shift-holiday/assignments",
      {
        employee_id:
          employeeId,

        shift_id:
          shiftId,
      }
    );

    return data;
  },

  async removeAssignment(id) {
    if (!id) {
      throw new Error(
        "Assignment ID is required."
      );
    }

    const { data } = await api.delete(
      `/shift-holiday/assignments/${id}`
    );

    return data;
  },
};

export { shiftHolidayService };

export default shiftHolidayService;