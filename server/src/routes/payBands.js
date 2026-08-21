import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

router.use(requireAuth);

async function requireOrganization(req, res, next) {
  try {
    const organization = await getOrganizationForUser(
      req.user.id,
    );

    if (!organization) {
      return res.status(403).json({
        message: "Complete organization setup first",
      });
    }

    req.organization = organization;
    next();
  } catch (error) {
    console.error(
      "Pay bands organization lookup error:",
      error,
    );

    return res.status(500).json({
      message: "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   GET ALL PAY BANDS
   GET /api/pay-bands
========================================================= */

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("pay_bands")
      .select("*")
      .eq(
        "organization_id",
        req.organization.id,
      )
      .order("job_family", {
        ascending: true,
      })
      .order("level", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Load pay bands error:",
        error,
      );

      return res.status(500).json({
        message: "Could not load pay bands",
        detail: error.message,
      });
    }

    return res.json(data || []);
  } catch (error) {
    console.error(
      "Pay bands GET error:",
      error,
    );

    return res.status(500).json({
      message: "Could not load pay bands",
    });
  }
});

/* =========================================================
   GENERATE PAY STRUCTURE
   POST /api/pay-bands/generate

   Generates recommended salary structures from the
   organization's existing employee/workforce data.

   IMPORTANT:
   Nothing is automatically saved to pay_bands.
   The frontend can review the generated recommendations
   before saving them.
========================================================= */

