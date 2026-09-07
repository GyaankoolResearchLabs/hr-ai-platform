import api from "./api";

export const employeeLearningService = {
  /* =========================================================
     LIST MY ASSIGNED COURSES
  ========================================================= */

  async list() {
    const { data } = await api.get("/employee/learning");

    return Array.isArray(data?.assignments) ? data.assignments : [];
  },

  /* =========================================================
     GET ONE ASSIGNED COURSE
  ========================================================= */

  async getById(id) {
    if (!id) {
      throw new Error("Assignment ID is required.");
    }

    const { data } = await api.get(`/employee/learning/${id}`);

    return data;
  },

  /* =========================================================
     UPDATE PROGRESS
  ========================================================= */

  async updateProgress(id, progressPercentage) {
    if (!id) {
      throw new Error("Assignment ID is required.");
    }

    const { data } = await api.post(`/employee/learning/${id}/progress`, {
      progress_percentage: progressPercentage,
    });

    return data;
  },

  /* =========================================================
     MARK COMPLETE
  ========================================================= */

  async markComplete(id) {
    if (!id) {
      throw new Error("Assignment ID is required.");
    }

    const { data } = await api.post(`/employee/learning/${id}/progress`, {
      mark_complete: true,
    });

    return data;
  },
};

export default employeeLearningService;
