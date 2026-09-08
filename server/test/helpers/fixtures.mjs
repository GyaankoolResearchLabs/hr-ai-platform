import crypto from "node:crypto";
import { supabaseAdmin, mintSession } from "./supabaseClients.mjs";

/*
|--------------------------------------------------------------------------
| SHARED FIXTURE CONTEXT
|--------------------------------------------------------------------------
|
| One isolated organization, tagged with a unique per-run id so it can
| never collide with (or be confused for) real data — Meera Joshi,
| Divya Iyer, and the real HR owner account are never touched by this
| suite. Built once in globalSetup and reused read-only by every test
| file; torn down once at the end of the run.
|--------------------------------------------------------------------------
*/

const RUN_ID = crypto.randomUUID().slice(0, 8);

function testEmail(label) {
  return `test-${RUN_ID}-${label}@example.test`;
}

async function createAuthUserAndSession(label) {
  const email = testEmail(label);
  const session = await mintSession(email);

  return {
    email,
    userId: session.user.id,
    token: session.access_token,
  };
}

/*
 * If anything below throws partway through, whatever was already
 * created must still be cleaned up — otherwise a failed setup leaks
 * real rows/auth users into the shared Supabase project on every
 * retry. buildFixtureContext() wraps this in try/catch and tears down
 * the partial `created` state before rethrowing.
 */
