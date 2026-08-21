import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "[Workforce Query] Supabase environment variables are missing."
  );
}

const supabase = createClient(
  supabaseUrl || "",
  supabaseServiceKey || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function number(value) {
  return Number(value || 0);
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(number(value) * factor) / factor;
}

function percentage(part, total) {
  if (!total) return 0;
  return round((part / total) * 100, 1);
}

function detectDepartment(question, departments) {
  const normalizedQuestion = normalizeText(question);

  return (
    departments.find((department) =>
      normalizedQuestion.includes(normalizeText(department))
    ) || null
  );
}

async function getEmployees(organizationId) {
  let query = supabase
    .from("employees")
    .select("*");

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Unable to load employees: ${error.message}`
    );
  }

  return data || [];
}

async function getAttendance(organizationId) {
  let query = supabase
    .from("attendance_records")
    .select("*");

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Unable to load attendance records: ${error.message}`
    );
  }

  return data || [];
}

async function getLeaveRequests(organizationId) {
  let query = supabase
    .from("leave_requests")
    .select("*");

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Unable to load leave requests: ${error.message}`
    );
  }

  return data || [];
}

async function getPerformanceReviews(organizationId) {
  let query = supabase
    .from("performance_reviews")
    .select("*");

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Unable to load performance reviews: ${error.message}`
    );
  }

  return data || [];
}

function employeeIsActive(employee) {
  const status = normalizeText(
    employee.status ||
      employee.employment_status ||
      employee.employee_status
  );

  if (!status) {
    return true;
  }

  return [
    "active",
    "employed",
    "current",
  ].includes(status);
}

function employeeDepartment(employee) {
  return (
    employee.department ||
    employee.department_name ||
    "Unassigned"
  );
}

function employeeName(employee) {
  return (
    employee.full_name ||
    employee.name ||
    employee.employee_name ||
    employee.email ||
    "Unknown employee"
  );
}

function calculateDepartmentBreakdown(employees) {
  const map = {};

  for (const employee of employees) {
    const department = employeeDepartment(employee);

    if (!map[department]) {
      map[department] = {
        department,
        headcount: 0,
        active: 0,
      };
    }

    map[department].headcount += 1;

    if (employeeIsActive(employee)) {
      map[department].active += 1;
    }
  }

  return Object.values(map).sort(
    (a, b) => b.headcount - a.headcount
  );
}

function calculateAttendance(attendance) {
  const total = attendance.length;

  const present = attendance.filter((record) => {
    const status = normalizeText(record.status);
    return status === "present";
  }).length;

  const absent = attendance.filter((record) => {
    const status = normalizeText(record.status);
    return status === "absent";
  }).length;

  const leave = attendance.filter((record) => {
    const status = normalizeText(record.status);
    return [
      "on leave",
      "leave",
      "on_leave",
    ].includes(status);
  }).length;

  return {
    total,
    present,
    absent,
    leave,
    attendanceRate: percentage(
      present,
      total
    ),
  };
}

function calculateLeave(leaveRequests) {
  const total = leaveRequests.length;

  const pending = leaveRequests.filter((request) => {
    const status = normalizeText(request.status);
    return status === "pending";
  }).length;

  const approved = leaveRequests.filter((request) => {
    const status = normalizeText(request.status);

    return [
      "approved",
      "approve",
    ].includes(status);
  }).length;

  const rejected = leaveRequests.filter((request) => {
    const status = normalizeText(request.status);

    return [
      "rejected",
      "reject",
      "denied",
    ].includes(status);
  }).length;

  return {
    total,
    pending,
    approved,
    rejected,
  };
}

function calculatePerformance(reviews) {
  const total = reviews.length;

  const completed = reviews.filter((review) => {
    const status = normalizeText(review.status);

    return [
      "completed",
      "complete",
      "submitted",
      "acknowledged",
    ].includes(status);
  }).length;

  const inProgress = reviews.filter((review) => {
    const status = normalizeText(review.status);

    return [
      "in_progress",
      "in progress",
      "started",
    ].includes(status);
  }).length;

  return {
    total,
    completed,
    inProgress,
    completionRate: percentage(
      completed,
      total
    ),
  };
}

function buildSummary(metrics) {
  return {
    headcount: metrics.headcount,
    activeEmployees: metrics.activeEmployees,
    inactiveEmployees:
      metrics.headcount - metrics.activeEmployees,

    departments:
      metrics.departmentBreakdown.length,

    largestDepartment:
      metrics.departmentBreakdown[0] || null,

    attendanceRate:
      metrics.attendance.attendanceRate,

    presentToday:
      metrics.attendance.present,

    absentToday:
      metrics.attendance.absent,

    employeesOnLeave:
      metrics.attendance.leave,

    totalLeaveRequests:
      metrics.leave.total,

    pendingLeaveRequests:
      metrics.leave.pending,

    approvedLeaveRequests:
      metrics.leave.approved,

    performanceReviews:
      metrics.performance.total,

    completedReviews:
      metrics.performance.completed,

    performanceCompletionRate:
      metrics.performance.completionRate,
  };
}

