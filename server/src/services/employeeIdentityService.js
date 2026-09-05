import { supabaseAdmin } from "../config/supabase.js";

function createIdentityError(message, status = 403) {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;

  return error;
}

export async function resolveEmployeeForUser({
  organizationId,
  userId,
  email,
} = {}) {
  if (!organizationId) {
    throw createIdentityError(
      "Organization context is required.",
      400,
    );
  }

  if (!userId) {
    throw createIdentityError(
      "Authenticated user is required.",
      401,
    );
  }

  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  const {
    data: linkedEmployee,
    error: linkedError,
  } = await supabaseAdmin
    .from("employees")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (linkedError && linkedError.code !== "42703") {
    throw linkedError;
  }

  if (linkedEmployee) {
    return linkedEmployee;
  }

  if (!normalizedEmail) {
    throw createIdentityError(
      "This user is not linked to an employee record.",
      403,
    );
  }

  const { data, error } =
    await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("organization_id", organizationId)
      .ilike("email", normalizedEmail)
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createIdentityError(
      "This user is not linked to an employee record.",
      403,
    );
  }

  return data;
}

export default resolveEmployeeForUser;
