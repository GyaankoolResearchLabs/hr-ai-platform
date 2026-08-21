import api from "./api";

export const employeeService = {
  /* =========================================================
     GET ALL EMPLOYEES
  ========================================================= */

  async list() {
    const { data } = await api.get("/employees");

    return Array.isArray(data) ? data : [];
  },

  /* =========================================================
     GET ONE EMPLOYEE
  ========================================================= */

  async getById(id) {
    if (!id) {
      throw new Error("Employee ID is required.");
    }

    const { data } = await api.get(`/employees/${id}`);

    return data;
  },

  /* =========================================================
     CREATE EMPLOYEE
  ========================================================= */

  async create(employee) {
    if (!employee) {
      throw new Error("Employee data is required.");
    }

    const { data } = await api.post(
      "/employees",
      employee
    );

    return data;
  },

  /* =========================================================
     UPDATE EMPLOYEE
  ========================================================= */

  async update(id, employee) {
    if (!id) {
      throw new Error("Employee ID is required.");
    }

    if (!employee) {
      throw new Error("Employee data is required.");
    }

    const { data } = await api.put(
      `/employees/${id}`,
      employee
    );

    return data;
  },

  /* =========================================================
     DELETE EMPLOYEE
  ========================================================= */

  async delete(id) {
    if (!id) {
      throw new Error("Employee ID is required.");
    }

    const { data } = await api.delete(
      `/employees/${id}`
    );

    return data;
  },

  /* =========================================================
     BULK CREATE
  ========================================================= */

  async bulkCreate(employees) {
    if (!Array.isArray(employees)) {
      throw new Error(
        "Employees must be provided as an array."
      );
    }

    const { data } = await api.post(
      "/employees/bulk",
      {
        employees,
      }
    );

    return data;
  },
};

export default employeeService;