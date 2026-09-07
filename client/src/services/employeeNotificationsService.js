import api from "./api";

export const employeeNotificationsService = {
  /* =========================================================
     LIST MY NOTIFICATIONS
  ========================================================= */

  async list() {
    const { data } = await api.get("/employee/notifications");

    return {
      notifications: Array.isArray(data?.notifications)
        ? data.notifications
        : [],
      unreadCount: Number(data?.unread_count) || 0,
    };
  },

  /* =========================================================
     MARK ONE READ
  ========================================================= */

  async markRead(id) {
    if (!id) {
      throw new Error("Notification ID is required.");
    }

    const { data } = await api.post(`/employee/notifications/${id}/read`);

    return data?.notification || null;
  },

  /* =========================================================
     MARK ALL READ
  ========================================================= */

  async markAllRead() {
    const { data } = await api.post("/employee/notifications/read-all");

    return data;
  },
};

export default employeeNotificationsService;