router.post("/generate", async (req, res) => {
  try {
    console.log(
      "[Pay Bands] Starting automatic pay structure generation...",
    );

    const organizationId =
      req.organization.id;

    /* -------------------------------------------------------
       Load employees belonging to this organization
    ------------------------------------------------------- */

    const { data: employees, error: employeesError } =
      await supabaseAdmin
        .from("employees")
        .select("*")
        .eq(
          "organization_id",
          organizationId,
        );

    if (employeesError) {
      console.error(
        "[Pay Bands] Employee lookup error:",
        employeesError,
      );

      return res.status(500).json({
        message:
          "Could not analyze workforce data",
        detail:
          employeesError.message,
      });
    }

    const workforce =
      Array.isArray(employees)
        ? employees
        : [];

    console.log(
      `[Pay Bands] Workforce records found: ${workforce.length}`,
    );

    /* -------------------------------------------------------
       If there is no workforce data, return a useful response
       instead of throwing a server error.
    ------------------------------------------------------- */

    if (workforce.length === 0) {
      return res.json({
        success: true,
        message:
          "No employee compensation data is available yet. Add employees with salary information to generate pay structures.",
        bands: [],
        recommendations: [],
        generatedBands: [],
        employeeCount: 0,
        jobFamilyCount: 0,
      });
    }

    /* -------------------------------------------------------
       Helpers
    ------------------------------------------------------- */

    const firstValue = (
      employee,
      fields,
    ) => {
      for (const field of fields) {
        const value =
          employee?.[field];

        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        ) {
          return value;
        }
      }

      return null;
    };

    const normalizeText = (
      value,
      fallback,
    ) => {
      if (
        value === undefined ||
        value === null
      ) {
        return fallback;
      }

      const text =
        String(value).trim();

      return text || fallback;
    };

    const getSalary = (
      employee,
    ) => {
      const value =
        firstValue(employee, [
          "salary",
          "annual_salary",
          "current_salary",
          "base_salary",
          "currentSalary",
          "annualSalary",
          "baseSalary",
          "compensation",
          "ctc",
          "annual_ctc",
        ]);

      if (
        value === null ||
        value === undefined
      ) {
        return null;
      }

      const numeric =
        Number(
          String(value)
            .replace(/,/g, "")
            .replace(/[₹$€£]/g, "")
            .trim(),
        );

      return Number.isFinite(numeric) &&
        numeric > 0
        ? numeric
        : null;
    };

    const getJobFamily = (
      employee,
    ) => {
      return normalizeText(
        firstValue(employee, [
          "job_family",
          "jobFamily",
          "job_family_name",
          "jobFamilyName",
          "department",
          "department_name",
          "departmentName",
          "function",
          "job_title",
          "jobTitle",
          "designation",
          "title",
        ]),
        "General",
      );
    };

    const getLevel = (
      employee,
    ) => {
      return normalizeText(
        firstValue(employee, [
          "level",
          "job_level",
          "jobLevel",
          "seniority",
          "seniority_level",
          "seniorityLevel",
          "grade",
        ]),
        "Standard",
      );
    };

    const getCurrency = (
      employee,
    ) => {
      return normalizeText(
        firstValue(employee, [
          "currency",
          "salary_currency",
          "salaryCurrency",
        ]),
        "INR",
      ).toUpperCase();
    };

    /* -------------------------------------------------------
       Convert employee records into usable compensation data
    ------------------------------------------------------- */

    const compensationRecords =
      workforce
        .map((employee) => {
          const salary =
            getSalary(employee);

          if (!salary) {
            return null;
          }

          return {
            jobFamily:
              getJobFamily(employee),
            level:
              getLevel(employee),
            currency:
              getCurrency(employee),
            salary,
          };
        })
        .filter(Boolean);

    console.log(
      `[Pay Bands] Employees with salary data: ${compensationRecords.length}`,
    );

    /* -------------------------------------------------------
       No salary information
    ------------------------------------------------------- */

    if (
      compensationRecords.length === 0
    ) {
      return res.json({
        success: true,
        message:
          "Employee records were found, but no usable salary information is available.",
        bands: [],
        recommendations: [],
        generatedBands: [],
        employeeCount:
          workforce.length,
        employeesWithSalary: 0,
        jobFamilyCount: 0,
      });
    }

    /* -------------------------------------------------------
       Group employees by job family + level
    ------------------------------------------------------- */

    const groups =
      new Map();

    for (
      const record of compensationRecords
    ) {
      const key =
        `${record.jobFamily}|||${record.level}|||${record.currency}`;

      if (!groups.has(key)) {
        groups.set(key, {
          jobFamily:
            record.jobFamily,
          level:
            record.level,
          currency:
            record.currency,
          salaries: [],
        });
      }

      groups
        .get(key)
        .salaries
        .push(record.salary);
    }

    /* -------------------------------------------------------
       Generate salary bands
    ------------------------------------------------------- */

    const generatedBands =
      [];

    for (
      const group of groups.values()
    ) {
      const salaries =
        [...group.salaries].sort(
          (a, b) => a - b,
        );

      if (!salaries.length) {
        continue;
      }

      const minSalary =
        salaries[0];

      const maxSalary =
        salaries[
          salaries.length - 1
        ];

      const sum =
        salaries.reduce(
          (
            total,
            salary,
          ) =>
            total + salary,
          0,
        );

      const average =
        sum / salaries.length;

      const middleIndex =
        Math.floor(
          salaries.length / 2,
        );

      const midpoint =
        salaries.length % 2 === 0
          ? (
              salaries[
                middleIndex - 1
              ] +
              salaries[
                middleIndex
              ]
            ) / 2
          : salaries[
              middleIndex
            ];

      /*
       * Expand the observed workforce range slightly so the
       * generated structure can accommodate future hiring
       * while still remaining anchored to actual data.
       */

      let minimum =
        Math.round(
          minSalary * 0.9,
        );

      let maximum =
        Math.round(
          maxSalary * 1.1,
        );

      let calculatedMidpoint =
        Math.round(
          midpoint,
        );

      if (
        minimum < 0
      ) {
        minimum = 0;
      }

      if (
        calculatedMidpoint <
        minimum
      ) {
        calculatedMidpoint =
          minimum;
      }

      if (
        maximum <
        calculatedMidpoint
      ) {
        maximum =
          calculatedMidpoint;
      }

      generatedBands.push({
        job_family:
          group.jobFamily,
        level:
          group.level,
        currency:
          group.currency,
        minimum,
        midpoint:
          calculatedMidpoint,
        maximum,
        status:
          "active",
        employee_count:
          salaries.length,
        average_salary:
          Math.round(
            average,
          ),
        source:
          "workforce_analysis",
      });
    }

    /* -------------------------------------------------------
       Sort generated bands
    ------------------------------------------------------- */

    generatedBands.sort(
      (a, b) => {
        const familyCompare =
          a.job_family.localeCompare(
            b.job_family,
          );

        if (
          familyCompare !== 0
        ) {
          return familyCompare;
        }

        return a.level.localeCompare(
          b.level,
        );
      },
    );

    console.log(
      `[Pay Bands] Generated ${generatedBands.length} recommended band(s).`,
    );

    /* -------------------------------------------------------
       Return recommendations

       Nothing is inserted into pay_bands here.
    ------------------------------------------------------- */

    return res.json({
      success: true,
      message:
        "Pay structure generated successfully from workforce compensation data.",
      bands:
        generatedBands,
      recommendations:
        generatedBands,
      generatedBands:
        generatedBands,
      employeeCount:
        workforce.length,
      employeesWithSalary:
        compensationRecords.length,
      jobFamilyCount:
        new Set(
          compensationRecords.map(
            (record) =>
              record.jobFamily,
          ),
        ).size,
    });
  } catch (error) {
    console.error(
      "[Pay Bands] Generate structure error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not generate pay structure",
      detail:
        error?.message ||
        "Unknown server error",
    });
  }
});

