import { Router } from "express";
import multer from "multer";

import { requireAuth } from "../middleware/auth.js";
import { resolveEmployee as requireEmployee } from "../middleware/resolveEmployee.js";
import { supabaseAdmin } from "../config/supabase.js";

const router = Router();

router.use(requireAuth);
router.use(requireEmployee);

/*
|--------------------------------------------------------------------------
| EMPLOYEE DOCUMENTS
|--------------------------------------------------------------------------
|
| NOTE ON FILENAME: server/src/routes/employeeDocuments.js already
| exists — it's the HR-side document verification tool's route (mounted
| at /api/documents/employee-documents, used by
| DocumentVerificationAssistant.jsx and friends), not an employee
| self-service surface. To avoid colliding with that file this route
| lives in employeeMyDocuments.js instead, following the same /me
| naming spirit as the rest of this codebase's self-service routes.
|
| GET  /api/employee/documents
| GET  /api/employee/documents/:id
| POST /api/employee/documents
|
| req.employee is set by requireEmployee and is ALREADY scoped to the
| authenticated user — every query below uses req.employee.id, never a
| client-supplied employee id.
|
| The system actually models two kinds of employee document:
|
| 1. employee_documents — uploaded files (ID proofs, certificates, and
|    HR-uploaded letters). Real files in the private "employee-documents"
|    Supabase Storage bucket. Both routes/documents.js
|    (POST /api/documents/employee) and routes/employeeDocuments.js use
|    this exact table/bucket; the upload here mirrors that same multer
|    config (memoryStorage, 5MB limit, JPG/PNG/WEBP/PDF only) and
|    storage path convention rather than inventing a new one.
|
| 2. generated_documents — offer letters / experience letters generated
|    from a template. No file — the full letter content is stored as
|    document_data JSON and rendered client-side (the same content
|    routes/documents.js's POST/GET /generated already produces).
|
| Both are surfaced together in the list below.
|--------------------------------------------------------------------------
*/

const DOCUMENT_BUCKET = "employee-documents";

/*
 * Types an employee can plausibly self-submit. Offer letters,
 * experience letters, employment verification, and joining documents
 * are HR-issued (generated or HR-uploaded), not something an employee
 * uploads about themselves.
 */
const SELF_UPLOADABLE_TYPES = [
  "aadhaar",
  "pan",
  "passport",
  "bank_proof",
  "address_proof",
  "education_certificate",
  "experience_certificate",
  "other",
];

const NUMBER_REQUIRED_TYPES = ["aadhaar", "pan", "passport"];

const DOCUMENT_TYPE_LABELS = {
  aadhaar: "Aadhaar",
  pan: "PAN",
  passport: "Passport",
  bank_proof: "Bank Proof",
  address_proof: "Address Proof",
  offer_letter: "Offer Letter",
  experience_letter: "Experience Letter",
  employment_verification: "Employment Verification",
  education_certificate: "Education Certificate",
  experience_certificate: "Experience Certificate",
  joining_document: "Joining Document",
  other: "Other",
};

