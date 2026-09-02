import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";
import { createAuditLog } from "../services/auditLogService.js";

const router = Router();

const EMPLOYMENT_STATUSES = [
  "Active",
  "On Leave",
  "Resigned",
  "Terminated",
  "Retired",
];

router.use(requireAuth);

async function requireOrganization(req, res, next) {
  try {
    const organization = await getOrganizationForUser(req.user.id);

    if (!organization) {
      return res
        .status(403)
        .json({ message: "Complete organization setup first" });
    }

    req.organization = organization;
    next();
  } catch (error) {
    console.error("Organization lookup error:", error);

    return res.status(500).json({
      message: "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

/* -------------------------------------------------------
  HELPERS
------------------------------------------------------- */

function cleanOptionalString(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned || null;
}

function cleanEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidDate(value) {
  if (!value) return true;

  const date = new Date(value);

  return !Number.isNaN(date.getTime());
}

function validateEmployeeFields({
  full_name,
  email,
  employment_status,
  joining_date,
  last_working_date,
}) {
  const errors = [];

  if (!full_name) {
    errors.push("Full name is required");
  }

  if (!email) {
    errors.push("Email is required");
  } else if (!isValidEmail(email)) {
    errors.push("Invalid email address");
  }

  if (
    employment_status &&
    !EMPLOYMENT_STATUSES.includes(employment_status)
  ) {
    errors.push(
      `Invalid employment status. Use: ${EMPLOYMENT_STATUSES.join(", ")}`
    );
  }

  if (!isValidDate(joining_date)) {
    errors.push("Invalid joining date");
  }

  if (!isValidDate(last_working_date)) {
    errors.push("Invalid last working date");
  }

  if (
    employment_status &&
    employment_status !== "Active" &&
    !last_working_date
  ) {
    errors.push(
      "Last working date is required for employees who are not Active"
    );
  }

  if (
    employment_status === "Active" &&
    last_working_date
  ) {
    errors.push(
      "Active employees should not have a last working date"
    );
  }

  return errors;
}

/* -------------------------------------------------------
  AUDIT LOG HELPER
------------------------------------------------------- */

async function auditEmployeeAction({
  req,
  action,
  employee = null,
  description,
  status = "success",
  metadata = {},
}) {
  try {
    await createAuditLog({
      organizationId: req.organization.id,
      userId: req.user.id,
      action,
      resourceType: "employee",
      resourceId: employee?.id || null,
      resourceName: employee?.full_name || null,
      description,
      status,
      req,
      metadata,
    });
  } catch (error) {
    console.error(
      "[Employees] Audit logging failed:",
      error
    );
  }
}

/* -------------------------------------------------------
  GET ALL EMPLOYEES
  GET /api/employees
------------------------------------------------------- */

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("organization_id", req.organization.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load employees error:", error);

      return res.status(500).json({
        message: "Could not load employees",
        detail: error.message,
      });
    }

    await auditEmployeeAction({
      req,
      action: "employee.list",
      description: `Viewed employee list containing ${(data || []).length} employees.`,
      metadata: {
        employee_count: (data || []).length,
      },
    });

    return res.json(data || []);
  } catch (error) {
    console.error(
      "Unexpected employee list error:",
      error
    );

    return res.status(500).json({
      message: "Could not load employees",
    });
  }
});

/* -------------------------------------------------------
  GET SINGLE EMPLOYEE
  GET /api/employees/:id
------------------------------------------------------- */

router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("id", req.params.id)
      .eq("organization_id", req.organization.id)
      .maybeSingle();

    if (error) {
      console.error("Load employee error:", error);

      return res.status(500).json({
        message: "Could not load employee",
        detail: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    await auditEmployeeAction({
      req,
      action: "employee.view",
      employee: data,
      description: `Viewed employee record for ${data.full_name}.`,
      metadata: {
        employee_code: data.employee_code || null,
      },
    });

    return res.json(data);
  } catch (error) {
    console.error(
      "Unexpected employee lookup error:",
      error
    );

    return res.status(500).json({
      message: "Could not load employee",
    });
  }
});

/* -------------------------------------------------------
  CREATE EMPLOYEE
  POST /api/employees
------------------------------------------------------- */

router.post("/", async (req, res) => {
  try {
    const {
      full_name,
      email,
      department,
      title,
      employee_code,
      joining_date,
      employment_status,
      last_working_date,
      address,
    } = req.body || {};

    const cleanName = String(full_name || "").trim();

    const cleanEmailValue = cleanEmail(email);

    const cleanDepartment =
      cleanOptionalString(department);

    const cleanTitle =
      cleanOptionalString(title);

    const cleanEmployeeCode =
      cleanOptionalString(employee_code);

    const cleanJoiningDate =
      cleanOptionalString(joining_date);

    const cleanStatus =
      cleanOptionalString(employment_status) || "Active";

    const cleanLastWorkingDate =
      cleanOptionalString(last_working_date);

    const cleanAddress =
      cleanOptionalString(address);

    const validationErrors =
      validateEmployeeFields({
        full_name: cleanName,
        email: cleanEmailValue,
        employment_status: cleanStatus,
        joining_date: cleanJoiningDate,
        last_working_date: cleanLastWorkingDate,
      });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: validationErrors.join(". "),
        errors: validationErrors,
      });
    }

    /* ---------------------------------------------------
      CHECK DUPLICATE EMAIL
    --------------------------------------------------- */

    const {
      data: existingEmail,
      error: emailLookupError,
    } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq(
        "organization_id",
        req.organization.id
      )
      .eq("email", cleanEmailValue)
      .maybeSingle();

    if (emailLookupError) {
      console.error(
        "Employee email lookup error:",
        emailLookupError
      );

      return res.status(500).json({
        message:
          "Could not check existing employee",
        detail: emailLookupError.message,
      });
    }

    if (existingEmail) {
      return res.status(409).json({
        message:
          "An employee with this email already exists",
      });
    }

    /* ---------------------------------------------------
      CHECK DUPLICATE EMPLOYEE CODE
    --------------------------------------------------- */

    if (cleanEmployeeCode) {
      const {
        data: existingCode,
        error: codeLookupError,
      } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq(
          "organization_id",
          req.organization.id
        )
        .eq(
          "employee_code",
          cleanEmployeeCode
        )
        .maybeSingle();

      if (codeLookupError) {
        console.error(
          "Employee code lookup error:",
          codeLookupError
        );

        return res.status(500).json({
          message:
            "Could not check employee code",
          detail: codeLookupError.message,
        });
      }

      if (existingCode) {
        return res.status(409).json({
          message:
            "An employee with this employee code already exists",
        });
      }
    }

    /* ---------------------------------------------------
      INSERT EMPLOYEE
    --------------------------------------------------- */

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("employees")
      .insert({
        organization_id:
          req.organization.id,
        full_name: cleanName,
        email: cleanEmailValue,
        department: cleanDepartment,
        title: cleanTitle,
        employee_code:
          cleanEmployeeCode,
        joining_date:
          cleanJoiningDate,
        employment_status:
          cleanStatus,
        last_working_date:
          cleanLastWorkingDate,
        address: cleanAddress,
      })
      .select()
      .single();

    if (error) {
      console.error(
        "Create employee error:",
        error
      );

      return res.status(500).json({
        message: "Could not create employee",
        detail: error.message,
      });
    }

    await auditEmployeeAction({
      req,
      action: "employee.create",
      employee: data,
      description:
        `Created employee ${data.full_name}.`,
      metadata: {
        employee_code:
          data.employee_code || null,
      },
    });

    return res.status(201).json(data);
  } catch (error) {
    console.error(
      "Unexpected employee creation error:",
      error
    );

    return res.status(500).json({
      message: "Could not create employee",
    });
  }
});

