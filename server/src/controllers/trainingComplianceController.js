import { supabaseAdmin } from "../config/supabase.js";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getOrganizationId(req) {
  return (
    req.user?.organization_id ||
    req.user?.organizationId ||
    req.body?.organization_id ||
    req.body?.organizationId ||
    req.query?.organization_id ||
    req.query?.organizationId ||
    null
  );
}

function getUserId(req) {
  return (
    req.user?.id ||
    req.user?.user_id ||
    req.user?.userId ||
    null
  );
}

function normalizeStatus(value) {
  if (!value) return "assigned";

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/*
|--------------------------------------------------------------------------
| GET TRAINING COMPLIANCE
|--------------------------------------------------------------------------
| GET /api/training-compliance
|
| Returns:
| - employees
| - courses
| - assignments
| - compliance summary
|--------------------------------------------------------------------------
*/

export async function getTrainingCompliance(req, res) {
  const organizationId = getOrganizationId(req);

  if (!organizationId) {
    return res.status(400).json({
      success: false,
      message: "Organization ID is required.",
    });
  }

  try {
    /*
    |--------------------------------------------------------------------------
    | Employees
    |--------------------------------------------------------------------------
    */

    const {
      data: employees,
      error: employeesError,
    } = await supabaseAdmin
      .from("employees")
      .select(`
        id,
        organization_id,
        full_name,
        email,
        department,
        title,
        employee_code,
        joining_date,
        employment_status
      `)
      .eq("organization_id", organizationId)
      .order("full_name", {
        ascending: true,
      });

    if (employeesError) {
      throw employeesError;
    }

    /*
    |--------------------------------------------------------------------------
    | Courses
    |--------------------------------------------------------------------------
    */

    const {
      data: courses,
      error: coursesError,
    } = await supabaseAdmin
      .from("learning_courses")
      .select(`
        id,
        organization_id,
        title,
        description,
        status,
        difficulty,
        estimated_duration_minutes,
        learning_objectives,
        published_at,
        created_at,
        updated_at
      `)
      .eq("organization_id", organizationId)
      .order("created_at", {
        ascending: false,
      });

    if (coursesError) {
      throw coursesError;
    }

    /*
    |--------------------------------------------------------------------------
    | Course Assignments
    |--------------------------------------------------------------------------
    */

    const {
      data: assignments,
      error: assignmentsError,
    } = await supabaseAdmin
      .from("learning_course_assignments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", {
        ascending: false,
      });

    if (assignmentsError) {
      throw assignmentsError;
    }

    /*
    |--------------------------------------------------------------------------
    | Build lookup maps
    |--------------------------------------------------------------------------
    */

    const employeeMap = new Map(
      (employees || []).map((employee) => [
        employee.id,
        employee,
      ]),
    );

    const courseMap = new Map(
      (courses || []).map((course) => [
        course.id,
        course,
      ]),
    );

    /*
    |--------------------------------------------------------------------------
    | Normalize assignment response
    |--------------------------------------------------------------------------
    */

    const normalizedAssignments = (
      assignments || []
    ).map((assignment) => {
      const employee =
        employeeMap.get(
          assignment.employee_id,
        ) || null;

      const course =
        courseMap.get(
          assignment.course_id,
        ) || null;

      return {
        ...assignment,

        employee: employee
          ? {
              id: employee.id,
              full_name: employee.full_name,
              email: employee.email,
              department: employee.department,
              title: employee.title,
              employee_code:
                employee.employee_code,
            }
          : null,

        course: course
          ? {
              id: course.id,
              title: course.title,
              description:
                course.description,
              status: course.status,
              difficulty:
                course.difficulty,
              estimated_duration_minutes:
                course.estimated_duration_minutes,
            }
          : null,
      };
    });

    /*
    |--------------------------------------------------------------------------
    | Compliance calculations
    |--------------------------------------------------------------------------
    */

    const totalEmployees =
      employees?.length || 0;

    const totalCourses =
      courses?.length || 0;

    const totalAssignments =
      normalizedAssignments.length;

    const completedAssignments =
      normalizedAssignments.filter(
        (assignment) =>
          normalizeStatus(
            assignment.status,
          ) === "completed",
      ).length;

    const inProgressAssignments =
      normalizedAssignments.filter(
        (assignment) =>
          [
            "in_progress",
            "in-progress",
            "started",
          ].includes(
            normalizeStatus(
              assignment.status,
            ),
          ),
      ).length;

    const pendingAssignments =
      normalizedAssignments.filter(
        (assignment) =>
          [
            "assigned",
            "pending",
            "not_started",
          ].includes(
            normalizeStatus(
              assignment.status,
            ),
          ),
      ).length;

    const overdueAssignments =
      normalizedAssignments.filter(
        (assignment) => {
          if (
            !assignment.due_date ||
            normalizeStatus(
              assignment.status,
            ) === "completed"
          ) {
            return false;
          }

          return (
            new Date(
              assignment.due_date,
            ) < new Date()
          );
        },
      ).length;

    const complianceRate =
      totalAssignments > 0
        ? Math.round(
            (completedAssignments /
              totalAssignments) *
              100,
          )
        : 0;

    /*
    |--------------------------------------------------------------------------
    | Employee-level compliance
    |--------------------------------------------------------------------------
    */

    const employeeCompliance =
      (employees || []).map((employee) => {
        const employeeAssignments =
          normalizedAssignments.filter(
            (assignment) =>
              assignment.employee_id ===
              employee.id,
          );

        const completed =
          employeeAssignments.filter(
            (assignment) =>
              normalizeStatus(
                assignment.status,
              ) === "completed",
          ).length;

        const overdue =
          employeeAssignments.filter(
            (assignment) => {
              if (
                !assignment.due_date ||
                normalizeStatus(
                  assignment.status,
                ) === "completed"
              ) {
                return false;
              }

              return (
                new Date(
                  assignment.due_date,
                ) < new Date()
              );
            },
          ).length;

        const assigned =
          employeeAssignments.length;

        return {
          employee: {
            id: employee.id,
            full_name:
              employee.full_name,
            email: employee.email,
            department:
              employee.department,
            title: employee.title,
            employee_code:
              employee.employee_code,
            employment_status:
              employee.employment_status,
          },

          assigned,
          completed,
          overdue,

          complianceRate:
            assigned > 0
              ? Math.round(
                  (completed /
                    assigned) *
                    100,
                )
              : 0,

          assignments:
            employeeAssignments,
        };
      });

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,

      data: {
        employees:
          employees || [],

        courses:
          courses || [],

        assignments:
          normalizedAssignments,

        employeeCompliance,

        summary: {
          totalEmployees,
          totalCourses,
          totalAssignments,
          completedAssignments,
          inProgressAssignments,
          pendingAssignments,
          overdueAssignments,
          complianceRate,
        },
      },
    });
  } catch (error) {
    console.error(
      "[Training Compliance] Failed to load data:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to load training compliance data.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| CREATE TRAINING ASSIGNMENT
|--------------------------------------------------------------------------
| POST /api/training-compliance/assignments
|--------------------------------------------------------------------------
*/

export async function createTrainingAssignment(
  req,
  res,
) {
  const organizationId =
    getOrganizationId(req);

  const userId = getUserId(req);

  if (!organizationId) {
    return res.status(400).json({
      success: false,
      message: "Organization ID is required.",
    });
  }

  try {
    const {
      employeeId,
      employee_id,
      courseId,
      course_id,
      dueDate,
      due_date,
      mandatory,
      isMandatory,
      notes,
    } = req.body || {};

    const finalEmployeeId =
      employeeId || employee_id;

    const finalCourseId =
      courseId || course_id;

    const finalDueDate =
      dueDate || due_date || null;

    const finalMandatory =
      mandatory ??
      isMandatory ??
      false;

    /*
    |--------------------------------------------------------------------------
    | Validate input
    |--------------------------------------------------------------------------
    */

    if (!finalEmployeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee is required.",
      });
    }

    if (!finalCourseId) {
      return res.status(400).json({
        success: false,
        message: "Course is required.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Verify employee belongs to organization
    |--------------------------------------------------------------------------
    */

    const {
      data: employee,
      error: employeeError,
    } = await supabaseAdmin
      .from("employees")
      .select(`
        id,
        organization_id,
        full_name,
        email,
        department,
        title
      `)
      .eq("id", finalEmployeeId)
      .eq(
        "organization_id",
        organizationId,
      )
      .maybeSingle();

    if (employeeError) {
      throw employeeError;
    }

    if (!employee) {
      return res.status(404).json({
        success: false,
        message:
          "Employee not found in this organization.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Verify course belongs to organization
    |--------------------------------------------------------------------------
    */

    const {
      data: course,
      error: courseError,
    } = await supabaseAdmin
      .from("learning_courses")
      .select(`
        id,
        organization_id,
        title,
        description,
        status,
        difficulty
      `)
      .eq("id", finalCourseId)
      .eq(
        "organization_id",
        organizationId,
      )
      .maybeSingle();

    if (courseError) {
      throw courseError;
    }

    if (!course) {
      return res.status(404).json({
        success: false,
        message:
          "Course not found in this organization.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Prevent duplicate active assignment
    |--------------------------------------------------------------------------
    */

    const {
      data: existingAssignments,
      error: existingError,
    } = await supabaseAdmin
      .from("learning_course_assignments")
      .select(`
        id,
        status,
        employee_id,
        course_id
      `)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "employee_id",
        finalEmployeeId,
      )
      .eq(
        "course_id",
        finalCourseId,
      );

    if (existingError) {
      throw existingError;
    }

    const activeDuplicate =
      (existingAssignments || []).find(
        (assignment) =>
          normalizeStatus(
            assignment.status,
          ) !== "completed",
      );

    if (activeDuplicate) {
      return res.status(409).json({
        success: false,
        message:
          "This course is already assigned to this employee.",
        assignment:
          activeDuplicate,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Build assignment payload
    |--------------------------------------------------------------------------
    */

    const assignmentPayload = {
      organization_id:
        organizationId,

      employee_id:
        finalEmployeeId,

      course_id:
        finalCourseId,

      status: "assigned",

      due_date:
        finalDueDate,

      mandatory:
        Boolean(finalMandatory),
    };

    /*
    |--------------------------------------------------------------------------
    | Optional fields
    |--------------------------------------------------------------------------
    |
    | Some versions of the table may contain notes or
    | assigned_by_user_id. We only add them when we
    | actually have a user ID / notes value.
    |--------------------------------------------------------------------------
    */

    if (userId) {
      assignmentPayload.assigned_by_user_id =
        userId;
    }

    if (
      typeof notes === "string" &&
      notes.trim()
    ) {
      assignmentPayload.notes =
        notes.trim();
    }

    /*
    |--------------------------------------------------------------------------
    | Insert
    |--------------------------------------------------------------------------
    */

    let insertedAssignment;

    let {
      data,
      error,
    } = await supabaseAdmin
      .from("learning_course_assignments")
      .insert(
        assignmentPayload,
      )
      .select("*")
      .single();

    /*
    |--------------------------------------------------------------------------
    | Compatibility fallback
    |--------------------------------------------------------------------------
    |
    | If the database does not have optional columns,
    | retry with the core columns only.
    |--------------------------------------------------------------------------
    */

    if (
      error &&
      (
        error.code === "PGRST204" ||
        error.message
          ?.toLowerCase()
          .includes(
            "assigned_by_user_id",
          ) ||
        error.message
          ?.toLowerCase()
          .includes(
            "notes",
          )
      )
    ) {
      const corePayload = {
        organization_id:
          organizationId,

        employee_id:
          finalEmployeeId,

        course_id:
          finalCourseId,

        status: "assigned",

        due_date:
          finalDueDate,

        mandatory:
          Boolean(finalMandatory),
      };

      ({
        data,
        error,
      } = await supabaseAdmin
        .from(
          "learning_course_assignments",
        )
        .insert(corePayload)
        .select("*")
        .single());
    }

    if (error) {
      throw error;
    }

    insertedAssignment = data;

    /*
    |--------------------------------------------------------------------------
    | Return complete assignment
    |--------------------------------------------------------------------------
    */

    return res.status(201).json({
      success: true,
      message:
        "Training assigned successfully.",

      assignment: {
        ...insertedAssignment,

        employee: {
          id: employee.id,
          full_name:
            employee.full_name,
          email: employee.email,
          department:
            employee.department,
          title: employee.title,
        },

        course: {
          id: course.id,
          title: course.title,
          description:
            course.description,
          status: course.status,
          difficulty:
            course.difficulty,
        },
      },
    });
  } catch (error) {
    console.error(
      "[Training Compliance] Create assignment failed:",
      error,
    );

    return res.status(
      error?.statusCode || 500,
    ).json({
      success: false,
      message:
        error?.message ||
        "Failed to create training assignment.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| DELETE TRAINING ASSIGNMENT
|--------------------------------------------------------------------------
| DELETE /api/training-compliance/assignments/:id
|--------------------------------------------------------------------------
*/

export async function deleteTrainingAssignment(
  req,
  res,
) {
  const organizationId =
    getOrganizationId(req);

  if (!organizationId) {
    return res.status(400).json({
      success: false,
      message: "Organization ID is required.",
    });
  }

  const assignmentId =
    req.params?.id;

  if (!assignmentId) {
    return res.status(400).json({
      success: false,
      message:
        "Assignment ID is required.",
    });
  }

  try {
    /*
    |--------------------------------------------------------------------------
    | Verify assignment belongs to organization
    |--------------------------------------------------------------------------
    */

    const {
      data: assignment,
      error: assignmentError,
    } = await supabaseAdmin
      .from("learning_course_assignments")
      .select("*")
      .eq("id", assignmentId)
      .eq(
        "organization_id",
        organizationId,
      )
      .maybeSingle();

    if (assignmentError) {
      throw assignmentError;
    }

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message:
          "Training assignment not found.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Delete
    |--------------------------------------------------------------------------
    */

    const {
      error: deleteError,
    } = await supabaseAdmin
      .from("learning_course_assignments")
      .delete()
      .eq("id", assignmentId)
      .eq(
        "organization_id",
        organizationId,
      );

    if (deleteError) {
      throw deleteError;
    }

    return res.status(200).json({
      success: true,
      message:
        "Training assignment removed successfully.",
      assignmentId,
    });
  } catch (error) {
    console.error(
      "[Training Compliance] Delete assignment failed:",
      error,
    );

    return res.status(
      error?.statusCode || 500,
    ).json({
      success: false,
      message:
        error?.message ||
        "Failed to delete training assignment.",
    });
  }
}