function getDocumentTypeLabel(type) {
  return (
    DOCUMENT_TYPE_LABELS[type] ||
    String(type || "Other")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

const upload = multer({
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

function clean(value) {
  return String(value ?? "").trim();
}

function serializeUploadedDocument(doc) {
  return {
    id: doc.id,
    source: "uploaded",
    document_type: doc.document_type,
    name: doc.document_name || getDocumentTypeLabel(doc.document_type),
    status: doc.status,
    verification_status: doc.verification_status,
    expiry_date: doc.expiry_date,
    file_name: doc.file_name,
    has_file: Boolean(doc.file_path),
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

function serializeGeneratedDocument(doc) {
  return {
    id: doc.id,
    source: "generated",
    document_type: doc.document_type,
    name: doc.title || getDocumentTypeLabel(doc.document_type),
    status: "generated",
    verification_status: null,
    expiry_date: null,
    file_name: null,
    has_file: false,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/employee/documents
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const employee = req.employee;
    const organizationId = employee.organization_id;

    const [uploadedResult, generatedResult] = await Promise.all([
      supabaseAdmin
        .from("employee_documents")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false }),

      supabaseAdmin
        .from("generated_documents")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false }),
    ]);

    if (uploadedResult.error) {
      throw uploadedResult.error;
    }

    if (generatedResult.error) {
      throw generatedResult.error;
    }

    const documents = [
      ...(uploadedResult.data || []).map(serializeUploadedDocument),
      ...(generatedResult.data || []).map(serializeGeneratedDocument),
    ].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    return res.json({ documents });
  } catch (error) {
    console.error("[EmployeeMyDocuments] GET / error:", error);

    return res.status(500).json({
      message: error?.message || "Could not load your documents.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/employee/documents/:id
|--------------------------------------------------------------------------
| Checks employee_documents first, then generated_documents. 404 (not
| 403) either way if it doesn't belong to req.employee.id.
|--------------------------------------------------------------------------
*/

router.get("/:id", async (req, res) => {
  try {
    const employee = req.employee;
    const organizationId = employee.organization_id;

    const { data: uploadedDoc, error: uploadedError } =
      await supabaseAdmin
        .from("employee_documents")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("employee_id", employee.id)
        .eq("id", req.params.id)
        .maybeSingle();

    if (uploadedError) {
      throw uploadedError;
    }

    if (uploadedDoc) {
      let url = null;

      if (uploadedDoc.file_path) {
        const { data: signedUrlData, error: signedUrlError } =
          await supabaseAdmin.storage
            .from(DOCUMENT_BUCKET)
            .createSignedUrl(uploadedDoc.file_path, 60 * 5);

        if (signedUrlError) {
          console.error(
            "[EmployeeMyDocuments] Signed URL error:",
            signedUrlError
          );
        } else {
          url = signedUrlData?.signedUrl || null;
        }
      }

      return res.json({
        document: {
          ...serializeUploadedDocument(uploadedDoc),
          document_number_last4: uploadedDoc.document_number_last4,
          notes: uploadedDoc.notes,
          mime_type: uploadedDoc.mime_type,
          file_size: uploadedDoc.file_size,
          verified_at: uploadedDoc.verified_at,
          url,
          expires_in: url ? 300 : null,
        },
      });
    }

    const { data: generatedDoc, error: generatedError } =
      await supabaseAdmin
        .from("generated_documents")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("employee_id", employee.id)
        .eq("id", req.params.id)
        .maybeSingle();

    if (generatedError) {
      throw generatedError;
    }

    if (generatedDoc) {
      return res.json({
        document: {
          ...serializeGeneratedDocument(generatedDoc),
          content: generatedDoc.document_data?.content || {},
        },
      });
    }

    return res.status(404).json({
      message: "Document not found.",
    });
  } catch (error) {
    console.error("[EmployeeMyDocuments] GET /:id error:", error);

    return res.status(500).json({
      message: error?.message || "Could not load document.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/employee/documents
|--------------------------------------------------------------------------
| multipart/form-data: document_type, document_number (required for
| identity documents), notes (optional), file (required).
|--------------------------------------------------------------------------
*/

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const employee = req.employee;
    const organizationId = employee.organization_id;

    const documentType = clean(req.body?.document_type);
    const documentNumber = clean(req.body?.document_number) || null;
    const notes = clean(req.body?.notes) || null;

    if (!documentType) {
      return res.status(400).json({
        message: "document_type is required.",
      });
    }

    if (!SELF_UPLOADABLE_TYPES.includes(documentType)) {
      return res.status(400).json({
        message:
          "This document type is issued by HR and can't be self-uploaded.",
        allowed_types: SELF_UPLOADABLE_TYPES,
      });
    }

    if (NUMBER_REQUIRED_TYPES.includes(documentType) && !documentNumber) {
      return res.status(400).json({
        message: `${getDocumentTypeLabel(documentType)} number is required.`,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "A file is required.",
      });
    }

    const file = req.file;

    const extension =
      file.originalname.split(".").pop()?.toLowerCase() || "bin";

    const storageFileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${extension}`;

    const filePath = `${organizationId}/${employee.id}/${documentType}/${storageFileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(DOCUMENT_BUCKET)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error(
        "[EmployeeMyDocuments] Storage upload error:",
        uploadError
      );

      return res.status(500).json({
        message: "Could not upload document.",
      });
    }

    const documentNumberLast4 = documentNumber
      ? documentNumber.replace(/[\s-]/g, "").slice(-4)
      : null;

    const { data, error } = await supabaseAdmin
      .from("employee_documents")
      .insert({
        organization_id: organizationId,
        employee_id: employee.id,
        document_type: documentType,
        document_name: getDocumentTypeLabel(documentType),
        document_number: documentNumber,
        document_number_last4: documentNumberLast4,
        file_path: filePath,
        file_name: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
        status: "active",
        notes,
        verification_status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      console.error(
        "[EmployeeMyDocuments] Insert error:",
        error
      );

      // Don't leave an orphaned file behind if the DB insert failed.
      await supabaseAdmin.storage
        .from(DOCUMENT_BUCKET)
        .remove([filePath])
        .catch(() => {});

      return res.status(500).json({
        message: "Could not save document.",
      });
    }

    console.log(
      "[EmployeeMyDocuments] Document uploaded:",
      { employeeId: employee.id, documentId: data.id, documentType }
    );

    return res.status(201).json({
      document: serializeUploadedDocument(data),
    });
  } catch (error) {
    if (error?.message?.includes("Only JPG, PNG, WEBP and PDF")) {
      return res.status(400).json({ message: error.message });
    }

    console.error("[EmployeeMyDocuments] POST / error:", error);

    return res.status(500).json({
      message: error?.message || "Could not upload document.",
    });
  }
});

export default router;
