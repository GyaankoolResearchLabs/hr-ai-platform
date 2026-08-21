import { supabase } from "../config/supabase.js";

/* =========================================================
   GET BUDDY ASSIGNMENTS
========================================================= */

export async function getBuddyAssignments(
  organizationId
) {
  const { data, error } = await supabase
    .from("buddy_mentor_assignments")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data || [];
}

/* =========================================================
   CREATE / ASSIGN BUDDY
========================================================= */

export async function createBuddyAssignment({
  organizationId,
  newHireId,
  buddyId,
  role = "buddy",
  notes = null,
}) {
  if (String(newHireId) === String(buddyId)) {
    throw new Error(
      "A new hire cannot be assigned to themselves."
    );
  }

  const { data: existing, error: existingError } =
    await supabase
      .from("buddy_mentor_assignments")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("new_hire_id", newHireId)
      .eq("role", role)
      .eq("status", "active")
      .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    throw new Error(
      "This new hire already has an active buddy assignment."
    );
  }

  const { data, error } = await supabase
    .from("buddy_mentor_assignments")
    .insert({
      organization_id: organizationId,
      new_hire_id: newHireId,
      buddy_id: buddyId,
      role,
      status: "active",
      assigned_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      notes,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   UPDATE ASSIGNMENT
========================================================= */

export async function updateBuddyAssignment({
  organizationId,
  assignmentId,
  buddyId,
  role,
  status,
  notes,
}) {
  const updates = {};

  if (buddyId !== undefined) {
    updates.buddy_id = buddyId;
  }

  if (role !== undefined) {
    updates.role = role;
  }

  if (status !== undefined) {
    updates.status = status;

    if (status === "completed") {
      updates.completed_at =
        new Date().toISOString();
    }

    if (status === "active") {
      updates.completed_at = null;

      if (!updates.started_at) {
        updates.started_at =
          new Date().toISOString();
      }
    }
  }

  if (notes !== undefined) {
    updates.notes = notes;
  }

  updates.updated_at =
    new Date().toISOString();

  const { data, error } = await supabase
    .from("buddy_mentor_assignments")
    .update(updates)
    .eq("id", assignmentId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   DELETE / REMOVE ASSIGNMENT
========================================================= */

export async function deleteBuddyAssignment({
  organizationId,
  assignmentId,
}) {
  const { data, error } = await supabase
    .from("buddy_mentor_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("organization_id", organizationId)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data;
}