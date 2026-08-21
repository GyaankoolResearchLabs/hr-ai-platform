import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";
import { sendGeneratedDocumentEmail } from "../services/emailService.js";
import multer from "multer";
const router = Router();

router.use(requireAuth);
/* =========================================================
   EMPLOYEE DOCUMENT UPLOAD

   Files are received in memory and then uploaded
   directly to Supabase Storage.
========================================================= */

const employeeDocumentUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error(
          "Only JPG, PNG, WEBP and PDF files are allowed."
        )
      );
    }

    callback(null, true);
  },
});
/* =========================================================
   ORGANIZATION GUARD
========================================================= */

async function requireOrganization(
  req,
  res,
  next
) {
  try {
    const organization =
      await getOrganizationForUser(
        req.user.id
      );

    if (!organization) {
      return res.status(403).json({
        message:
          "Complete organization setup first",
      });
    }

    req.organization =
      organization;

    next();
  } catch (error) {
    console.error(
      "Organization lookup error:",
      error
    );

    return res.status(500).json({
      message:
        "Could not determine organization",
    });
  }
}

router.use(
  requireOrganization
);

/* =========================================================
   CONSTANTS
========================================================= */

const DOCUMENT_TYPES = {
  OFFER_LETTER:
    "offer_letter",

  EXPERIENCE_LETTER:
    "experience_letter",

  EMPLOYMENT_VERIFICATION:
    "employment_verification",

  ADDRESS_PROOF:
    "address_proof",
};

const VALID_DOCUMENT_TYPES =
  Object.values(
    DOCUMENT_TYPES
  );

/* =========================================================
   HELPERS
========================================================= */

function isValidDocumentType(
  type
) {
  return VALID_DOCUMENT_TYPES.includes(
    type
  );
}

