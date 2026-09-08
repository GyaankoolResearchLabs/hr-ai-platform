import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadFixtureContext } from "../helpers/loadContext.mjs";
import { as } from "../helpers/apiClient.mjs";
import { supabaseAdmin, mintSession } from "../helpers/supabaseClients.mjs";

/*
|--------------------------------------------------------------------------
| EMPLOYEE INVITE / ACCEPT FLOW
|--------------------------------------------------------------------------
| Uses its own dedicated fixture employee (unlinked, no user_id) rather
| than empA/empB from the shared context, since accepting an invite
| mutates employees.user_id and organization_members — state this file
| owns and cleans up itself so it can't interfere with the other suites.
|--------------------------------------------------------------------------
*/

let ctx;
let invitee; // { employeeId, email }
let inviteToken;
let inviteeSession;

beforeAll(async () => {
  ctx = loadFixtureContext();

  const email = `test-${ctx.runId}-invitee@example.test`;

  const { data: employee, error } = await supabaseAdmin
    .from("employees")
    .insert({
      organization_id: ctx.orgId,
      full_name: `Test Invitee ${ctx.runId}`,
      email,
      department: "Engineering",
      title: "Test Engineer",
      employee_code: `T-${ctx.runId}-INV`,
      employment_status: "Active",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Invite fixture: create employee failed: ${error.message}`);
  }

  invitee = { employeeId: employee.id, email };
});

afterAll(async () => {
  if (!invitee) return;

  // If accept succeeded, a real auth user + org membership now exist
  // for the invitee's email — clean those up too.
  const { data: linkedEmployee } = await supabaseAdmin
    .from("employees")
    .select("user_id")
    .eq("id", invitee.employeeId)
    .maybeSingle();

  if (linkedEmployee?.user_id) {
    await supabaseAdmin
      .from("organization_members")
      .delete()
      .eq("organization_id", ctx.orgId)
      .eq("user_id", linkedEmployee.user_id);

    await supabaseAdmin.auth.admin.deleteUser(linkedEmployee.user_id).catch(() => {});
  }

  await supabaseAdmin
    .from("employee_invitations")
    .delete()
    .eq("employee_id", invitee.employeeId);

  await supabaseAdmin.from("employees").delete().eq("id", invitee.employeeId);
});

describe("employee invitation flow", () => {
  it("HR can create an invitation for an unlinked employee", async () => {
    const res = await as(ctx.hr.token).post("/api/employee-invitations", {
      employee_id: invitee.employeeId,
    });

    expect(res.status).toBe(201);
    expect(res.body.employee_id).toBe(invitee.employeeId);
    expect(res.body.email).toBe(invitee.email);
    expect(res.body.status).toBe("pending");
    expect(res.body.token).toBeTruthy();

    inviteToken = res.body.token;
  });

  it("cannot be accepted by an authenticated user whose email doesn't match the invitation", async () => {
    const res = await as(ctx.outsider.token).post(
      "/api/employee-invitations/accept",
      { token: inviteToken }
    );

    expect(res.status).toBe(403);

    // Must not have linked — a rejected accept leaves the employee row
    // untouched.
    const { data: employee } = await supabaseAdmin
      .from("employees")
      .select("user_id")
      .eq("id", invitee.employeeId)
      .single();

    expect(employee.user_id).toBeNull();
  });

  it("can be accepted by the correct (matching-email) invitee, linking user_id and creating membership", async () => {
    inviteeSession = await mintSession(invitee.email);

    const res = await as(inviteeSession.access_token).post(
      "/api/employee-invitations/accept",
      { token: inviteToken }
    );

    expect(res.status).toBe(200);

    const { data: employee } = await supabaseAdmin
      .from("employees")
      .select("user_id")
      .eq("id", invitee.employeeId)
      .single();

    expect(employee.user_id).toBe(inviteeSession.user.id);

    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", inviteeSession.user.id)
      .single();

    expect(membership.organization_id).toBe(ctx.orgId);
    expect(membership.role).toBe("employee");
  });

  it("cannot be accepted a second time", async () => {
    const res = await as(inviteeSession.access_token).post(
      "/api/employee-invitations/accept",
      { token: inviteToken }
    );

    expect(res.status).toBe(409);
  });
});
