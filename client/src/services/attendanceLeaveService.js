import api from "./api";

/*
|--------------------------------------------------------------------------
| Attendance & Leave Service
|--------------------------------------------------------------------------
| Centralized API calls for:
|
| - Attendance records
| - Attendance history
| - Attendance summaries
| - Leave balances
| - Leave requests
| - Leave request approval/rejection/cancellation
|--------------------------------------------------------------------------
*/

const attendanceLeaveService = {
  /* =========================================================
     ATTENDANCE
  ========================================================= */

  async getAttendance({
    date = null,
    employeeId = null,
    status = null,
  } = {}) {
    const params = {};

    if (date) {
      params.date = date;
    }

    if (employeeId) {
      params.employee_id = employeeId;
    }

    if (status) {
      params.status = status;
    }

    const { data } = await api.get(
      "/attendance-leave/attendance",
      {
        params,
      }
    );

    return Array.isArray(data) ? data : [];
  },

  /* =========================================================
     ATTENDANCE HISTORY
     Used by Attendance Anomaly Detector
  ========================================================= */

  async getAttendanceHistory({
    employeeId = null,
    status = null,
  } = {}) {
    return this.getAttendance({
      employeeId,
      status,
    });
  },

  /* =========================================================
     SAVE ATTENDANCE
  ========================================================= */

  async saveAttendance({
    employeeId,
    attendanceDate,
    status,
    checkIn = null,
    checkOut = null,
    notes = null,
  }) {
    if (!employeeId) {
      throw new Error("Employee is required.");
    }

    if (!attendanceDate) {
      throw new Error(
        "Attendance date is required."
      );
    }

    if (!status) {
      throw new Error(
        "Attendance status is required."
      );
    }

    const payload = {
      employee_id: employeeId,
      attendance_date: attendanceDate,
      status,
      check_in: checkIn || null,
      check_out: checkOut || null,
      notes: notes || null,
    };

    const { data } = await api.post(
      "/attendance-leave/attendance",
      payload
    );

    return data;
  },

  /* =========================================================
     ATTENDANCE SUMMARY
  ========================================================= */

  async getAttendanceSummary(
    date = null
  ) {
    const params = {};

    if (date) {
      params.date = date;
    }

    const { data } = await api.get(
      "/attendance-leave/attendance/summary",
      {
        params,
      }
    );

    return data;
  },

  /* =========================================================
     LEAVE BALANCES
  ========================================================= */

  async getLeaveBalances(
    employeeId = null
  ) {
    const params = {};

    if (employeeId) {
      params.employee_id = employeeId;
    }

    const { data } = await api.get(
      "/attendance-leave/balances",
      {
        params,
      }
    );

    return Array.isArray(data)
      ? data
      : [];
  },

  /* =========================================================
     SAVE LEAVE BALANCE
  ========================================================= */

  async saveLeaveBalance({
    employeeId,
    leaveType,
    allocated,
    carriedForward = 0,
  }) {
    if (!employeeId) {
      throw new Error(
        "Employee is required."
      );
    }

    if (!leaveType) {
      throw new Error(
        "Leave type is required."
      );
    }

    const { data } = await api.post(
      "/attendance-leave/balances",
      {
        employee_id: employeeId,
        leave_type: leaveType,
        allocated,
        carried_forward:
          carriedForward,
      }
    );

    return data;
  },

  /* =========================================================
     LEAVE REQUESTS
  ========================================================= */

  async getLeaveRequests({
    employeeId = null,
    status = null,
  } = {}) {
    const params = {};

    if (employeeId) {
      params.employee_id =
        employeeId;
    }

    if (status) {
      params.status = status;
    }

    const { data } = await api.get(
      "/attendance-leave/requests",
      {
        params,
      }
    );

    return Array.isArray(data)
      ? data
      : [];
  },

  /* =========================================================
     CREATE LEAVE REQUEST
  ========================================================= */

  async createLeaveRequest({
    employeeId,
    leaveType,
    startDate,
    endDate,
    reason = null,
  }) {
    if (!employeeId) {
      throw new Error(
        "Employee is required."
      );
    }

    if (!leaveType) {
      throw new Error(
        "Leave type is required."
      );
    }

    if (!startDate) {
      throw new Error(
        "Start date is required."
      );
    }

    if (!endDate) {
      throw new Error(
        "End date is required."
      );
    }

    const { data } = await api.post(
      "/attendance-leave/requests",
      {
        employee_id:
          employeeId,
        leave_type:
          leaveType,
        start_date:
          startDate,
        end_date:
          endDate,
        reason:
          reason || null,
      }
    );

    return data;
  },

  /* =========================================================
     UPDATE LEAVE REQUEST
  ========================================================= */

  async updateLeaveRequest(
    requestId,
    {
      status,
      reviewComment = null,
    }
  ) {
    if (!requestId) {
      throw new Error(
        "Leave request ID is required."
      );
    }

    if (!status) {
      throw new Error(
        "Leave request status is required."
      );
    }

    const { data } = await api.put(
      `/attendance-leave/requests/${requestId}`,
      {
        status,
        review_comment:
          reviewComment || null,
      }
    );

    return data;
  },

  /* =========================================================
     APPROVE LEAVE REQUEST
  ========================================================= */

  async approveLeaveRequest(
    requestId,
    reviewComment = null
  ) {
    return this.updateLeaveRequest(
      requestId,
      {
        status: "Approved",
        reviewComment,
      }
    );
  },

  /* =========================================================
     REJECT LEAVE REQUEST
  ========================================================= */

  async rejectLeaveRequest(
    requestId,
    reviewComment = null
  ) {
    return this.updateLeaveRequest(
      requestId,
      {
        status: "Rejected",
        reviewComment,
      }
    );
  },

  /* =========================================================
     CANCEL LEAVE REQUEST
  ========================================================= */

  async cancelLeaveRequest(
    requestId,
    reviewComment = null
  ) {
    return this.updateLeaveRequest(
      requestId,
      {
        status: "Cancelled",
        reviewComment,
      }
    );
  },
};

/* =========================================================
   EXPORT
========================================================= */

export {
  attendanceLeaveService,
};

export default attendanceLeaveService;