function formatDate(
  dateValue
) {
  if (!dateValue) {
    return "";
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
}

function formatDateTime(
  dateValue
) {
  if (!dateValue) {
    return "";
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function calculateEmploymentDuration(
  joiningDate,
  lastWorkingDate
) {
  if (!joiningDate) {
    return "";
  }

  const start =
    new Date(joiningDate);

  if (
    Number.isNaN(
      start.getTime()
    )
  ) {
    return "";
  }

  const end = lastWorkingDate
    ? new Date(lastWorkingDate)
    : new Date();

  if (
    Number.isNaN(
      end.getTime()
    )
  ) {
    return "";
  }

  let years =
    end.getFullYear() -
    start.getFullYear();

  let months =
    end.getMonth() -
    start.getMonth();

  let days =
    end.getDate() -
    start.getDate();

  if (days < 0) {
    months -= 1;

    const previousMonth =
      new Date(
        end.getFullYear(),
        end.getMonth(),
        0
      );

    days +=
      previousMonth.getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [];

  if (years > 0) {
    parts.push(
      `${years} ${
        years === 1
          ? "year"
          : "years"
      }`
    );
  }

  if (months > 0) {
    parts.push(
      `${months} ${
        months === 1
          ? "month"
          : "months"
      }`
    );
  }

  if (days > 0) {
    parts.push(
      `${days} ${
        days === 1
          ? "day"
          : "days"
      }`
    );
  }

  return (
    parts.join(", ") ||
    "Less than a day"
  );
}

/* =========================================================
   EMPLOYEE DOCUMENT CONSTANTS

   These are separate from generated documents.

   Generated documents:
   - offer letters
   - experience letters
   - employment verification
   - address proof

   Employee documents:
   - Aadhaar
   - PAN
   - Passport
   - Bank Proof
   - Address Proof
   - etc.
========================================================= */

const EMPLOYEE_DOCUMENT_TYPES = [
  "aadhaar",
  "pan",
  "passport",
  "bank_proof",
  "address_proof",
  "offer_letter",
  "experience_letter",
  "employment_verification",
  "education_certificate",
  "experience_certificate",
  "joining_document",
  "other",
];

const EMPLOYEE_DOCUMENT_STATUSES = [
  "active",
  "expired",
  "replaced",
  "pending",
];

const EMPLOYEE_DOCUMENT_VERIFICATION_STATUSES = [
  "pending",
  "verified",
  "rejected",
];

/* =========================================================
   EMPLOYEE DOCUMENT HELPERS

   IMPORTANT:

   The database still has:

       document_name TEXT NOT NULL

   The user should NOT have to enter a document name.

   We generate it automatically from document_type.
========================================================= */

function getEmployeeDocumentName(
  documentType
) {
  const labels = {
    aadhaar: "Aadhaar",

    pan: "PAN",

    passport: "Passport",

    bank_proof:
      "Bank Proof",

    address_proof:
      "Address Proof",

    offer_letter:
      "Offer Letter",

    experience_letter:
      "Experience Letter",

    employment_verification:
      "Employment Verification",

    education_certificate:
      "Education Certificate",

    experience_certificate:
      "Experience Certificate",

    joining_document:
      "Joining Document",

    other: "Other",
  };

  if (
    labels[documentType]
  ) {
    return labels[
      documentType
    ];
  }

  return String(
    documentType || "Other"
  )
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase()
    );
}

function normalizeDocumentNumber(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalized =
    String(value).trim();

  return normalized || null;
}

function getDocumentNumberLast4(
  value
) {
  if (!value) {
    return null;
  }

  const normalized =
    String(value).replace(
      /[\s-]/g,
      ""
    );

  if (!normalized) {
    return null;
  }

  return normalized.slice(
    -4
  );
}
/* =========================================================
   TEMPLATE PAYLOAD NORMALIZER
========================================================= */

function normalizeTemplatePayload(
  body = {}
) {
  return {
    document_type:
      body.document_type,

    template_name:
      typeof body.template_name ===
      "string"
        ? body.template_name.trim()
        : "",

    description:
      typeof body.description ===
      "string"
        ? body.description.trim()
        : null,

    content:
      typeof body.content ===
      "string"
        ? body.content
        : "",

    styling:
      body.styling &&
      typeof body.styling ===
        "object" &&
      !Array.isArray(
        body.styling
      )
        ? body.styling
        : {},

    logo_url:
      typeof body.logo_url ===
        "string" &&
      body.logo_url.trim()
        ? body.logo_url.trim()
        : null,

    signature_url:
      typeof body.signature_url ===
        "string" &&
      body.signature_url.trim()
        ? body.signature_url.trim()
        : null,

    signatory_name:
      typeof body.signatory_name ===
        "string" &&
      body.signatory_name.trim()
        ? body.signatory_name.trim()
        : null,

    signatory_designation:
      typeof body.signatory_designation ===
        "string" &&
      body.signatory_designation.trim()
        ? body.signatory_designation.trim()
        : null,

    status:
      body.status === "draft" ||
      body.status === "archived"
        ? body.status
        : "active",

    is_default:
      Boolean(body.is_default),
  };
}

/* =========================================================
   DOCUMENT DATA
========================================================= */

function buildEmployeeVariables(
  employee,
  organization
) {
  const employeeName =
    employee.full_name || "";

  const employeeCode =
    employee.employee_code || "";

  const employeeEmail =
    employee.email || "";

  const department =
    employee.department || "";

  const title =
    employee.title || "";

  const joiningDate =
    formatDate(
      employee.joining_date
    );

  const lastWorkingDate =
    formatDate(
      employee.last_working_date
    );

  const address =
    employee.address || "";

  const employmentStatus =
    employee.employment_status ||
    "Active";

  const employmentDuration =
    calculateEmploymentDuration(
      employee.joining_date,
      employee.last_working_date
    );

  const organizationName =
    organization.name ||
    "Organization";

  const organizationIndustry =
    organization.industry || "";

  const letterDate =
    formatDate(new Date());

  return {
    /* Current frontend placeholders */

    employee_name:
      employeeName,

    employee_code:
      employeeCode,

    employee_email:
      employeeEmail,

    department,

    job_title:
      title,

    joining_date:
      joiningDate,

    last_working_date:
      lastWorkingDate,

    employment_status:
      employmentStatus,

    employment_duration:
      employmentDuration,

    employee_address:
      address,

    organization_name:
      organizationName,

    organization_industry:
      organizationIndustry,

    letter_date:
      letterDate,

    /* Additional aliases */

    full_name:
      employeeName,

    email:
      employeeEmail,

    title,

    address,

    current_date:
      letterDate,

    joining_date_formatted:
      joiningDate,

    last_working_date_formatted:
      lastWorkingDate,
  };
}

/* =========================================================
   TEMPLATE PLACEHOLDER RENDERER
========================================================= */

function renderTemplateContent(
  content,
  variables,
  signatoryName,
  signatoryDesignation
) {
  if (
    typeof content !==
    "string"
  ) {
    return "";
  }

  const values = {
    ...variables,

    signatory_name:
      signatoryName || "",

    signatory_designation:
      signatoryDesignation || "",
  };

  return content.replace(
    /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
    (match, key) => {
      if (
        Object.prototype.hasOwnProperty.call(
          values,
          key
        )
      ) {
        return (
          values[key] ?? ""
        );
      }

      return match;
    }
  );
}

/* =========================================================
   SYSTEM DOCUMENT CONTENT
========================================================= */

function buildSystemDocumentContent(
  documentType,
  employee,
  organization
) {
  const letterDate =
    formatDate(new Date());

  const variables =
    buildEmployeeVariables(
      employee,
      organization
    );

  const {
    employee_name,
    employee_code,
    employee_email,
    department,
    job_title,
    joining_date,
    last_working_date,
    employment_status,
    employment_duration,
    employee_address,
    organization_name,
    letter_date,
  } = variables;

  switch (
    documentType
  ) {
    /* =====================================================
       OFFER LETTER
    ===================================================== */

    case DOCUMENT_TYPES.OFFER_LETTER:
      return {
        title:
          "Offer Letter",

        subject:
          `Offer of Employment – ${
            job_title ||
            "Employee"
          }`,

        greeting:
          `Dear ${employee_name},`,

        introduction:
          `We are pleased to offer you the position of ${
            job_title ||
            "Employee"
          } in the ${
            department ||
            "organization"
          } department at ${organization_name}.`,

        joining_statement:
          joining_date
            ? `Your proposed date of joining will be ${joining_date}.`
            : "Your proposed date of joining will be communicated separately.",

        employee_identification:
          employee_code
            ? `Your employee identification number is ${employee_code}.`
            : "",

        responsibilities:
          "You will be expected to perform the responsibilities associated with your position and comply with the organization's policies, procedures, and code of conduct.",

        closing:
          `We look forward to welcoming you to ${organization_name} and wish you success in your role.`,

        recipient_name:
          employee_name,

        recipient_address:
          employee_address,

        date:
          letterDate,

        signatory_name:
          null,

        signatory_designation:
          null,
      };

    /* =====================================================
       EXPERIENCE LETTER
    ===================================================== */

    case DOCUMENT_TYPES.EXPERIENCE_LETTER:
      return {
        title:
          "Experience Letter",

        subject:
          `Experience Letter – ${employee_name}`,

        greeting:
          `Dear ${employee_name},`,

        recipient_name:
          employee_name,

        recipient_address:
          employee_address,

        date:
          letterDate,

        employment_period:
          joining_date &&
          last_working_date
            ? `Your period of employment was from ${joining_date} to ${last_working_date}.`
            : joining_date
              ? `You joined ${organization_name} on ${joining_date}.`
              : "Your employment period is recorded in the organization's employment records.",

        duration:
          employment_duration
            ? `Your total employment duration was ${employment_duration}.`
            : "",

        verification_statement:
          `This is to certify that ${employee_name} was associated with ${organization_name}.`,

        position_statement:
          `During the period of employment, ${employee_name} worked as ${
            job_title ||
            "an employee"
          }${
            department
              ? ` in the ${department} department`
              : ""
          }.`,

        employee_statement:
          `Employee Code: ${
            employee_code ||
            "Not available"
          }`,

        closing:
          `We appreciate the contributions made during the tenure and wish ${employee_name} success in future endeavors.`,

        signatory_name:
          null,

        signatory_designation:
          null,
      };

    /* =====================================================
       EMPLOYMENT VERIFICATION
    ===================================================== */

    case DOCUMENT_TYPES.EMPLOYMENT_VERIFICATION:
      return {
        title:
          "Employment Verification Letter",

        subject:
          `Employment Verification – ${employee_name}`,

        greeting:
          "To Whom It May Concern,",

        recipient_name:
          employee_name,

        recipient_address:
          "",

        date:
          letterDate,

        verification_statement:
          `This letter confirms that ${employee_name} is/was employed by ${organization_name}.`,

        position_statement:
          `Position: ${
            job_title ||
            "Not available"
          }`,

        employee_statement:
          employee_code
            ? `Employee Code: ${employee_code}`
            : "",

        employment_statement:
          employee_email
            ? `Employee Email: ${employee_email}`
            : "",

        employment_status_statement:
          `Employment Status: ${employment_status}`,

        joining_statement:
          joining_date
            ? `Date of Joining: ${joining_date}`
            : "",

        last_working_statement:
          last_working_date
            ? `Last Working Date: ${last_working_date}`
            : "",

        closing:
          "This verification is issued based on the employment records maintained by the organization.",

        signatory_name:
          null,

        signatory_designation:
          null,
      };

    /* =====================================================
       ADDRESS PROOF
    ===================================================== */

    case DOCUMENT_TYPES.ADDRESS_PROOF:
      return {
        title:
          "Employee Address Proof",

        subject:
          `Address Proof – ${employee_name}`,

        greeting:
          "To Whom It May Concern,",

        recipient_name:
          employee_name,

        recipient_address:
          "",

        date:
          letterDate,

        address_statement:
          employee_address
            ? `This is to certify that the following address is recorded in the organization's HR records:\n\n${employee_address}`
            : "No employee address is currently available in the organization's HR records.",

        employee_identification:
          employee_code
            ? `Employee Code: ${employee_code}`
            : "",

        position_statement:
          `Designation: ${
            job_title ||
            "Not available"
          }${
            department
              ? `\nDepartment: ${department}`
              : ""
          }`,

        employment_status_statement:
          `Employment Status: ${employment_status}`,

        verification_statement:
          `This document has been generated based on the information available in the employee records maintained by ${organization_name}.`,

        closing:
          "This document is issued at the request of the employee for official address verification purposes.",

        signatory_name:
          null,

        signatory_designation:
          null,
      };

    default:
      return null;
  }
}
/* =========================================================
   GET EMPLOYEE FOR DOCUMENT GENERATION
========================================================= */

router.get(
  "/employee/:employeeId",
  async (req, res) => {
    try {
      const {
        data: employee,
        error,
      } =
        await supabaseAdmin
          .from("employees")
          .select("*")
          .eq(
            "id",
            req.params.employeeId
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (error) {
        console.error(
          "Employee lookup error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load employee",
          detail:
            error.message,
        });
      }

      if (!employee) {
        return res.status(404).json({
          message:
            "Employee not found",
        });
      }

      return res.status(200).json(
        employee
      );
    } catch (error) {
      console.error(
        "Unexpected employee lookup error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load employee",
        detail:
          error?.message || null,
      });
    }
  }
);

/* =========================================================
   GENERATE DOCUMENT
========================================================= */
/* =========================================================
   CREATE EMPLOYEE DOCUMENT

   POST /api/documents/employee

   Supports:
   - document number
   - photo/PDF upload
   - expiry date
   - HR notes

   File is stored in:
   Supabase Storage
   → employee-documents bucket
========================================================= */

router.post(
  "/employee",
  employeeDocumentUpload.single("photo"),
  async (req, res) => {
    try {
      const {
        employee_id,
        document_type,
        document_number,
        status = "active",
        expiry_date = null,
        notes = null,
      } = req.body || {};

      /* -----------------------------------------------------
         VALIDATION
      ----------------------------------------------------- */

      if (!employee_id) {
        return res.status(400).json({
          message:
            "employee_id is required",
        });
      }

      if (!document_type) {
        return res.status(400).json({
          message:
            "document_type is required",
        });
      }

      if (
        !EMPLOYEE_DOCUMENT_TYPES.includes(
          document_type
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid employee document type",

          allowed_types:
            EMPLOYEE_DOCUMENT_TYPES,
        });
      }

      if (
        !EMPLOYEE_DOCUMENT_STATUSES.includes(
          status
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid document status",

          allowed_statuses:
            EMPLOYEE_DOCUMENT_STATUSES,
        });
      }

      if (!document_number?.trim()) {
        return res.status(400).json({
          message:
            `${getEmployeeDocumentName(
              document_type
            )} number is required.`,
        });
      }

      /* -----------------------------------------------------
         VERIFY EMPLOYEE
      ----------------------------------------------------- */

      const {
        data: employee,
        error: employeeError,
      } =
        await supabaseAdmin
          .from("employees")
          .select(
            "id, full_name, email, department"
          )
          .eq(
            "id",
            employee_id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (employeeError) {
        console.error(
          "Employee document employee verification error:",
          employeeError
        );

        return res.status(500).json({
          message:
            "Could not verify employee",

          detail:
            employeeError.message,
        });
      }

      if (!employee) {
        return res.status(404).json({
          message:
            "Employee not found",
        });
      }

      /* -----------------------------------------------------
         DOCUMENT NUMBER
      ----------------------------------------------------- */

      const normalizedDocumentNumber =
        normalizeDocumentNumber(
          document_number
        );

      /* -----------------------------------------------------
         FILE VARIABLES
      ----------------------------------------------------- */

      let fileUrl = null;
      let filePath = null;
      let fileName = null;
      let mimeType = null;
      let fileSize = null;

      /* -----------------------------------------------------
         UPLOAD FILE TO SUPABASE STORAGE
      ----------------------------------------------------- */

      if (req.file) {
        const file =
          req.file;

        fileName =
          file.originalname;

        mimeType =
          file.mimetype;

        fileSize =
          file.size;

        const extension =
          file.originalname
            .split(".")
            .pop()
            ?.toLowerCase() ||
          "bin";

        const safeEmployeeId =
          String(
            employee_id
          );

        const timestamp =
          Date.now();

        const storageFileName =
          `${timestamp}-${Math.random()
            .toString(36)
            .slice(2, 10)}.${extension}`;

        filePath =
          `${req.organization.id}/${safeEmployeeId}/${document_type}/${storageFileName}`;

        const {
          error:
            uploadError,
        } =
          await supabaseAdmin
            .storage
            .from(
              "employee-documents"
            )
            .upload(
              filePath,
              file.buffer,
              {
                contentType:
                  mimeType,

                upsert:
                  false,
              }
            );

        if (uploadError) {
          console.error(
            "Employee document storage upload error:",
            uploadError
          );

          return res.status(500).json({
            message:
              "Could not upload employee document",

            detail:
              uploadError.message,
          });
        }

        /*
         * The bucket is private.
         *
         * We intentionally do NOT save a permanent
         * public URL.
         *
         * file_path is enough to generate a secure
         * signed URL whenever HR wants to view it.
         */

        fileUrl = null;
      }

      /* -----------------------------------------------------
         CREATE DATABASE RECORD
      ----------------------------------------------------- */

      const record = {
        organization_id:
          req.organization.id,

        employee_id:
          employee_id,

        document_type:
          document_type,

        document_name:
          getEmployeeDocumentName(
            document_type
          ),

        document_number:
          normalizedDocumentNumber,

        document_number_last4:
          getDocumentNumberLast4(
            normalizedDocumentNumber
          ),

        file_url:
          fileUrl,

        file_path:
          filePath,

        file_name:
          fileName,

        mime_type:
          mimeType,

        file_size:
          fileSize,

        status:
          status,

        expiry_date:
          expiry_date || null,

        notes:
          notes || null,

        verification_status:
          "pending",
      };

      /* -----------------------------------------------------
         INSERT DATABASE RECORD
      ----------------------------------------------------- */

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "employee_documents"
          )
          .insert(record)
          .select("*")
          .single();

      if (error) {
        console.error(
          "Employee document create error:",
          error
        );

        /*
         * If DB insert fails after storage upload,
         * remove the uploaded file so we don't leave
         * orphaned files.
         */

        if (filePath) {
          await supabaseAdmin
            .storage
            .from(
              "employee-documents"
            )
            .remove([
              filePath,
            ])
            .catch(
              () => {}
            );
        }

        return res.status(500).json({
          message:
            "Could not create employee document",

          detail:
            error.message,

          code:
            error.code ||
            null,
        });
      }

      /* -----------------------------------------------------
         SUCCESS
      ----------------------------------------------------- */

      return res.status(201).json(
        data
      );
    } catch (error) {
      console.error(
        "Unexpected employee document create error:",
        error
      );

      return res.status(500).json({
        message:
          error?.message ||
          "Could not create employee document",
      });
    }
  }
);

