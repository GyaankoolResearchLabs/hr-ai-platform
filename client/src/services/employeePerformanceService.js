import api from "./api";

export const employeePerformanceService = {
  /* =========================================================
     LIST MY GOALS
  ========================================================= */

  async listGoals() {
    const { data } = await api.get("/employee/performance/goals");

    return Array.isArray(data?.goals) ? data.goals : [];
  },

  /* =========================================================
     UPDATE GOAL PROGRESS
  ========================================================= */

  async updateGoalProgress(id, progress) {
    if (!id) {
      throw new Error("Goal ID is required.");
    }

    const { data } = await api.post(
      `/employee/performance/goals/${id}/progress`,
      { progress }
    );

    return data?.goal || null;
  },

  /* =========================================================
     LIST MY REVIEWS
  ========================================================= */

  async listReviews() {
    const { data } = await api.get("/employee/performance/reviews");

    return Array.isArray(data?.reviews) ? data.reviews : [];
  },

  /* =========================================================
     ACKNOWLEDGE A REVIEW
  ========================================================= */

  async acknowledgeReview(id) {
    if (!id) {
      throw new Error("Review ID is required.");
    }

    const { data } = await api.post(
      `/employee/performance/reviews/${id}/acknowledge`
    );

    return data?.review || null;
  },
};

export default employeePerformanceService;
