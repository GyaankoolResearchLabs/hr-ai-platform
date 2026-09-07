import api from "./api";

export const employeeAttendanceLeaveService = {
  /* =========================================================
     ATTENDANCE
  ========================================================= */

  async getAttendance() {
    const { data } = await api.get("/employee/attendance");

    return {
      attendance: Array.isArray(data?.attendance)
        ? data.attendance
        : [],
      today: data?.today || null,
    };
  },

  /* =========================================================
     LEAVE BALANCE
  ========================================================= */

  async getLeaveBalance() {
    const { data } = await api.get("/employee/leave-balance");

    return Array.isArray(data?.balances) ? data.balances : [];
  },

  /* =========================================================
     LEAVE REQUESTS
  ========================================================= */

  async getLeaveRequests() {
    const { data } = await api.get("/employee/leave-requests");

    return Array.isArray(data?.requests) ? data.requests : [];
  },

  /* =========================================================
     SUBMIT LEAVE REQUEST
  ========================================================= */

  async submitLeaveRequest({
    leaveType,
    startDate,
    endDate,
    reason = null,
  }) {
    if (!leaveType) {
      throw new Error("Leave type is required.");
    }

    if (!startDate) {
      throw new Error("Start date is required.");
    }

    if (!endDate) {
      throw new Error("End date is required.");
    }

    const { data } = await api.post("/employee/leave-requests", {
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason: reason || null,
    });

    return data;
  },
};

export default employeeAttendanceLeaveService;