/* =========================================================
   CREATE PAY BAND
   POST /api/pay-bands
========================================================= */

router.post("/", async (req, res) => {
  try {
    const {
      job_family,
      level,
      currency,
      minimum,
      midpoint,
      maximum,
      notes,
      status,
    } = req.body;

    if (!job_family?.trim()) {
      return res.status(400).json({
        message:
          "Job family is required",
      });
    }

    if (!level?.trim()) {
      return res.status(400).json({
        message:
          "Level is required",
      });
    }

    const min =
      Number(minimum);

    const mid =
      Number(midpoint);

    const max =
      Number(maximum);

    if (
      !Number.isFinite(min) ||
      !Number.isFinite(mid) ||
      !Number.isFinite(max)
    ) {
      return res.status(400).json({
        message:
          "Minimum, midpoint and maximum must be valid numbers",
      });
    }

    if (
      min < 0 ||
      mid < min ||
      max < mid
    ) {
      return res.status(400).json({
        message:
          "Salary range must satisfy Minimum ≤ Midpoint ≤ Maximum",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("pay_bands")
      .insert({
        organization_id:
          req.organization.id,

        job_family:
          job_family.trim(),

        level:
          level.trim(),

        currency:
          currency?.trim() ||
          "INR",

        minimum: min,

        midpoint: mid,

        maximum: max,

        notes:
          notes?.trim() ||
          null,

        status:
          status ||
          "active",

        created_by:
          req.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error(
        "Create pay band error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not create pay band",
        detail:
          error.message,
      });
    }

    return res.status(201).json(
      data,
    );
  } catch (error) {
    console.error(
      "Pay band POST error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not create pay band",
    });
  }
});

/* =========================================================
   UPDATE PAY BAND
   PUT /api/pay-bands/:id
========================================================= */

router.put("/:id", async (req, res) => {
  try {
    const {
      job_family,
      level,
      currency,
      minimum,
      midpoint,
      maximum,
      notes,
      status,
    } = req.body;

    const min =
      Number(minimum);

    const mid =
      Number(midpoint);

    const max =
      Number(maximum);

    if (
      !job_family?.trim() ||
      !level?.trim()
    ) {
      return res.status(400).json({
        message:
          "Job family and level are required",
      });
    }

    if (
      !Number.isFinite(min) ||
      !Number.isFinite(mid) ||
      !Number.isFinite(max)
    ) {
      return res.status(400).json({
        message:
          "Salary values must be valid numbers",
      });
    }

    if (
      min < 0 ||
      mid < min ||
      max < mid
    ) {
      return res.status(400).json({
        message:
          "Salary range must satisfy Minimum ≤ Midpoint ≤ Maximum",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("pay_bands")
      .update({
        job_family:
          job_family.trim(),

        level:
          level.trim(),

        currency:
          currency?.trim() ||
          "INR",

        minimum: min,

        midpoint: mid,

        maximum: max,

        notes:
          notes?.trim() ||
          null,

        status:
          status ||
          "active",

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        req.params.id,
      )
      .eq(
        "organization_id",
        req.organization.id,
      )
      .select()
      .single();

    if (error) {
      console.error(
        "Update pay band error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not update pay band",
        detail:
          error.message,
      });
    }

    return res.json(
      data,
    );
  } catch (error) {
    console.error(
      "Pay band PUT error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not update pay band",
    });
  }
});

/* =========================================================
   DELETE PAY BAND
   DELETE /api/pay-bands/:id
========================================================= */

router.delete("/:id", async (req, res) => {
  try {
    const {
      error,
    } = await supabaseAdmin
      .from("pay_bands")
      .delete()
      .eq(
        "id",
        req.params.id,
      )
      .eq(
        "organization_id",
        req.organization.id,
      );

    if (error) {
      console.error(
        "Delete pay band error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not delete pay band",
        detail:
          error.message,
      });
    }

    return res.json({
      message:
        "Pay band deleted successfully",
    });
  } catch (error) {
    console.error(
      "Pay band DELETE error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not delete pay band",
    });
  }
});

export default router;