import { Router } from "express";
import multer from "multer";
import crypto from "crypto";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

/* =========================================================
   MULTER
========================================================= */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          "Only JPG, PNG, WEBP and PDF files are allowed."
        )
      );
    }

    cb(null, true);
  },
});

/* =========================================================
   AUTH
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION
========================================================= */

async function requireOrganization(req, res, next) {
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

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "Employee document organization lookup error:",
      error
    );

    return res.status(500).json({
      message:
        "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   CONSTANTS
========================================================= */

const DOCUMENT_TYPES = [
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

const VERIFICATION_STATUSES = [
  "pending",
  "verified",
  "rejected",
  "expired",
];

/* =========================================================
   HELPERS
========================================================= */

function cleanString(value) {
  return String(value ?? "").trim();
}

function maskDocumentNumber(value) {
  const number = cleanString(value);

  if (!number) {
    return null;
  }

  if (number.length <= 4) {
    return "••••";
  }

  return `••••••••${number.slice(-4)}`;
}

function getLast4(value) {
  const number = cleanString(value);

  if (!number) {
    return null;
  }

  return number.slice(-4);
}

function getExtension(file) {
  const originalName =
    file?.originalname || "";

  const parts =
    originalName.split(".");

  if (parts.length < 2) {
    return "bin";
  }

  return parts
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function serializeDocument(document) {
  return {
    ...document,

    document_number:
      maskDocumentNumber(
        document.document_number
      ),

    has_file:
      Boolean(document.file_path),

    file_path: undefined,
  };
}

async function getEmployee(
  employeeId,
  organizationId
) {
  const { data, error } =
    await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   GET EMPLOYEE DOCUMENTS
========================================================= */

router.get("/", async (req, res) => {
  try {
    const {
      employee_id,
      verification_status,
    } = req.query;

    let query =
      supabaseAdmin
        .from("employee_documents")
        .select("*")
        .eq(
          "organization_id",
          req.organization.id
        )
        .order("created_at", {
          ascending: false,
        });

    if (employee_id) {
      query = query.eq(
        "employee_id",
        employee_id
      );
    }

    if (verification_status) {
      query = query.eq(
        "verification_status",
        verification_status
      );
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      console.error(
        "Load employee documents error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load employee documents",
        detail: error.message,
      });
    }

    return res.json(
      (data || []).map(
        serializeDocument
      )
    );
  } catch (error) {
    console.error(
      "Unexpected employee document list error:",
      error
    );

    return res.status(500).json({
      message:
        "Could not load employee documents",
    });
  }
});

/* =========================================================
   GET ONE DOCUMENT
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("employee_documents")
      .select("*")
      .eq("id", req.params.id)
      .eq(
        "organization_id",
        req.organization.id
      )
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        message:
          "Could not load employee document",
        detail: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message:
          "Employee document not found",
      });
    }

    let fileUrl = null;

    if (data.file_path) {
      const {
        data: signed,
        error: signedError,
      } =
        await supabaseAdmin.storage
          .from("employee-documents")
          .createSignedUrl(
            data.file_path,
            60 * 10
          );

      if (!signedError) {
        fileUrl =
          signed?.signedUrl || null;
      }
    }

    return res.json({
      ...data,

      document_number:
        maskDocumentNumber(
          data.document_number
        ),

      has_file:
        Boolean(data.file_path),

      file_url: fileUrl,
    });
  } catch (error) {
    console.error(
      "Employee document lookup error:",
      error
    );

    return res.status(500).json({
      message:
        "Could not load employee document",
    });
  }
});

/* =========================================================
   CREATE DOCUMENT
========================================================= */

router.post(
  "/",
  upload.single("document"),
  async (req, res) => {
    try {
      const {
        employee_id,
        document_type,
        document_name,
        document_number,
        verification_status,
        expiry_date,
        notes,
      } = req.body || {};

      if (!employee_id) {
        return res.status(400).json({
          message:
            "Employee is required",
        });
      }

      if (
        !DOCUMENT_TYPES.includes(
          document_type
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid document type",
        });
      }

      if (!document_name?.trim()) {
        return res.status(400).json({
          message:
            "Document name is required",
        });
      }

      if (
        verification_status &&
        !VERIFICATION_STATUSES.includes(
          verification_status
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid verification status",
        });
      }

      const employee =
        await getEmployee(
          employee_id,
          req.organization.id
        );

      if (!employee) {
        return res.status(404).json({
          message:
            "Employee not found",
        });
      }

      let filePath = null;

      /* -----------------------------------------------------
         UPLOAD FILE
      ----------------------------------------------------- */

      if (req.file) {
        const extension =
          getExtension(req.file);

        const randomName =
          crypto.randomBytes(16).toString(
            "hex"
          );

        filePath =
          `${req.organization.id}/${employee_id}/${Date.now()}-${randomName}.${extension}`;

        const {
          error: uploadError,
        } =
          await supabaseAdmin.storage
            .from("employee-documents")
            .upload(
              filePath,
              req.file.buffer,
              {
                contentType:
                  req.file.mimetype,
                upsert: false,
              }
            );

        if (uploadError) {
          console.error(
            "Employee document upload error:",
            uploadError
          );

          return res.status(500).json({
            message:
              "Could not upload document",
            detail:
              uploadError.message,
          });
        }
      }

      /* -----------------------------------------------------
         SAVE DATABASE RECORD
      ----------------------------------------------------- */

      const payload = {
        organization_id:
          req.organization.id,

        employee_id,

        document_type,

        document_name:
          document_name.trim(),

        document_number:
          cleanString(
            document_number
          ) || null,

        document_number_last4:
          getLast4(
            document_number
          ),

        file_path: filePath,

        file_name:
          req.file?.originalname ||
          null,

        mime_type:
          req.file?.mimetype ||
          null,

        file_size:
          req.file?.size ||
          null,

        verification_status:
          verification_status ||
          "pending",

        expiry_date:
          expiry_date || null,

        notes:
          cleanString(notes) ||
          null,

        updated_at:
          new Date().toISOString(),
      };

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("employee_documents")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        if (filePath) {
          await supabaseAdmin.storage
            .from("employee-documents")
            .remove([filePath]);
        }

        console.error(
          "Save employee document error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not save employee document",
          detail: error.message,
        });
      }

      return res.status(201).json(
        serializeDocument(data)
      );
    } catch (error) {
      console.error(
        "Create employee document error:",
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
   VERIFY / REJECT DOCUMENT
========================================================= */

router.put(
  "/:id/verify",
  async (req, res) => {
    try {
      const {
        verification_status,
        notes,
      } = req.body || {};

      if (
        !VERIFICATION_STATUSES.includes(
          verification_status
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid verification status",
        });
      }

      const {
        data: existing,
        error:
          lookupError,
      } =
        await supabaseAdmin
          .from("employee_documents")
          .select("*")
          .eq("id", req.params.id)
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (lookupError) {
        return res.status(500).json({
          message:
            "Could not load document",
          detail:
            lookupError.message,
        });
      }

      if (!existing) {
        return res.status(404).json({
          message:
            "Employee document not found",
        });
      }

      const isVerified =
        verification_status ===
        "verified";

      const updatePayload = {
        verification_status,

        notes:
          cleanString(notes) ||
          existing.notes ||
          null,

        verified_at: isVerified
          ? new Date().toISOString()
          : null,

        verified_by: isVerified
          ? req.user.id
          : null,

        updated_at:
          new Date().toISOString(),
      };

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("employee_documents")
        .update(updatePayload)
        .eq("id", req.params.id)
        .eq(
          "organization_id",
          req.organization.id
        )
        .select("*")
        .single();

      if (error) {
        return res.status(500).json({
          message:
            "Could not update verification status",
          detail: error.message,
        });
      }

      return res.json(
        serializeDocument(data)
      );
    } catch (error) {
      console.error(
        "Verify employee document error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not update employee document",
      });
    }
  }
);

/* =========================================================
   DELETE DOCUMENT
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const {
        data: existing,
        error:
          lookupError,
      } =
        await supabaseAdmin
          .from("employee_documents")
          .select("*")
          .eq("id", req.params.id)
          .eq(
            "organization_id",
            req.organization.id
          )
          .maybeSingle();

      if (lookupError) {
        return res.status(500).json({
          message:
            "Could not load document",
        });
      }

      if (!existing) {
        return res.status(404).json({
          message:
            "Employee document not found",
        });
      }

      if (existing.file_path) {
        await supabaseAdmin.storage
          .from("employee-documents")
          .remove([
            existing.file_path,
          ]);
      }

      const { error } =
        await supabaseAdmin
          .from("employee_documents")
          .delete()
          .eq("id", req.params.id)
          .eq(
            "organization_id",
            req.organization.id
          );

      if (error) {
        return res.status(500).json({
          message:
            "Could not delete employee document",
          detail: error.message,
        });
      }

      return res.json({
        message:
          "Employee document deleted successfully",
      });
    } catch (error) {
      console.error(
        "Delete employee document error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not delete employee document",
      });
    }
  }
);

export default router;