/* =========================================================
   GET DOCUMENT TEMPLATES
========================================================= */

router.get(
  "/templates",
  async (req, res) => {
    try {
      const {
        document_type,
        status,
      } = req.query;

      let query =
        supabaseAdmin
          .from(
            "document_templates"
          )
          .select("*")
          .eq(
            "organization_id",
            req.organization.id
          );

      if (document_type) {
        query = query.eq(
          "document_type",
          document_type
        );
      }

      if (status) {
        query = query.eq(
          "status",
          status
        );
      }

      query = query.order(
        "created_at",
        {
          ascending: false,
        }
      );

      const {
        data,
        error,
      } = await query;

      if (error) {
        console.error(
          "Document templates lookup error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load document templates",
          detail:
            error.message,
        });
      }

      return res.status(200).json(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(
        "Unexpected document templates lookup error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load document templates",
        detail:
          error?.message || null,
      });
    }
  }
);

/* =========================================================
   GET ONE DOCUMENT TEMPLATE
========================================================= */

router.get(
  "/templates/:id",
  async (req, res) => {
    try {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "document_templates"
          )
          .select("*")
          .eq(
            "id",
            req.params.id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (error) {
        console.error(
          "Document template lookup error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load document template",
          detail:
            error.message,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Document template not found",
        });
      }

      return res.status(200).json(
        data
      );
    } catch (error) {
      console.error(
        "Unexpected document template lookup error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load document template",
        detail:
          error?.message || null,
      });
    }
  }
);
/* =========================================================
   EMPLOYEE DOCUMENTS
========================================================= */

/* =========================================================
   GET EMPLOYEE DOCUMENTS

   GET /api/documents/employee

   Optional query parameters:

   ?employee_id=...
   ?document_type=...
   ?status=...
========================================================= */

router.get(
  "/employee",
  async (req, res) => {
    try {
      const {
        employee_id,
        document_type,
        status,
      } = req.query;

      let query =
        supabaseAdmin
          .from(
            "employee_documents"
          )
          .select("*")
          .eq(
            "organization_id",
            req.organization.id
          );

      /* -----------------------------------------------------
         FILTER BY EMPLOYEE
      ----------------------------------------------------- */

      if (employee_id) {
        query = query.eq(
          "employee_id",
          employee_id
        );
      }

      /* -----------------------------------------------------
         FILTER BY DOCUMENT TYPE
      ----------------------------------------------------- */

      if (document_type) {
        query = query.eq(
          "document_type",
          document_type
        );
      }

      /* -----------------------------------------------------
         FILTER BY STATUS
      ----------------------------------------------------- */

      if (status) {
        query = query.eq(
          "status",
          status
        );
      }

      /* -----------------------------------------------------
         NEWEST DOCUMENTS FIRST
      ----------------------------------------------------- */

      query = query.order(
        "created_at",
        {
          ascending: false,
        }
      );

      const {
        data,
        error,
      } = await query;

      if (error) {
        console.error(
          "Employee documents lookup error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load employee documents",

          detail:
            error.message,
        });
      }

      return res.status(200).json(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(
        "Unexpected employee documents lookup error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load employee documents",

        detail:
          error?.message ||
          null,
      });
    }
  }
);

