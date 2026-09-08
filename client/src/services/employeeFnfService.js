import api from "./api";

export const employeeFnfService = {
  /* =========================================================
     LIST MY FINAL SETTLEMENT(S)
  ========================================================= */

  async list() {
    const { data } = await api.get("/employee/fnf");

    return Array.isArray(data?.settlements) ? data.settlements : [];
  },

  /* =========================================================
     GET SETTLEMENT DETAIL
  ========================================================= */

  async getById(id) {
    if (!id) {
      throw new Error("Settlement ID is required.");
    }

    const { data } = await api.get(`/employee/fnf/${id}`);

    return data?.settlement || null;
  },
};

export default employeeFnfService;
