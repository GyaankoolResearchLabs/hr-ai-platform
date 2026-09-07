import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { resolveEmployee as requireEmployee } from "../middleware/resolveEmployee.js";
import {
  getEmployeeNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notificationService.js";

const router = Router();

router.use(requireAuth);
router.use(requireEmployee);

/*
|--------------------------------------------------------------------------
| EMPLOYEE NOTIFICATIONS
|--------------------------------------------------------------------------
|
| GET  /api/employee/notifications
| POST /api/employee/notifications/:id/read
| POST /api/employee/notifications/read-all
|
| req.employee is set by requireEmployee and is ALREADY scoped to the
| authenticated user — every query below uses req.employee.id, never a
| client-supplied employee id.
|
| All reads/writes go through services/notificationService.js — the
| same functions routes/attendanceLeave.js's leave-approval trigger
| (and any future trigger) uses to create these rows.
|--------------------------------------------------------------------------
*/

function handleRouteError(res, error, fallbackMessage) {
  console.error("[EmployeeNotifications]", error);

  return res.status(error?.status || error?.statusCode || 500).json({
    message: error?.message || fallbackMessage,
  });
}

/*
|--------------------------------------------------------------------------
| GET /api/employee/notifications
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const employee = req.employee;

    const notifications = await getEmployeeNotifications({
      organizationId: employee.organization_id,
      employeeId: employee.id,
    });

    const unreadCount = notifications.filter(
      (item) => !item.read_at
    ).length;

    return res.json({ notifications, unread_count: unreadCount });
  } catch (error) {
    return handleRouteError(
      res,
      error,
      "Could not load notifications."
    );
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/employee/notifications/:id/read
|--------------------------------------------------------------------------
*/

router.post("/:id/read", async (req, res) => {
  try {
    const employee = req.employee;

    const notification = await markNotificationRead({
      organizationId: employee.organization_id,
      employeeId: employee.id,
      notificationId: req.params.id,
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    return res.json({ notification });
  } catch (error) {
    return handleRouteError(
      res,
      error,
      "Could not mark notification as read."
    );
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/employee/notifications/read-all
|--------------------------------------------------------------------------
*/

router.post("/read-all", async (req, res) => {
  try {
    const employee = req.employee;

    const result = await markAllNotificationsRead({
      organizationId: employee.organization_id,
      employeeId: employee.id,
    });

    return res.json(result);
  } catch (error) {
    return handleRouteError(
      res,
      error,
      "Could not mark notifications as read."
    );
  }
});

export default router;