/* =========================================================
   GET ONE EMPLOYEE DOCUMENT

   GET /api/documents/employee/:id
========================================================= */

router.get(
  "/employee/:id",
  async (req, res) => {
    try {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "employee_documents"
          )
          .select("*")
          .eq(
            "id",
            req.params.id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      /* -----------------------------------------------------
         DATABASE ERROR
      ----------------------------------------------------- */

      if (error) {
        console.error(
          "Employee document lookup error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load employee document",

          detail:
            error.message,
        });
      }

      /* -----------------------------------------------------
         DOCUMENT NOT FOUND
      ----------------------------------------------------- */

      if (!data) {
        return res.status(404).json({
          message:
            "Employee document not found",
        });
      }

      /* -----------------------------------------------------
         RETURN DOCUMENT

         Because we use select("*"), the response
         includes the new fields:

         document_number
         document_number_last4
         file_path
         file_name
         mime_type
         file_size
         verification_status
         verified_at
         verified_by
      ----------------------------------------------------- */

      return res.status(200).json(
        data
      );
    } catch (error) {
      console.error(
        "Unexpected employee document lookup error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load employee document",

        detail:
          error?.message ||
          null,
      });
    }
  }
);
/* =========================================================
   VIEW EMPLOYEE DOCUMENT

   GET /api/documents/employee/:id/view

   Generates a temporary signed URL for the actual
   document stored in Supabase Storage.

   The bucket remains PRIVATE.
========================================================= */

router.get(
  "/employee/:id/view",
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      /* -----------------------------------------------------
         VALIDATE DOCUMENT ID
      ----------------------------------------------------- */

      if (!id) {
        return res.status(400).json({
          message:
            "Employee document ID is required.",
        });
      }

      /* -----------------------------------------------------
         LOAD DOCUMENT
         
         Organization filtering is important here.
         One organization must never be able to access
         another organization's employee documents.
      ----------------------------------------------------- */

      const {
        data: document,
        error: documentError,
      } =
        await supabaseAdmin
          .from(
            "employee_documents"
          )
          .select(
            `
              id,
              employee_id,
              organization_id,
              document_type,
              document_name,
              document_number_last4,
              file_path,
              file_name,
              mime_type,
              file_size,
              verification_status
            `
          )
          .eq(
            "id",
            id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (documentError) {
        console.error(
          "Employee document view lookup error:",
          documentError
        );

        return res.status(500).json({
          message:
            "Could not load employee document.",

          detail:
            documentError.message,
        });
      }

      /* -----------------------------------------------------
         DOCUMENT NOT FOUND
      ----------------------------------------------------- */

      if (!document) {
        return res.status(404).json({
          message:
            "Employee document not found.",
        });
      }

      /* -----------------------------------------------------
         NO FILE ATTACHED
      ----------------------------------------------------- */

      if (!document.file_path) {
        return res.status(404).json({
          message:
            "No document file has been uploaded for this record.",
        });
      }

      /* -----------------------------------------------------
         GENERATE SIGNED URL
         
         5 minutes is enough for viewing the document
         without exposing a permanent public URL.
      ----------------------------------------------------- */

      const {
        data: signedUrlData,
        error: signedUrlError,
      } =
        await supabaseAdmin
          .storage
          .from(
            "employee-documents"
          )
          .createSignedUrl(
            document.file_path,
            60 * 5
          );

      if (signedUrlError) {
        console.error(
          "Employee document signed URL error:",
          signedUrlError
        );

        return res.status(500).json({
          message:
            "Could not generate document viewing link.",

          detail:
            signedUrlError.message,
        });
      }

      if (
        !signedUrlData?.signedUrl
      ) {
        return res.status(500).json({
          message:
            "Could not generate document viewing link.",
        });
      }

      /* -----------------------------------------------------
         RETURN VIEW INFORMATION
      ----------------------------------------------------- */

      return res.status(200).json({
        document_id:
          document.id,

        document_type:
          document.document_type,

        document_name:
          document.document_name,

        document_number_last4:
          document.document_number_last4,

        file_name:
          document.file_name,

        mime_type:
          document.mime_type,

        file_size:
          document.file_size,

        verification_status:
          document.verification_status,

        url:
          signedUrlData.signedUrl,

        expires_in:
          300,
      });
    } catch (error) {
      console.error(
        "Unexpected employee document view error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not open employee document.",

        detail:
          error?.message ||
          null,
      });
    }
  }
);
/* =========================================================
   CREATE EMPLOYEE DOCUMENT

   POST /api/documents/employee

   Frontend sends:

   {
     employee_id,
     document_type,
     document_number,
     expiry_date,
     notes
   }

   document_name is generated automatically.
========================================================= */

router.post(
  "/employee",
  async (req, res) => {
    try {
      const {
        employee_id,
        document_type,
        document_number,
        file_url = null,
        file_path = null,
        file_name = null,
        mime_type = null,
        file_size = null,
        status = "active",
        expiry_date = null,
        notes = null,
      } = req.body || {};

      /* =====================================================
         REQUIRED FIELD VALIDATION
      ===================================================== */

      if (!employee_id) {
        return res.status(400).json({
          message:
            "employee_id is required",
        });
      }

      if (!document_type) {
        return res.status(400).json({
          message:
            "document_type is required",
        });
      }

      /* =====================================================
         VALID DOCUMENT TYPE
      ===================================================== */

      if (
        !EMPLOYEE_DOCUMENT_TYPES.includes(
          document_type
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid employee document type",

          allowed_types:
            EMPLOYEE_DOCUMENT_TYPES,
        });
      }

      /* =====================================================
         VALID DOCUMENT STATUS
      ===================================================== */

      if (
        !EMPLOYEE_DOCUMENT_STATUSES.includes(
          status
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid document status",

          allowed_statuses:
            EMPLOYEE_DOCUMENT_STATUSES,
        });
      }

      /* =====================================================
         DOCUMENT NUMBER
      ===================================================== */

      const normalizedDocumentNumber =
        normalizeDocumentNumber(
          document_number
        );

      /*
       * Identity documents must have a number.
       *
       * Other documents can exist without a
       * number if the HR workflow allows it.
       */

      const numberRequiredTypes = [
        "aadhaar",
        "pan",
        "passport",
      ];

      if (
        numberRequiredTypes.includes(
          document_type
        ) &&
        !normalizedDocumentNumber
      ) {
        return res.status(400).json({
          message:
            `${getEmployeeDocumentName(
              document_type
            )} number is required`,
        });
      }

      /* =====================================================
         VERIFY EMPLOYEE

         Make sure the employee belongs to
         the current organization.
      ===================================================== */

      const {
        data: employee,
        error: employeeError,
      } =
        await supabaseAdmin
          .from("employees")
          .select(
            "id, full_name, email"
          )
          .eq(
            "id",
            employee_id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (employeeError) {
        console.error(
          "Employee verification error:",
          employeeError
        );

        return res.status(500).json({
          message:
            "Could not verify employee",

          detail:
            employeeError.message,
        });
      }

      if (!employee) {
        return res.status(404).json({
          message:
            "Employee not found",
        });
      }

      /* =====================================================
         GENERATE DOCUMENT NAME

         The user no longer enters document_name.

         Examples:

         pan
           -> PAN

         aadhaar
           -> Aadhaar

         passport
           -> Passport
      ===================================================== */

      const documentName =
        getEmployeeDocumentName(
          document_type
        );

      /* =====================================================
         GENERATE LAST 4 DIGITS

         Example:

         ABCDE1234F
              ↓
         1234F

         1234 5678 9012
              ↓
         9012
      ===================================================== */

      const documentNumberLast4 =
        getDocumentNumberLast4(
          normalizedDocumentNumber
        );

      /* =====================================================
         BUILD DATABASE RECORD
      ===================================================== */

      const record = {
        organization_id:
          req.organization.id,

        employee_id,

        document_type,

        /*
         * IMPORTANT:
         *
         * The database still has:
         *
         * document_name TEXT NOT NULL
         *
         * Therefore we generate it automatically.
         */

        document_name:
          documentName,

        document_number:
          normalizedDocumentNumber,

        document_number_last4:
          documentNumberLast4,

        file_url:
          file_url || null,

        file_path:
          file_path || null,

        file_name:
          file_name || null,

        mime_type:
          mime_type || null,

        file_size:
          file_size !== null &&
          file_size !== undefined &&
          file_size !== ""
            ? Number(file_size)
            : null,

        status,

        expiry_date:
          expiry_date || null,

        notes:
          notes || null,

        /*
         * Every newly added document
         * starts as pending.
         *
         * HR can verify it later.
         */

        verification_status:
          "pending",
      };

      /* =====================================================
         INSERT DOCUMENT
      ===================================================== */

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "employee_documents"
          )
          .insert(record)
          .select("*")
          .single();

      /* =====================================================
         DATABASE ERROR
      ===================================================== */

      if (error) {
        console.error(
          "Employee document create error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not create employee document",

          detail:
            error.message,

          code:
            error.code || null,
        });
      }

      /* =====================================================
         SUCCESS
      ===================================================== */

      return res.status(201).json(
        data
      );
    } catch (error) {
      console.error(
        "Unexpected employee document create error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not create employee document",

        detail:
          error?.message ||
          null,
      });
    }
  }
);
/* =========================================================
   UPDATE EMPLOYEE DOCUMENT

   PUT /api/documents/employee/:id

   Supported fields:

   document_type
   document_number
   file_url
   file_path
   file_name
   mime_type
   file_size
   status
   expiry_date
   notes
   verification_status
========================================================= */