function answerQuestion(
  question,
  metrics
) {
  const q = normalizeText(question);

  const departments =
    metrics.departmentBreakdown.map(
      (item) => item.department
    );

  const department =
    detectDepartment(
      q,
      departments
    );

  if (
    q.includes("headcount") ||
    q.includes("how many employees") ||
    q.includes("total employees") ||
    q.includes("number of employees") ||
    q.includes("workforce size") ||
    q.includes("workforce size")
  ) {
    if (department) {
      const item =
        metrics.departmentBreakdown.find(
          (entry) =>
            normalizeText(
              entry.department
            ) === normalizeText(department)
        );

      return {
        type: "metric",
        title: `${department} headcount`,
        answer: `${item?.headcount || 0} employees are in ${department}.`,
        value: item?.headcount || 0,
        data: item || null,
      };
    }

    return {
      type: "metric",
      title: "Total headcount",
      answer: `The organization currently has ${metrics.headcount} employees.`,
      value: metrics.headcount,
      data: {
        headcount: metrics.headcount,
      },
    };
  }

  if (
    q.includes("active employees") ||
    q.includes("how many are active") ||
    q.includes("active workforce")
  ) {
    return {
      type: "metric",
      title: "Active employees",
      answer: `${metrics.activeEmployees} employees are currently active.`,
      value: metrics.activeEmployees,
      data: {
        activeEmployees:
          metrics.activeEmployees,
      },
    };
  }

  if (
    q.includes("department") &&
    (
      q.includes("breakdown") ||
      q.includes("distribution") ||
      q.includes("split") ||
      q.includes("each department")
    )
  ) {
    return {
      type: "table",
      title: "Workforce by department",
      answer: `The workforce is distributed across ${metrics.departmentBreakdown.length} departments.`,
      data: metrics.departmentBreakdown,
    };
  }

  if (
    q.includes("largest department") ||
    q.includes("biggest department") ||
    q.includes("most employees")
  ) {
    const largest =
      metrics.departmentBreakdown[0];

    return {
      type: "metric",
      title: "Largest department",
      answer: largest
        ? `${largest.department} is the largest department with ${largest.headcount} employees.`
        : "There is no department data available.",
      value:
        largest?.headcount || 0,
      data: largest || null,
    };
  }

  if (
    q.includes("attendance") ||
    q.includes("present") ||
    q.includes("absent")
  ) {
    return {
      type: "attendance",
      title: "Attendance",
      answer: `The current attendance rate is ${metrics.attendance.attendanceRate}%. ${metrics.attendance.present} employees are marked present, ${metrics.attendance.absent} absent, and ${metrics.attendance.leave} on leave.`,
      data: metrics.attendance,
    };
  }

  if (
    q.includes("on leave") ||
    q.includes("leave") ||
    q.includes("vacation")
  ) {
    return {
      type: "leave",
      title: "Leave requests",
      answer: `There are ${metrics.leave.total} leave requests, including ${metrics.leave.pending} pending and ${metrics.leave.approved} approved requests.`,
      data: metrics.leave,
    };
  }

  if (
    q.includes("performance review") ||
    q.includes("performance reviews") ||
    q.includes("review completion")
  ) {
    return {
      type: "performance",
      title: "Performance reviews",
      answer: `${metrics.performance.completed} of ${metrics.performance.total} performance reviews are completed, giving a completion rate of ${metrics.performance.completionRate}%.`,
      data: metrics.performance,
    };
  }

  if (
    q.includes("summary") ||
    q.includes("overview") ||
    q.includes("workforce metrics") ||
    q.includes("workforce overview")
  ) {
    return {
      type: "summary",
      title: "Workforce overview",
      answer: `The organization has ${metrics.headcount} employees across ${metrics.departmentBreakdown.length} departments. ${metrics.activeEmployees} are active, with an attendance rate of ${metrics.attendance.attendanceRate}%.`,
      data: buildSummary(metrics),
    };
  }

  return {
    type: "help",
    title: "I need a more specific question",
    answer:
      "Try asking about headcount, active employees, departments, attendance, leave requests, or performance reviews.",
    suggestions: [
      "How many employees do we have?",
      "Which department has the most employees?",
      "What is our attendance rate?",
      "How many people are on leave?",
      "Show me the workforce breakdown.",
      "How many performance reviews are completed?",
    ],
  };
}

export async function queryWorkforceData({
  question,
  organizationId,
}) {
  if (!question || !question.trim()) {
    throw new Error(
      "Please provide a workforce question."
    );
  }

  const [
    employees,
    attendance,
    leaveRequests,
    performanceReviews,
  ] = await Promise.all([
    getEmployees(organizationId),
    getAttendance(organizationId),
    getLeaveRequests(organizationId),
    getPerformanceReviews(
      organizationId
    ),
  ]);

  const departmentBreakdown =
    calculateDepartmentBreakdown(
      employees
    );

  const metrics = {
    headcount: employees.length,

    activeEmployees:
      employees.filter(
        employeeIsActive
      ).length,

    departmentBreakdown,

    attendance:
      calculateAttendance(
        attendance
      ),

    leave:
      calculateLeave(
        leaveRequests
      ),

    performance:
      calculatePerformance(
        performanceReviews
      ),
  };

  const result = answerQuestion(
    question,
    metrics
  );

  return {
    question,
    result,
    metrics,
    generatedAt:
      new Date().toISOString(),
  };
}