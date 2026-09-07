import api from "./api";

export const employeePayslipsService = {
  /* =========================================================
     LIST MY PAYSLIPS
  ========================================================= */

  async list() {
    const { data } = await api.get("/employee/payslips");

    return Array.isArray(data?.payslips) ? data.payslips : [];
  },

  /* =========================================================
     GET ONE PAYSLIP
  ========================================================= */

  async getById(id) {
    if (!id) {
      throw new Error("Payslip ID is required.");
    }

    const { data } = await api.get(`/employee/payslips/${id}`);

    return data?.payslip || null;
  },

  /* =========================================================
     DOWNLOAD (marks downloaded, returns full payslip to print)
  ========================================================= */

  async download(id) {
    if (!id) {
      throw new Error("Payslip ID is required.");
    }

    const { data } = await api.get(`/employee/payslips/${id}/download`);

    return data?.payslip || null;
  },
};

export default employeePayslipsService;