router.put(
  "/employee/:id",
  async (req, res) => {
    try {
      const {
        document_type,
        document_number,
        file_url,
        file_path,
        file_name,
        mime_type,
        file_size,
        status,
        expiry_date,
        notes,
        verification_status,
      } = req.body || {};

      /* =====================================================
         LOAD EXISTING DOCUMENT
      ===================================================== */

      const {
        data: existingDocument,
        error: existingDocumentError,
      } =
        await supabaseAdmin
          .from("employee_documents")
          .select("*")
          .eq(
            "id",
            req.params.id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (existingDocumentError) {
        console.error(
          "Employee document lookup before update error:",
          existingDocumentError
        );

        return res.status(500).json({
          message:
            "Could not load employee document",

          detail:
            existingDocumentError.message,
        });
      }

      if (!existingDocument) {
        return res.status(404).json({
          message:
            "Employee document not found",
        });
      }

      /* =====================================================
         UPDATE OBJECT
      ===================================================== */

      const updateData = {};

      /* =====================================================
         DOCUMENT TYPE
      ===================================================== */

      if (
        document_type !==
        undefined
      ) {
        if (
          !EMPLOYEE_DOCUMENT_TYPES.includes(
            document_type
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid employee document type",

            allowed_types:
              EMPLOYEE_DOCUMENT_TYPES,
          });
        }

        updateData.document_type =
          document_type;

        /*
         * Automatically regenerate the
         * human-readable document name.
         *
         * Example:
         *
         * pan
         * ↓
         * PAN
         */

        updateData.document_name =
          getEmployeeDocumentName(
            document_type
          );
      }

      /* =====================================================
         DOCUMENT NUMBER
      ===================================================== */

      if (
        document_number !==
        undefined
      ) {
        const normalizedDocumentNumber =
          normalizeDocumentNumber(
            document_number
          );

        updateData.document_number =
          normalizedDocumentNumber;

        updateData.document_number_last4 =
          getDocumentNumberLast4(
            normalizedDocumentNumber
          );

        /*
         * A changed document number
         * must be reviewed again.
         */

        updateData.verification_status =
          "pending";

        updateData.verified_at =
          null;

        updateData.verified_by =
          null;
      }

      /* =====================================================
         FILE URL
      ===================================================== */

      if (
        file_url !==
        undefined
      ) {
        updateData.file_url =
          file_url || null;
      }

      /* =====================================================
         FILE PATH
      ===================================================== */

      if (
        file_path !==
        undefined
      ) {
        updateData.file_path =
          file_path || null;
      }

      /* =====================================================
         FILE NAME
      ===================================================== */

      if (
        file_name !==
        undefined
      ) {
        updateData.file_name =
          file_name || null;
      }

      /* =====================================================
         MIME TYPE
      ===================================================== */

      if (
        mime_type !==
        undefined
      ) {
        updateData.mime_type =
          mime_type || null;
      }

      /* =====================================================
         FILE SIZE
      ===================================================== */

      if (
        file_size !==
        undefined
      ) {
        updateData.file_size =
          file_size !== null &&
          file_size !== ""
            ? Number(file_size)
            : null;
      }

      /* =====================================================
         DOCUMENT STATUS
      ===================================================== */

      if (
        status !==
        undefined
      ) {
        if (
          !EMPLOYEE_DOCUMENT_STATUSES.includes(
            status
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid document status",

            allowed_statuses:
              EMPLOYEE_DOCUMENT_STATUSES,
          });
        }

        updateData.status =
          status;
      }

      /* =====================================================
         EXPIRY DATE
      ===================================================== */

      if (
        expiry_date !==
        undefined
      ) {
        updateData.expiry_date =
          expiry_date || null;
      }

      /* =====================================================
         NOTES
      ===================================================== */

      if (
        notes !==
        undefined
      ) {
        updateData.notes =
          notes || null;
      }

      /* =====================================================
         VERIFICATION STATUS
      ===================================================== */

      if (
        verification_status !==
        undefined
      ) {
        if (
          !EMPLOYEE_DOCUMENT_VERIFICATION_STATUSES.includes(
            verification_status
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid verification status",

            allowed_statuses:
              EMPLOYEE_DOCUMENT_VERIFICATION_STATUSES,
          });
        }

        updateData.verification_status =
          verification_status;

        /* ---------------------------------------------------
           VERIFIED
        --------------------------------------------------- */

        if (
          verification_status ===
          "verified"
        ) {
          updateData.verified_at =
            new Date().toISOString();

          updateData.verified_by =
            req.user.id;
        }

        /* ---------------------------------------------------
           PENDING / REJECTED
        --------------------------------------------------- */

        if (
          verification_status !==
          "verified"
        ) {
          updateData.verified_at =
            null;

          updateData.verified_by =
            null;
        }
      }

      /* =====================================================
         NOTHING TO UPDATE
      ===================================================== */

      if (
        Object.keys(
          updateData
        ).length === 0
      ) {
        return res.status(400).json({
          message:
            "No document fields provided for update",
        });
      }

      /* =====================================================
         UPDATED TIMESTAMP
      ===================================================== */

      updateData.updated_at =
        new Date().toISOString();

      /* =====================================================
         UPDATE DATABASE
      ===================================================== */

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "employee_documents"
          )
          .update(updateData)
          .eq(
            "id",
            req.params.id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .select("*")
          .single();

      if (error) {
        console.error(
          "Employee document update error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not update employee document",

          detail:
            error.message,

          code:
            error.code || null,
        });
      }

      return res.status(200).json(
        data
      );
    } catch (error) {
      console.error(
        "Unexpected employee document update error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not update employee document",

        detail:
          error?.message ||
          null,
      });
    }
  }
);

/* =========================================================
   DELETE EMPLOYEE DOCUMENT

   DELETE /api/documents/employee/:id
========================================================= */