/* -------------------------------------------------------
  BULK IMPORT
  POST /api/employees/bulk
------------------------------------------------------- */

router.post("/bulk", async (req, res) => {
  try {
    const incomingEmployees =
      req.body?.employees;

    if (!Array.isArray(incomingEmployees)) {
      return res.status(400).json({
        message:
          "employees must be an array",
      });
    }

    if (incomingEmployees.length === 0) {
      return res.status(400).json({
        message:
          "No employees were provided",
      });
    }

    if (incomingEmployees.length > 5000) {
      return res.status(400).json({
        message:
          "A maximum of 5000 employees can be imported at once",
      });
    }

    const validEmployees = [];
    const rejected = [];

    const emailSet = new Set();
    const employeeCodeSet = new Set();

    /* ---------------------------------------------------
      VALIDATE EACH RECORD
    --------------------------------------------------- */

    incomingEmployees.forEach(
      (employee, index) => {
        const rowNumber = index + 2;

        const fullName = String(
          employee?.full_name || ""
        ).trim();

        const email = cleanEmail(
          employee?.email
        );

        const department =
          cleanOptionalString(
            employee?.department
          );

        const title =
          cleanOptionalString(
            employee?.title
          );

        const employeeCode =
          cleanOptionalString(
            employee?.employee_code
          );

        const joiningDate =
          cleanOptionalString(
            employee?.joining_date
          );

        const employmentStatus =
          cleanOptionalString(
            employee?.employment_status
          ) || "Active";

        const lastWorkingDate =
          cleanOptionalString(
            employee?.last_working_date
          );

        const address =
          cleanOptionalString(
            employee?.address
          );

        const errors =
          validateEmployeeFields({
            full_name: fullName,
            email,
            employment_status:
              employmentStatus,
            joining_date:
              joiningDate,
            last_working_date:
              lastWorkingDate,
          });

        /* Duplicate email inside CSV */

        if (
          email &&
          emailSet.has(email)
        ) {
          errors.push(
            "Duplicate email in uploaded file"
          );
        }

        if (email) {
          emailSet.add(email);
        }

        /* Duplicate employee code inside CSV */

        const normalizedEmployeeCode =
          employeeCode?.toLowerCase();

        if (
          normalizedEmployeeCode &&
          employeeCodeSet.has(
            normalizedEmployeeCode
          )
        ) {
          errors.push(
            "Duplicate employee code in uploaded file"
          );
        }

        if (normalizedEmployeeCode) {
          employeeCodeSet.add(
            normalizedEmployeeCode
          );
        }

        if (errors.length > 0) {
          rejected.push({
            row: rowNumber,
            full_name: fullName,
            email,
            errors,
          });

          return;
        }

        validEmployees.push({
          organization_id:
            req.organization.id,
          full_name: fullName,
          email,
          department,
          title,
          employee_code:
            employeeCode,
          joining_date:
            joiningDate,
          employment_status:
            employmentStatus,
          last_working_date:
            lastWorkingDate,
          address,
        });
      }
    );

    /* ---------------------------------------------------
      CHECK EXISTING EMAILS / CODES
    --------------------------------------------------- */

    if (validEmployees.length > 0) {
      const emails =
        validEmployees.map(
          (employee) =>
            employee.email
        );

      const employeeCodes =
        validEmployees
          .map(
            (employee) =>
              employee.employee_code
          )
          .filter(Boolean);

      /* Existing emails */

      const {
        data: existingEmployees,
        error: existingEmailError,
      } = await supabaseAdmin
        .from("employees")
        .select("id,email")
        .eq(
          "organization_id",
          req.organization.id
        )
        .in("email", emails);

      if (existingEmailError) {
        console.error(
          "Existing employee lookup error:",
          existingEmailError
        );

        return res.status(500).json({
          message:
            "Could not check existing employees",
          detail:
            existingEmailError.message,
        });
      }

      const existingEmails =
        new Set(
          (existingEmployees || []).map(
            (employee) =>
              String(employee.email)
                .trim()
                .toLowerCase()
          )
        );

      /* Existing employee codes */

      let existingCodes = new Set();

      if (employeeCodes.length > 0) {
        const {
          data: existingCodeEmployees,
          error: existingCodeError,
        } = await supabaseAdmin
          .from("employees")
          .select(
            "id,employee_code"
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .in(
            "employee_code",
            employeeCodes
          );

        if (existingCodeError) {
          console.error(
            "Existing employee code lookup error:",
            existingCodeError
          );

          return res.status(500).json({
            message:
              "Could not check existing employee codes",
            detail:
              existingCodeError.message,
          });
        }

        existingCodes =
          new Set(
            (existingCodeEmployees || [])
              .map(
                (employee) =>
                  String(
                    employee.employee_code
                  )
                    .trim()
                    .toLowerCase()
              )
          );
      }

      const newEmployees = [];

      validEmployees.forEach(
        (employee) => {
          const employeeCodeKey =
            employee.employee_code
              ?.trim()
              .toLowerCase();

          const errors = [];

          if (
            existingEmails.has(
              employee.email
            )
          ) {
            errors.push(
              "Employee with this email already exists"
            );
          }

          if (
            employeeCodeKey &&
            existingCodes.has(
              employeeCodeKey
            )
          ) {
            errors.push(
              "Employee with this employee code already exists"
            );
          }

          if (errors.length > 0) {
            rejected.push({
              row: null,
              full_name:
                employee.full_name,
              email: employee.email,
              errors,
            });
          } else {
            newEmployees.push(
              employee
            );
          }
        }
      );

      validEmployees.length = 0;

      validEmployees.push(
        ...newEmployees
      );
    }

    /* ---------------------------------------------------
      NOTHING TO IMPORT
    --------------------------------------------------- */

    if (validEmployees.length === 0) {
      return res.status(200).json({
        message:
          "No employees were imported",
        imported: 0,
        rejected:
          rejected.length,
        employees: [],
        rejectedRecords:
          rejected,
      });
    }

    /* ---------------------------------------------------
      INSERT IN CHUNKS
    --------------------------------------------------- */

    const chunkSize = 500;
    const importedEmployees = [];

    for (
      let i = 0;
      i < validEmployees.length;
      i += chunkSize
    ) {
      const chunk =
        validEmployees.slice(
          i,
          i + chunkSize
        );

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("employees")
        .insert(chunk)
        .select();

      if (error) {
        console.error(
          "Bulk employee insert error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not import employees",
          detail: error.message,
          imported:
            importedEmployees.length,
          rejected:
            rejected.length,
        });
      }

      if (data) {
        importedEmployees.push(
          ...data
        );
      }
    }

    await auditEmployeeAction({
      req,
      action:
        "employee.bulk_import",
      description:
        `Bulk imported ${importedEmployees.length} employees.`,
      metadata: {
        imported:
          importedEmployees.length,
        rejected:
          rejected.length,
      },
    });

    return res.status(201).json({
      message:
        "Employee import completed",
      imported:
        importedEmployees.length,
      rejected:
        rejected.length,
      employees:
        importedEmployees,
      rejectedRecords:
        rejected,
    });
  } catch (error) {
    console.error(
      "Unexpected bulk employee import error:",
      error
    );

    return res.status(500).json({
      message:
        "Could not import employees",
    });
  }
});

