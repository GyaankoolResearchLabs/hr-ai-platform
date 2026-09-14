import api from "./api";

/**
 * platformAdminService
 * -----------------------------------------------------------------------
 * Talks to /api/platform-admin/* — the operator-only monitoring API.
 * Gated entirely server-side (middleware/requirePlatformAdmin.js): a
 * caller who isn't on the platform_admins allow-list gets a 404 here,
 * same as any route that doesn't exist. This module does not (and must
 * not) contain any allow-list logic of its own.
 */
export const platformAdminService = {
  /**
   * @param {object} params { search, event_type, user_email, from, to, page, limit }
   */
  async getLogs(params = {}) {
    const { data } = await api.get("/platform-admin/logs", { params });
    return data;
  },

  async getLog(id) {
    const { data } = await api.get(`/platform-admin/logs/${id}`);
    return data;
  },

  async getFilters() {
    const { data } = await api.get("/platform-admin/logs/filters");
    return data;
  },
};

export default platformAdminService;