router.delete(
  "/employee/:id",
  async (req, res) => {
    try {
      /* =====================================================
         VERIFY DOCUMENT EXISTS
      ===================================================== */

      const {
        data: existingDocument,
        error: existingDocumentError,
      } =
        await supabaseAdmin
          .from(
            "employee_documents"
          )
          .select("id")
          .eq(
            "id",
            req.params.id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (existingDocumentError) {
        console.error(
          "Employee document delete lookup error:",
          existingDocumentError
        );

        return res.status(500).json({
          message:
            "Could not load employee document",

          detail:
            existingDocumentError.message,
        });
      }

      if (!existingDocument) {
        return res.status(404).json({
          message:
            "Employee document not found",
        });
      }

      /* =====================================================
         DELETE
      ===================================================== */

      const {
        error,
      } =
        await supabaseAdmin
          .from(
            "employee_documents"
          )
          .delete()
          .eq(
            "id",
            req.params.id
          )
          .eq(
            "organization_id",
            req.organization.id
          );

      if (error) {
        console.error(
          "Employee document delete error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not delete employee document",

          detail:
            error.message,
        });
      }

      return res.status(200).json({
        message:
          "Employee document deleted successfully",
      });
    } catch (error) {
      console.error(
        "Unexpected employee document delete error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not delete employee document",

        detail:
          error?.message ||
          null,
      });
    }
  }
);
/* =========================================================
   DOCUMENT TEMPLATES
========================================================= */

/* =========================================================
   POST /api/documents/templates

   CREATE DOCUMENT TEMPLATE
========================================================= */

router.post(
  "/templates",
  async (req, res) => {
    try {
      const payload =
        normalizeTemplatePayload(
          req.body
        );

      /* -----------------------------------------------------
         VALIDATE DOCUMENT TYPE
      ----------------------------------------------------- */

      if (
        !isValidDocumentType(
          payload.document_type
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid document_type",

          allowed_types:
            VALID_DOCUMENT_TYPES,
        });
      }

      /* -----------------------------------------------------
         VALIDATE TEMPLATE NAME
      ----------------------------------------------------- */

      if (!payload.template_name) {
        return res.status(400).json({
          message:
            "template_name is required",
        });
      }

      /* -----------------------------------------------------
         VALIDATE CONTENT
      ----------------------------------------------------- */

      if (
        !payload.content.trim()
      ) {
        return res.status(400).json({
          message:
            "Template content is required",
        });
      }

      /* -----------------------------------------------------
         RESET EXISTING DEFAULT
      ----------------------------------------------------- */

      if (
        payload.is_default &&
        payload.status === "active"
      ) {
        const {
          error:
            resetDefaultError,
        } =
          await supabaseAdmin
            .from(
              "document_templates"
            )
            .update({
              is_default: false,
            })
            .eq(
              "organization_id",
              req.organization.id
            )
            .eq(
              "document_type",
              payload.document_type
            )
            .eq(
              "is_default",
              true
            )
            .eq(
              "status",
              "active"
            );

        if (resetDefaultError) {
          return res.status(500).json({
            message:
              "Could not update the existing default template",

            detail:
              resetDefaultError.message,
          });
        }
      }

      /* -----------------------------------------------------
         CREATE TEMPLATE
      ----------------------------------------------------- */

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "document_templates"
          )
          .insert({
            organization_id:
              req.organization.id,

            document_type:
              payload.document_type,

            template_name:
              payload.template_name,

            description:
              payload.description,

            content:
              payload.content,

            styling:
              payload.styling,

            logo_url:
              payload.logo_url,

            signature_url:
              payload.signature_url,

            signatory_name:
              payload.signatory_name,

            signatory_designation:
              payload.signatory_designation,

            status:
              payload.status,

            is_default:
              payload.is_default &&
              payload.status ===
                "active",
          })
          .select()
          .single();

      if (error) {
        console.error(
          "Document template creation error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not create document template",

          detail:
            error.message,
        });
      }

      return res.status(201).json(
        data
      );
    } catch (error) {
      console.error(
        "Unexpected document template creation error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not create document template",
      });
    }
  }
);

/* =========================================================
   PUT /api/documents/templates/:id

   UPDATE DOCUMENT TEMPLATE
========================================================= */

router.put(
  "/templates/:id",
  async (req, res) => {
    try {
      const { id } =
        req.params;

      /* -----------------------------------------------------
         LOAD EXISTING TEMPLATE
      ----------------------------------------------------- */

      const {
        data: existingTemplate,
        error: lookupError,
      } =
        await supabaseAdmin
          .from(
            "document_templates"
          )
          .select("*")
          .eq(
            "id",
            id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (lookupError) {
        return res.status(500).json({
          message:
            "Could not load document template",

          detail:
            lookupError.message,
        });
      }

      if (!existingTemplate) {
        return res.status(404).json({
          message:
            "Document template not found",
        });
      }

      /* -----------------------------------------------------
         NORMALIZE PAYLOAD
      ----------------------------------------------------- */

      const payload =
        normalizeTemplatePayload(
          req.body
        );

      const documentType =
        payload.document_type ||
        existingTemplate.document_type;

      const templateName =
        payload.template_name ||
        existingTemplate.template_name;

      const content =
        payload.content ||
        existingTemplate.content;

      const status =
        payload.status ||
        existingTemplate.status;

      const isDefault =
        typeof req.body?.is_default ===
        "boolean"
          ? req.body.is_default
          : existingTemplate.is_default;

      /* -----------------------------------------------------
         VALIDATION
      ----------------------------------------------------- */

      if (
        !isValidDocumentType(
          documentType
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid document_type",

          allowed_types:
            VALID_DOCUMENT_TYPES,
        });
      }

      if (
        !templateName.trim()
      ) {
        return res.status(400).json({
          message:
            "template_name is required",
        });
      }

      if (
        !content.trim()
      ) {
        return res.status(400).json({
          message:
            "Template content is required",
        });
      }

      /* -----------------------------------------------------
         RESET OTHER DEFAULTS
      ----------------------------------------------------- */

      if (
        isDefault &&
        status === "active"
      ) {
        const {
          error:
            resetDefaultError,
        } =
          await supabaseAdmin
            .from(
              "document_templates"
            )
            .update({
              is_default: false,
            })
            .eq(
              "organization_id",
              req.organization.id
            )
            .eq(
              "document_type",
              documentType
            )
            .eq(
              "is_default",
              true
            )
            .eq(
              "status",
              "active"
            )
            .neq(
              "id",
              id
            );

        if (resetDefaultError) {
          return res.status(500).json({
            message:
              "Could not update existing default template",

            detail:
              resetDefaultError.message,
          });
        }
      }

      /* -----------------------------------------------------
         UPDATE DATA
      ----------------------------------------------------- */

      const updateData = {
        document_type:
          documentType,

        template_name:
          templateName.trim(),

        description:
          payload.description,

        content,

        styling:
          payload.styling,

        logo_url:
          payload.logo_url,

        signature_url:
          payload.signature_url,

        signatory_name:
          payload.signatory_name,

        signatory_designation:
          payload.signatory_designation,

        status,

        is_default:
          isDefault &&
          status === "active",

        updated_at:
          new Date().toISOString(),
      };

      /* -----------------------------------------------------
         UPDATE DATABASE
      ----------------------------------------------------- */

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "document_templates"
          )
          .update(updateData)
          .eq(
            "id",
            id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .select()
          .single();

      if (error) {
        console.error(
          "Document template update error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not update document template",

          detail:
            error.message,
        });
      }

      return res.status(200).json(
        data
      );
    } catch (error) {
      console.error(
        "Unexpected document template update error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not update document template",
      });
    }
  }
);

/* =========================================================
   POST /api/documents/templates/:id/default

   SET TEMPLATE AS DEFAULT
========================================================= */

