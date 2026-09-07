import { supabaseAdmin } from "../config/supabase.js";

/*
|--------------------------------------------------------------------------
| NOTIFICATION SERVICE
|--------------------------------------------------------------------------
|
| Minimal, centralized notification creation/delivery on top of the
| `notifications` table (docs/migrations/002_notifications.sql).
|
| Used by:
|
| - routes/attendanceLeave.js — leave request approved/rejected
| - routes/employeeNotifications.js — the employee-facing /me surface
|
| Future triggers (payslip published, expense claim approved/rejected,
| document verified, course assigned, etc.) should call
| createNotification() the same way rather than growing a second
| notification path.
|--------------------------------------------------------------------------
*/

function createServiceError(message, status = 400) {
  const error = new Error(message);
  error.status = status;

  return error;
}

/* =========================================================
   CREATE
========================================================= */

export async function createNotification({
  organizationId,
  employeeId,
  type,
  title,
  message = null,
}) {
  if (!organizationId || !employeeId || !type || !title) {
    // Notification creation is always a side effect of some other
    // action — never let a malformed call throw and break that
    // action. Log and move on.
    console.error(
      "[NotificationService] createNotification called with missing fields:",
      { organizationId, employeeId, type, title }
    );

    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert({
      organization_id: organizationId,
      employee_id: employeeId,
      type,
      title,
      message,
    })
    .select("*")
    .single();

  if (error) {
    console.error(
      "[NotificationService] Failed to create notification:",
      error
    );

    return null;
  }

  return data;
}

/* =========================================================
   LIST FOR EMPLOYEE
========================================================= */

export async function getEmployeeNotifications({
  organizationId,
  employeeId,
  limit = 50,
}) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}

/* =========================================================
   MARK ONE READ
========================================================= */

export async function markNotificationRead({
  organizationId,
  employeeId,
  notificationId,
}) {
  if (!notificationId) {
    throw createServiceError("Notification ID is required.", 400);
  }

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .eq("id", notificationId)
    .is("read_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  /*
   * Either the notification doesn't exist/doesn't belong to this
   * employee, or it was already read. Distinguish the two so the
   * route can 404 correctly on the former and no-op on the latter.
   */
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .eq("id", notificationId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  return existing || null;
}

/* =========================================================
   MARK ALL READ
========================================================= */

export async function markAllNotificationsRead({
  organizationId,
  employeeId,
}) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("read_at", null)
    .select("id");

  if (error) {
    throw error;
  }

  return { updated: (data || []).length };
}