/* -------------------------------------------------------
  UPDATE EMPLOYEE
  PUT /api/employees/:id
------------------------------------------------------- */

router.put("/:id", async (req, res) => {
  try {
    const {
      full_name,
      email,
      department,
      title,
      employee_code,
      joining_date,
      employment_status,
      last_working_date,
      address,
    } = req.body || {};

    const cleanName =
      String(full_name || "").trim();

    const cleanEmailValue =
      cleanEmail(email);

    const cleanDepartment =
      cleanOptionalString(
        department
      );

    const cleanTitle =
      cleanOptionalString(
        title
      );

    const cleanEmployeeCode =
      cleanOptionalString(
        employee_code
      );

    const cleanJoiningDate =
      cleanOptionalString(
        joining_date
      );

    const cleanStatus =
      cleanOptionalString(
        employment_status
      ) || "Active";

    const cleanLastWorkingDate =
      cleanOptionalString(
        last_working_date
      );

    const cleanAddress =
      cleanOptionalString(
        address
      );

    const validationErrors =
      validateEmployeeFields({
        full_name:
          cleanName,
        email:
          cleanEmailValue,
        employment_status:
          cleanStatus,
        joining_date:
          cleanJoiningDate,
        last_working_date:
          cleanLastWorkingDate,
      });

    if (
      validationErrors.length > 0
    ) {
      return res.status(400).json({
        message:
          validationErrors.join(
            ". "
          ),
        errors:
          validationErrors,
      });
    }

    /* ---------------------------------------------------
      CHECK DUPLICATE EMAIL
    --------------------------------------------------- */

    const {
      data: existingEmail,
      error: emailLookupError,
    } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq(
        "organization_id",
        req.organization.id
      )
      .eq(
        "email",
        cleanEmailValue
      )
      .neq(
        "id",
        req.params.id
      )
      .maybeSingle();

    if (
      emailLookupError
    ) {
      console.error(
        "Employee email lookup error:",
        emailLookupError
      );

      return res.status(500).json({
        message:
          "Could not check existing employee",
        detail:
          emailLookupError.message,
      });
    }

    if (existingEmail) {
      return res.status(409).json({
        message:
          "Another employee already uses this email",
      });
    }

    /* ---------------------------------------------------
      CHECK DUPLICATE EMPLOYEE CODE
    --------------------------------------------------- */

    if (
      cleanEmployeeCode
    ) {
      const {
        data: existingCode,
        error: codeLookupError,
      } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq(
          "organization_id",
          req.organization.id
        )
        .eq(
          "employee_code",
          cleanEmployeeCode
        )
        .neq(
          "id",
          req.params.id
        )
        .maybeSingle();

      if (
        codeLookupError
      ) {
        console.error(
          "Employee code lookup error:",
          codeLookupError
        );

        return res.status(500).json({
          message:
            "Could not check employee code",
          detail:
            codeLookupError.message,
        });
      }

      if (existingCode) {
        return res.status(409).json({
          message:
            "Another employee already uses this employee code",
        });
      }
    }

    /* ---------------------------------------------------
      UPDATE
    --------------------------------------------------- */

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("employees")
      .update({
        full_name:
          cleanName,
        email:
          cleanEmailValue,
        department:
          cleanDepartment,
        title:
          cleanTitle,
        employee_code:
          cleanEmployeeCode,
        joining_date:
          cleanJoiningDate,
        employment_status:
          cleanStatus,
        last_working_date:
          cleanLastWorkingDate,
        address:
          cleanAddress,
      })
      .eq(
        "id",
        req.params.id
      )
      .eq(
        "organization_id",
        req.organization.id
      )
      .select()
      .maybeSingle();

    if (error) {
      console.error(
        "Update employee error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not update employee",
        detail:
          error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message:
          "Employee not found",
      });
    }

    await auditEmployeeAction({
      req,
      action:
        "employee.update",
      employee:
        data,
      description:
        `Updated employee ${data.full_name}.`,
      metadata: {
        employee_code:
          data.employee_code ||
          null,
      },
    });

    return res.json(data);
  } catch (error) {
    console.error(
      "Unexpected employee update error:",
      error
    );

    return res.status(500).json({
      message:
        "Could not update employee",
    });
  }
});

/* -------------------------------------------------------
  DELETE EMPLOYEE
  DELETE /api/employees/:id
------------------------------------------------------- */

router.delete("/:id", async (req, res) => {
  try {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("employees")
      .delete()
      .eq(
        "id",
        req.params.id
      )
      .eq(
        "organization_id",
        req.organization.id
      )
      .select()
      .maybeSingle();

    if (error) {
      console.error(
        "Delete employee error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not delete employee",
        detail:
          error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message:
          "Employee not found",
      });
    }

    await auditEmployeeAction({
      req,
      action:
        "employee.delete",
      employee:
        data,
      description:
        `Deleted employee ${data.full_name}.`,
      metadata: {
        employee_code:
          data.employee_code ||
          null,
      },
    });

    return res.json({
      message:
        "Employee deleted successfully",
      employee:
        data,
    });
  } catch (error) {
    console.error(
      "Unexpected employee deletion error:",
      error
    );

    return res.status(500).json({
      message:
        "Could not delete employee",
    });
  }
});

export default router;