router.post(
  "/templates/:id/default",
  async (req, res) => {
    try {
      const { id } =
        req.params;

      /* -----------------------------------------------------
         LOAD TEMPLATE
      ----------------------------------------------------- */

      const {
        data: template,
        error: lookupError,
      } =
        await supabaseAdmin
          .from(
            "document_templates"
          )
          .select("*")
          .eq(
            "id",
            id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (lookupError) {
        return res.status(500).json({
          message:
            "Could not load document template",

          detail:
            lookupError.message,
        });
      }

      if (!template) {
        return res.status(404).json({
          message:
            "Document template not found",
        });
      }

      /* -----------------------------------------------------
         ONLY ACTIVE TEMPLATES
      ----------------------------------------------------- */

      if (
        template.status !==
        "active"
      ) {
        return res.status(400).json({
          message:
            "Only active templates can be made default",
        });
      }

      /* -----------------------------------------------------
         REMOVE EXISTING DEFAULT
      ----------------------------------------------------- */

      const {
        error:
          resetError,
      } =
        await supabaseAdmin
          .from(
            "document_templates"
          )
          .update({
            is_default: false,
          })
          .eq(
            "organization_id",
            req.organization.id
          )
          .eq(
            "document_type",
            template.document_type
          )
          .eq(
            "is_default",
            true
          );

      if (resetError) {
        return res.status(500).json({
          message:
            "Could not reset existing default template",

          detail:
            resetError.message,
        });
      }

      /* -----------------------------------------------------
         SET NEW DEFAULT
      ----------------------------------------------------- */

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "document_templates"
          )
          .update({
            is_default: true,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .select()
          .single();

      if (error) {
        return res.status(500).json({
          message:
            "Could not set default template",

          detail:
            error.message,
        });
      }

      return res.status(200).json(
        data
      );
    } catch (error) {
      console.error(
        "Set default template error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not set default template",
      });
    }
  }
);

/* =========================================================
   DELETE /api/documents/templates/:id

   DELETE DOCUMENT TEMPLATE
========================================================= */

router.delete(
  "/templates/:id",
  async (req, res) => {
    try {
      const { id } =
        req.params;

      /* -----------------------------------------------------
         VERIFY TEMPLATE EXISTS
      ----------------------------------------------------- */

      const {
        data: template,
        error: lookupError,
      } =
        await supabaseAdmin
          .from(
            "document_templates"
          )
          .select(
            "id, template_name"
          )
          .eq(
            "id",
            id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (lookupError) {
        return res.status(500).json({
          message:
            "Could not load document template",

          detail:
            lookupError.message,
        });
      }

      if (!template) {
        return res.status(404).json({
          message:
            "Document template not found",
        });
      }

      /* -----------------------------------------------------
         DELETE
      ----------------------------------------------------- */

      const {
        error,
      } =
        await supabaseAdmin
          .from(
            "document_templates"
          )
          .delete()
          .eq(
            "id",
            id
          )
          .eq(
            "organization_id",
            req.organization.id
          );

      if (error) {
        console.error(
          "Document template deletion error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not delete document template",

          detail:
            error.message,
        });
      }

      return res.status(200).json({
        message:
          "Document template deleted successfully",
      });
    } catch (error) {
      console.error(
        "Unexpected document template deletion error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not delete document template",
      });
    }
  }
);
/* =========================================================
   GENERATED DOCUMENTS
========================================================= */

/* =========================================================
   POST /api/documents/generated

   SAVE GENERATED DOCUMENT
========================================================= */

router.post(
  "/generated",
  async (req, res) => {
    try {
      const {
        document_type,
        title,
        generated_at,
        organization,
        employee,
        template,
        content,
      } = req.body || {};

      /* -----------------------------------------------------
         VALIDATION
      ----------------------------------------------------- */

      if (!document_type) {
        return res.status(400).json({
          message:
            "document_type is required",
        });
      }

      if (!employee?.id) {
        return res.status(400).json({
          message:
            "employee.id is required",
        });
      }

      if (
        !isValidDocumentType(
          document_type
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid document_type",

          allowed_types:
            VALID_DOCUMENT_TYPES,
        });
      }

      /* -----------------------------------------------------
         VERIFY EMPLOYEE BELONGS TO
         CURRENT ORGANIZATION
      ----------------------------------------------------- */

      const {
        data: employeeRecord,
        error: employeeError,
      } =
        await supabaseAdmin
          .from("employees")
          .select("*")
          .eq(
            "id",
            employee.id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (employeeError) {
        console.error(
          "Generated document employee lookup error:",
          employeeError
        );

        return res.status(500).json({
          message:
            "Could not verify employee",

          detail:
            employeeError.message,
        });
      }

      if (!employeeRecord) {
        return res.status(404).json({
          message:
            "Employee not found",
        });
      }

      /* -----------------------------------------------------
         VERIFY TEMPLATE
         
         Template is optional because system-generated
         documents may not have a template ID.
      ----------------------------------------------------- */

      let templateRecord = null;

      if (template?.id) {
        const {
          data,
          error: templateError,
        } =
          await supabaseAdmin
            .from(
              "document_templates"
            )
            .select("*")
            .eq(
              "id",
              template.id
            )
            .eq(
              "organization_id",
              req.organization.id
            )
            .maybeSingle();

        if (templateError) {
          console.error(
            "Generated document template lookup error:",
            templateError
          );

          return res.status(500).json({
            message:
              "Could not verify template",

            detail:
              templateError.message,
          });
        }

        if (!data) {
          return res.status(404).json({
            message:
              "Template not found",
          });
        }

        templateRecord =
          data;
      }

      /* -----------------------------------------------------
         BUILD DOCUMENT DATA
         
         Complete generated document is stored
         inside document_data JSONB.
      ----------------------------------------------------- */

      const documentData = {
        type:
          document_type,

        title:
          title ||
          "HR Document",

        generated_at:
          generated_at ||
          new Date().toISOString(),

        organization:
          organization || {
            id:
              req.organization.id,

            name:
              req.organization.name ||
              "Organization",
          },

        employee: {
          id:
            employeeRecord.id,

          employee_code:
            employeeRecord.employee_code ||
            null,

          full_name:
            employeeRecord.full_name,

          email:
            employeeRecord.email,

          department:
            employeeRecord.department ||
            null,

          title:
            employeeRecord.title ||
            null,

          joining_date:
            employeeRecord.joining_date ||
            null,

          employment_status:
            employeeRecord.employment_status ||
            null,

          last_working_date:
            employeeRecord.last_working_date ||
            null,

          address:
            employeeRecord.address ||
            null,
        },

        template:
          templateRecord || null,

        content:
          content || {},
      };

      /* -----------------------------------------------------
         DATABASE RECORD
      ----------------------------------------------------- */

      const record = {
        organization_id:
          req.organization.id,

        employee_id:
          employeeRecord.id,

        template_id:
          templateRecord?.id ||
          null,

        document_type:
          document_type,

        title:
          title ||
          "HR Document",

        source:
          templateRecord
            ? "organization_template"
            : "system",

        document_data:
          documentData,

        generated_by:
          req.user.id,
      };

      /* -----------------------------------------------------
         SAVE
      ----------------------------------------------------- */

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "generated_documents"
          )
          .insert(record)
          .select()
          .single();

      if (error) {
        console.error(
          "Generated document save error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not save generated document",

          detail:
            error.message,

          code:
            error.code || null,
        });
      }

      /* -----------------------------------------------------
         SUCCESS
      ----------------------------------------------------- */

      return res.status(201).json({
        message:
          "Document saved successfully",

        document:
          data,
      });
    } catch (error) {
      console.error(
        "Unexpected generated document save error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not save generated document",

        detail:
          error?.message ||
          null,
      });
    }
  }
);

/* =========================================================
   GET /api/documents/generated

   LOAD SAVED GENERATED DOCUMENTS

   Optional:
   ?employee_id=...
   ?document_type=...
========================================================= */