async function buildFixtureContextUnsafe(created) {
  let orgId = null;

  function track(table, id) {
    created.tableRows.push({ table, id });
    return id;
  }

  /* -------------------------------------------------------
     ORGANIZATION + HR OWNER
  ------------------------------------------------------- */

  const hr = await createAuthUserAndSession("hr");
  created.authUserIds.push(hr.userId);

  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: `Test Org ${RUN_ID}`,
      owner_id: hr.userId,
    })
    .select("id")
    .single();

  if (orgError) {
    throw new Error(`Fixture: create organization failed: ${orgError.message}`);
  }

  orgId = org.id;
  created.orgId = orgId; // exposed so a partial-failure cleanup can still scope by it
  track("organizations", orgId);

  const { error: hrMemberError } = await supabaseAdmin
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: hr.userId, role: "owner" });

  if (hrMemberError) {
    throw new Error(`Fixture: HR membership failed: ${hrMemberError.message}`);
  }

  track("organization_members", hr.userId);

  /* -------------------------------------------------------
     EMPLOYEE A / EMPLOYEE B
  ------------------------------------------------------- */

  async function createLinkedEmployee(label) {
    const auth = await createAuthUserAndSession(label);
    created.authUserIds.push(auth.userId);

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .insert({
        organization_id: orgId,
        user_id: auth.userId,
        full_name: `Test Employee ${label} ${RUN_ID}`,
        email: auth.email,
        department: "Engineering",
        title: "Test Engineer",
        employee_code: `T-${RUN_ID}-${label}`,
        employment_status: "Active",
        joining_date: new Date().toISOString().slice(0, 10),
      })
      .select("*")
      .single();

    if (employeeError) {
      throw new Error(
        `Fixture: create employee ${label} failed: ${employeeError.message}`
      );
    }

    track("employees", employee.id);

    const { error: memberError } = await supabaseAdmin
      .from("organization_members")
      .insert({ organization_id: orgId, user_id: auth.userId, role: "employee" });

    if (memberError) {
      throw new Error(
        `Fixture: employee ${label} membership failed: ${memberError.message}`
      );
    }

    track("organization_members", auth.userId);

    return { ...auth, employeeId: employee.id, employeeRow: employee };
  }

  const empA = await createLinkedEmployee("A");
  const empB = await createLinkedEmployee("B");

  /* -------------------------------------------------------
     ORPHAN — org member, but no linked/matching employees row
     (for requireEmployee's 403 "not linked" case)
  ------------------------------------------------------- */

  const orphan = await createAuthUserAndSession("orphan");
  created.authUserIds.push(orphan.userId);

  const { error: orphanMemberError } = await supabaseAdmin
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: orphan.userId, role: "employee" });

  if (orphanMemberError) {
    throw new Error(`Fixture: orphan membership failed: ${orphanMemberError.message}`);
  }

  track("organization_members", orphan.userId);

  /* -------------------------------------------------------
     OUTSIDER — real authenticated user, no org membership at
     all (for the invite email-mismatch case)
  ------------------------------------------------------- */

  const outsider = await createAuthUserAndSession("outsider");
  created.authUserIds.push(outsider.userId);

  /* -------------------------------------------------------
     RESOURCES OWNED BY EMPLOYEE B
     (used to prove employee A can never reach them)
  ------------------------------------------------------- */

  const resources = {};

  // Notification
  {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        organization_id: orgId,
        employee_id: empB.employeeId,
        type: "test_fixture",
        title: "Fixture notification",
        message: "Owned by employee B.",
      })
      .select("id")
      .single();

    if (error) throw new Error(`Fixture: notification failed: ${error.message}`);
    resources.notificationId = track("notifications", data.id);
  }

  // Uploaded document
  {
    const { data, error } = await supabaseAdmin
      .from("employee_documents")
      .insert({
        organization_id: orgId,
        employee_id: empB.employeeId,
        document_type: "pan",
        document_name: "PAN",
        status: "active",
        verification_status: "pending",
      })
      .select("id")
      .single();

    if (error) throw new Error(`Fixture: document failed: ${error.message}`);
    resources.documentId = track("employee_documents", data.id);
  }

  // Learning course + assignment
  {
    const { data: course, error: courseError } = await supabaseAdmin
      .from("learning_courses")
      .insert({
        organization_id: orgId,
        title: `Fixture Course ${RUN_ID}`,
        description: "Fixture course.",
        difficulty: "beginner",
        estimated_duration_minutes: 30,
      })
      .select("id")
      .single();

    if (courseError) throw new Error(`Fixture: course failed: ${courseError.message}`);
    resources.courseId = track("learning_courses", course.id);

    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("learning_course_assignments")
      .insert({
        organization_id: orgId,
        employee_id: empB.employeeId,
        course_id: course.id,
        status: "assigned",
      })
      .select("id")
      .single();

    if (assignmentError)
      throw new Error(`Fixture: assignment failed: ${assignmentError.message}`);
    resources.learningAssignmentId = track(
      "learning_course_assignments",
      assignment.id
    );
  }

  // Payroll run + item + published payslip
  {
    const { data: run, error: runError } = await supabaseAdmin
      .from("payroll_runs")
      .insert({
        organization_id: orgId,
        payroll_month: "2020-01-01",
        status: "processed",
      })
      .select("id")
      .single();

    if (runError) throw new Error(`Fixture: payroll run failed: ${runError.message}`);
    resources.payrollRunId = track("payroll_runs", run.id);

    const { data: item, error: itemError } = await supabaseAdmin
      .from("payroll_run_items")
      .insert({
        organization_id: orgId,
        payroll_run_id: run.id,
        employee_id: empB.employeeId,
        working_days: 20,
        paid_days: 20,
        unpaid_days: 0,
        base_salary: 1000,
        gross_pay: 1000,
        total_deductions: 0,
        net_pay: 1000,
      })
      .select("id")
      .single();

    if (itemError)
      throw new Error(`Fixture: payroll run item failed: ${itemError.message}`);
    resources.payrollRunItemId = track("payroll_run_items", item.id);

    const { data: payslip, error: payslipError } = await supabaseAdmin
      .from("payslips")
      .insert({
        organization_id: orgId,
        payroll_run_id: run.id,
        payroll_run_item_id: item.id,
        employee_id: empB.employeeId,
        payslip_number: `PS-FIXTURE-${RUN_ID}`,
        payroll_month: "2020-01-01",
        period_start: "2020-01-01",
        period_end: "2020-01-31",
        employee_snapshot: {},
        attendance_snapshot: {},
        earnings: [],
        gross_pay: 1000,
        deductions: [],
        total_deductions: 0,
        net_pay: 1000,
        employer_contributions: [],
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (payslipError)
      throw new Error(`Fixture: payslip failed: ${payslipError.message}`);
    resources.payslipId = track("payslips", payslip.id);
  }

  // Expense claim
  {
    const { data, error } = await supabaseAdmin
      .from("expense_claims")
      .insert({
        organization_id: orgId,
        employee_id: empB.employeeId,
        claim_number: `EXP-FIXTURE-${RUN_ID}`,
        title: "Fixture claim",
        claim_date: new Date().toISOString().slice(0, 10),
        currency_code: "INR",
        total_amount: 100,
        status: "submitted",
      })
      .select("id")
      .single();

    if (error) throw new Error(`Fixture: expense claim failed: ${error.message}`);
    resources.expenseClaimId = track("expense_claims", data.id);
  }

  // F&F settlement (a visible status — "processed")
  {
    const { data, error } = await supabaseAdmin
      .from("fnf_settlements")
      .insert({
        organization_id: orgId,
        employee_id: empB.employeeId,
        settlement_number: `FNF-FIXTURE-${RUN_ID}`,
        settlement_status: "processed",
        last_working_date: "2020-01-31",
        currency_code: "INR",
        monthly_gross_salary: 1000,
        daily_salary: 33.33,
        payable_days: 1,
        salary_for_payable_days: 33.33,
        eligible_leave_days: 0,
        leave_encashment_days: 0,
        leave_encashment_amount: 0,
        notice_period_days: 0,
        notice_served_days: 0,
        notice_shortfall_days: 0,
        notice_recovery_amount: 0,
        notice_payable_amount: 0,
        pending_reimbursements: 0,
        bonus_amount: 0,
        incentives_amount: 0,
        other_earnings: 0,
        statutory_deductions: 0,
        outstanding_deductions: 0,
        asset_recovery_amount: 0,
        other_deductions: 0,
        total_earnings: 33.33,
        total_deductions: 0,
        final_settlement_amount: 33.33,
        employee_snapshot: {},
        payroll_snapshot: {},
        leave_snapshot: {},
        reimbursement_snapshot: {},
        calculation_snapshot: {},
      })
      .select("id")
      .single();

    if (error) throw new Error(`Fixture: fnf settlement failed: ${error.message}`);
    resources.fnfId = track("fnf_settlements", data.id);
  }

  // Performance goal
  {
    const { data, error } = await supabaseAdmin
      .from("performance_goals")
      .insert({
        organization_id: orgId,
        employee_id: empB.employeeId,
        title: "Fixture goal",
        type: "goal",
        progress: 0,
        status: "not_started",
      })
      .select("id")
      .single();

    if (error) throw new Error(`Fixture: performance goal failed: ${error.message}`);
    resources.goalId = track("performance_goals", data.id);
  }

  // Performance review cycle + review
  {
    const { data: cycle, error: cycleError } = await supabaseAdmin
      .from("performance_review_cycles")
      .insert({
        organization_id: orgId,
        title: `Fixture cycle ${RUN_ID}`,
        review_type: "annual",
        start_date: "2020-01-01",
        due_date: "2020-03-31",
        status: "active",
      })
      .select("id")
      .single();

    if (cycleError) throw new Error(`Fixture: review cycle failed: ${cycleError.message}`);
    resources.reviewCycleId = track("performance_review_cycles", cycle.id);

    const { data: review, error: reviewError } = await supabaseAdmin
      .from("performance_reviews")
      .insert({
        organization_id: orgId,
        cycle_id: cycle.id,
        employee_id: empB.employeeId,
        status: "submitted",
        rating: 4,
        comments: "Fixture review.",
      })
      .select("id")
      .single();

    if (reviewError) throw new Error(`Fixture: review failed: ${reviewError.message}`);
    resources.reviewId = track("performance_reviews", review.id);
  }

  // A pending leave request for employee A — used by the role-gating
  // suite to prove HR can still approve it, and employee-role callers
  // (even acting on themselves) cannot.
  {
    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .insert({
        organization_id: orgId,
        employee_id: empA.employeeId,
        leave_type: "Annual Leave",
        start_date: "2099-01-01",
        end_date: "2099-01-01",
        total_days: 1,
        reason: "Fixture leave request.",
        status: "Pending",
      })
      .select("id")
      .single();

    if (error) throw new Error(`Fixture: leave request failed: ${error.message}`);
    resources.pendingLeaveRequestId = track("leave_requests", data.id);
  }

  return {
    runId: RUN_ID,
    orgId,
    hr,
    empA,
    empB,
    orphan,
    outsider,
    resources,
    _created: created,
  };
}

export async function buildFixtureContext() {
  const created = { authUserIds: [], tableRows: [] };

  try {
    return await buildFixtureContextUnsafe(created);
  } catch (error) {
    console.error(
      "[fixtures] Setup failed partway through — cleaning up what was already created..."
    );

    await teardownFixtureContext({ _created: created, orgId: created.orgId ?? null }).catch(
      (cleanupError) => {
        console.error(
          "[fixtures] Cleanup after failed setup also failed:",
          cleanupError
        );
      }
    );

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| TEARDOWN
|--------------------------------------------------------------------------
| Deletes exactly what buildFixtureContext() created, children before
| parents, then the auth users. Never touches anything else.
|--------------------------------------------------------------------------
*/

export async function teardownFixtureContext(context) {
  if (!context) return;

  const { _created: created, orgId } = context;

  // Delete tracked rows in reverse creation order (children first).
  for (const { table, id } of [...created.tableRows].reverse()) {
    if (table === "organization_members") {
      await supabaseAdmin
        .from("organization_members")
        .delete()
        .eq("organization_id", orgId)
        .eq("user_id", id);
      continue;
    }

    await supabaseAdmin.from(table).delete().eq("id", id);
  }

  for (const userId of created.authUserIds) {
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
  }
}