router.get(
  "/generated",
  async (req, res) => {
    try {
      const {
        employee_id,
        document_type,
      } = req.query;

      /* -----------------------------------------------------
         BASE QUERY
      ----------------------------------------------------- */

      let query =
        supabaseAdmin
          .from(
            "generated_documents"
          )
          .select("*")
          .eq(
            "organization_id",
            req.organization.id
          );

      /* -----------------------------------------------------
         FILTER BY EMPLOYEE
      ----------------------------------------------------- */

      if (employee_id) {
        query =
          query.eq(
            "employee_id",
            employee_id
          );
      }

      /* -----------------------------------------------------
         FILTER BY DOCUMENT TYPE
      ----------------------------------------------------- */

      if (document_type) {
        if (
          !isValidDocumentType(
            document_type
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid document_type",

            allowed_types:
              VALID_DOCUMENT_TYPES,
          });
        }

        query =
          query.eq(
            "document_type",
            document_type
          );
      }

      /* -----------------------------------------------------
         LOAD DOCUMENTS
      ----------------------------------------------------- */

      const {
        data,
        error,
      } = await query;

      if (error) {
        console.error(
          "Generated document list error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load saved documents",

          detail:
            error.message,
        });
      }

      /* -----------------------------------------------------
         SORT BY GENERATED DATE
         
         generated_at is stored inside document_data,
         so sort safely in JavaScript.
      ----------------------------------------------------- */

      const documents =
        Array.isArray(data)
          ? [...data].sort(
              (a, b) => {
                const dateA =
                  a?.document_data
                    ?.generated_at
                    ? new Date(
                        a.document_data
                          .generated_at
                      ).getTime()
                    : 0;

                const dateB =
                  b?.document_data
                    ?.generated_at
                    ? new Date(
                        b.document_data
                          .generated_at
                      ).getTime()
                    : 0;

                return (
                  dateB -
                  dateA
                );
              }
            )
          : [];

      return res.status(200).json(
        documents
      );
    } catch (error) {
      console.error(
        "Unexpected generated document list error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load saved documents",

        detail:
          error?.message ||
          null,
      });
    }
  }
);

/* =========================================================
   GET /api/documents/generated/:id

   LOAD ONE SAVED GENERATED DOCUMENT
========================================================= */

router.get(
  "/generated/:id",
  async (req, res) => {
    try {
      const { id } =
        req.params;

      /* -----------------------------------------------------
         VALIDATE ID
      ----------------------------------------------------- */

      if (!id) {
        return res.status(400).json({
          message:
            "Document ID is required",
        });
      }

      /* -----------------------------------------------------
         LOAD DOCUMENT
      ----------------------------------------------------- */

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "generated_documents"
          )
          .select("*")
          .eq(
            "id",
            id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (error) {
        console.error(
          "Generated document lookup error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load generated document",

          detail:
            error.message,
        });
      }

      /* -----------------------------------------------------
         NOT FOUND
      ----------------------------------------------------- */

      if (!data) {
        return res.status(404).json({
          message:
            "Generated document not found",
        });
      }

      /* -----------------------------------------------------
         SUCCESS
      ----------------------------------------------------- */

      return res.status(200).json(
        data
      );
    } catch (error) {
      console.error(
        "Unexpected generated document lookup error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load generated document",

        detail:
          error?.message ||
          null,
      });
    }
  }
);
/* =========================================================
   SEND GENERATED DOCUMENT
========================================================= */

/* =========================================================
   POST /api/documents/generated/:id/send

   Send a previously generated document
   to the employee's email address.
========================================================= */

router.post(
  "/generated/:id/send",
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const {
        employee_email,
      } = req.body || {};

      /* -----------------------------------------------------
         VALIDATE DOCUMENT ID
      ----------------------------------------------------- */

      if (!id) {
        return res.status(400).json({
          message:
            "Document ID is required",
        });
      }

      /* -----------------------------------------------------
         LOAD GENERATED DOCUMENT
      ----------------------------------------------------- */

      const {
        data: generatedDocument,
        error: documentError,
      } =
        await supabaseAdmin
          .from(
            "generated_documents"
          )
          .select("*")
          .eq(
            "id",
            id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (documentError) {
        console.error(
          "Generated document lookup before send error:",
          documentError
        );

        return res.status(500).json({
          message:
            "Could not load generated document",

          detail:
            documentError.message,
        });
      }

      /* -----------------------------------------------------
         DOCUMENT NOT FOUND
      ----------------------------------------------------- */

      if (!generatedDocument) {
        return res.status(404).json({
          message:
            "Generated document not found",
        });
      }

      /* -----------------------------------------------------
         LOAD EMPLOYEE
      ----------------------------------------------------- */

      const {
        data: employee,
        error: employeeError,
      } =
        await supabaseAdmin
          .from("employees")
          .select("*")
          .eq(
            "id",
            generatedDocument.employee_id
          )
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (employeeError) {
        console.error(
          "Employee lookup before document send error:",
          employeeError
        );

        return res.status(500).json({
          message:
            "Could not load employee",

          detail:
            employeeError.message,
        });
      }

      if (!employee) {
        return res.status(404).json({
          message:
            "Employee associated with document was not found",
        });
      }

      /* -----------------------------------------------------
         DETERMINE RECIPIENT EMAIL
         
         Explicit email from frontend takes priority.
         Otherwise use employee email.
      ----------------------------------------------------- */

      const recipientEmail =
        employee_email ||
        employee.email ||
        null;

      if (!recipientEmail) {
        return res.status(400).json({
          message:
            "Employee email is required to send the document",
        });
      }

      /* -----------------------------------------------------
         EXTRACT DOCUMENT DATA
      ----------------------------------------------------- */

      const documentData =
        generatedDocument.document_data ||
        {};

      const documentTitle =
        generatedDocument.title ||
        documentData.title ||
        "HR Document";

      const documentContent =
        documentData.content ||
        documentData ||
        {};

      /* -----------------------------------------------------
         SEND EMAIL
         
         sendGeneratedDocumentEmail is the existing
         email-service abstraction used by the backend.
      ----------------------------------------------------- */

      const emailResult =
        await sendGeneratedDocumentEmail({
          to:
            recipientEmail,

          employee,

          organization:
            req.organization,

          document: {
            ...generatedDocument,

            title:
              documentTitle,

            content:
              documentContent,
          },
        });

      /* -----------------------------------------------------
         UPDATE SENT INFORMATION
         
         These fields are only written if they exist
         in the generated_documents table.
      ----------------------------------------------------- */

      const updateData = {};

      /*
       * Keep this lightweight because different versions
       * of the generated_documents table may not contain
       * sent_at / sent_to columns.
       *
       * The email itself is considered successful once
       * the email service completes without throwing.
       */

      if (
        emailResult &&
        typeof emailResult ===
          "object"
      ) {
        if (
          emailResult.messageId
        ) {
          updateData.email_message_id =
            emailResult.messageId;
        }
      }

      if (
        Object.keys(
          updateData
        ).length > 0
      ) {
        const {
          error:
            updateError,
        } =
          await supabaseAdmin
            .from(
              "generated_documents"
            )
            .update(
              updateData
            )
            .eq(
              "id",
              id
            )
            .eq(
              "organization_id",
              req.organization.id
            );

        if (updateError) {
          /*
           * Do not report the entire send as failed
           * because the email was already sent.
           */
          console.warn(
            "Document sent but send metadata could not be saved:",
            updateError
          );
        }
      }

      /* -----------------------------------------------------
         SUCCESS
      ----------------------------------------------------- */

      return res.status(200).json({
        message:
          "Document sent successfully",

        document_id:
          generatedDocument.id,

        employee_id:
          employee.id,

        recipient:
          recipientEmail,

        email:
          emailResult || null,
      });
    } catch (error) {
      console.error(
        "Generated document send error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not send generated document",

        detail:
          error?.message ||
          null,
      });
    }
  }
);

/* =========================================================
   FINAL EXPORT
========================================================= */

export default router;