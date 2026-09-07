import { Router } from "express";
import multer from "multer";

import { requireAuth } from "../middleware/auth.js";
import { resolveEmployee as requireEmployee } from "../middleware/resolveEmployee.js";
import { supabaseAdmin } from "../config/supabase.js";

import {
  getExpenseCategories,
  getEmployeeExpenseClaims,
  getExpenseClaim,
  createExpenseClaim,
  submitExpenseClaim,
  addExpenseReceipt,
} from "../services/expenseClaimService.js";

const router = Router();

router.use(requireAuth);
router.use(requireEmployee);

/*
|--------------------------------------------------------------------------
| EMPLOYEE REIMBURSEMENTS
|--------------------------------------------------------------------------
|
| GET  /api/employee/reimbursements
| GET  /api/employee/reimbursements/:id
| GET  /api/employee/reimbursements/:id/receipts/:receiptId
| POST /api/employee/reimbursements
|
| req.employee is set by requireEmployee and is ALREADY scoped to the
| authenticated user — every query below uses req.employee.id, never a
| client-supplied employee id.
|
| Claim creation, item validation, and the submit workflow all call the
| same services/expenseClaimService.js functions routes/expenseClaims.js
| already uses — nothing here re-implements that logic. The one thing
| that genuinely doesn't exist anywhere in the codebase yet is a real
| file upload for receipts (the existing expense receipt route only
| persists metadata "after a file has been stored" — see
| addExpenseReceipt). For the actual upload we mirror the one real
| upload pattern that does exist (routes/documents.js's
| employeeDocumentUpload: multer memoryStorage, 5MB limit, JPG/PNG/
| WEBP/PDF only, private "employee-documents" bucket + signed URLs for
| viewing) rather than inventing a new one.
|--------------------------------------------------------------------------
*/

const RECEIPT_BUCKET = "employee-documents";

const receiptUpload = multer({
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

function handleRouteError(res, error, fallbackMessage) {
  console.error("[EmployeeReimbursements]", error);

  return res.status(error?.statusCode || error?.status || 500).json({
    message: error?.message || fallbackMessage,
  });
}

function clean(value) {
  return String(value ?? "").trim();
}

function serializeListItem(claim) {
  return {
    id: claim.id,
    claim_number: claim.claim_number,
    title: claim.title,
    claim_date: claim.claim_date,
    total_amount: claim.total_amount,
    approved_amount: claim.approved_amount,
    currency_code: claim.currency_code,
    status: claim.status,
    category:
      Array.isArray(claim.items) && claim.items[0]
        ? claim.items[0].expense_categories?.name || null
        : null,
    created_at: claim.created_at,
    submitted_at: claim.submitted_at,
  };
}

function belongsToEmployee(claim, employeeId) {
  return claim && claim.employee_id === employeeId;
}

/*
|--------------------------------------------------------------------------
| GET /api/employee/reimbursements
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const employee = req.employee;

    const result = await getEmployeeExpenseClaims({
      organizationId: employee.organization_id,
      employeeId: employee.id,
      status: clean(req.query.status) || null,
      page: 1,
      pageSize: 100,
    });

    // Category is per line item; the list is cheap for an employee's
    // own claims (single-item, low volume), so batch-load items for
    // just this page of claims rather than adding an N+1 per row.
    const claimIds = (result.claims || []).map((claim) => claim.id);

    let itemsByClaim = new Map();

    if (claimIds.length > 0) {
      const { data: items, error: itemsError } = await supabaseAdmin
        .from("expense_claim_items")
        .select(`
          claim_id,
          expense_categories ( name )
        `)
        .in("claim_id", claimIds)
        .order("created_at", { ascending: true });

      if (itemsError) {
        throw itemsError;
      }

      itemsByClaim = new Map();

      (items || []).forEach((item) => {
        if (!itemsByClaim.has(item.claim_id)) {
          itemsByClaim.set(item.claim_id, []);
        }

        itemsByClaim.get(item.claim_id).push(item);
      });
    }

    const claims = (result.claims || []).map((claim) =>
      serializeListItem({
        ...claim,
        items: itemsByClaim.get(claim.id) || [],
      })
    );

    return res.json({ claims, pagination: result.pagination });
  } catch (error) {
    return handleRouteError(
      res,
      error,
      "Could not load reimbursement claims."
    );
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/employee/reimbursements/:id
|--------------------------------------------------------------------------
*/

router.get("/:id", async (req, res) => {
  try {
    const employee = req.employee;

    const claim = await getExpenseClaim({
      organizationId: employee.organization_id,
      claimId: req.params.id,
    });

    if (!belongsToEmployee(claim, employee.id)) {
      return res.status(404).json({
        message: "Reimbursement claim not found.",
      });
    }

    return res.json({ claim });
  } catch (error) {
    if (error?.statusCode === 404 || error?.status === 404) {
      return res.status(404).json({
        message: "Reimbursement claim not found.",
      });
    }

    return handleRouteError(
      res,
      error,
      "Could not load reimbursement claim."
    );
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/employee/reimbursements/:id/receipts/:receiptId
|--------------------------------------------------------------------------
| Returns a short-lived signed URL for viewing/downloading a receipt,
| the same pattern documents.js uses for employee documents — the
| storage bucket stays private, nothing gets a permanent public URL.
|--------------------------------------------------------------------------
*/

router.get("/:id/receipts/:receiptId", async (req, res) => {
  try {
    const employee = req.employee;

    const claim = await getExpenseClaim({
      organizationId: employee.organization_id,
      claimId: req.params.id,
    });

    if (!belongsToEmployee(claim, employee.id)) {
      return res.status(404).json({
        message: "Reimbursement claim not found.",
      });
    }

    const receipt = (claim.receipts || []).find(
      (item) => item.id === req.params.receiptId
    );

    if (!receipt) {
      return res.status(404).json({
        message: "Receipt not found.",
      });
    }

    const { data: signedUrlData, error: signedUrlError } =
      await supabaseAdmin.storage
        .from(RECEIPT_BUCKET)
        .createSignedUrl(receipt.file_path, 60 * 5);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error(
        "[EmployeeReimbursements] Signed URL error:",
        signedUrlError
      );

      return res.status(500).json({
        message: "Could not generate receipt viewing link.",
      });
    }

    return res.json({
      file_name: receipt.file_name,
      file_type: receipt.file_type,
      file_size: receipt.file_size,
      url: signedUrlData.signedUrl,
      expires_in: 300,
    });
  } catch (error) {
    if (error?.statusCode === 404 || error?.status === 404) {
      return res.status(404).json({
        message: "Reimbursement claim not found.",
      });
    }

    return handleRouteError(
      res,
      error,
      "Could not open receipt."
    );
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/employee/reimbursements
|--------------------------------------------------------------------------
| multipart/form-data: category_id, amount, description, expense_date,
| receipt (optional file).
|
| Creates a draft claim with a single item via createExpenseClaim (the
| exact function HR-side claim creation uses), uploads the receipt (if
| any) to storage and records it via addExpenseReceipt, then submits
| the claim via submitExpenseClaim — the same workflow function that
| enforces "at least one item", "amount > 0", and "no policy
| violations" for every other submission path in the app.
|--------------------------------------------------------------------------
*/

router.post("/", receiptUpload.single("receipt"), async (req, res) => {
  try {
    const employee = req.employee;
    const organizationId = employee.organization_id;

    const body = req.body || {};

    const categoryId = clean(
      body.categoryId || body.category_id
    );

    const description = clean(body.description);

    const amount = Number(body.amount);

    const expenseDate = clean(
      body.expenseDate || body.expense_date || body.date
    );

    if (!description) {
      return res.status(400).json({
        message: "Description is required.",
      });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        message: "A valid amount greater than zero is required.",
      });
    }

    if (!expenseDate) {
      return res.status(400).json({
        message: "Expense date is required.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate category against the org's actual active categories
    |--------------------------------------------------------------------------
    */

    if (categoryId) {
      const categories = await getExpenseCategories({
        organizationId,
      });

      const validCategory = categories.some(
        (category) => category.id === categoryId
      );

      if (!validCategory) {
        return res.status(400).json({
          message: "Invalid expense category.",
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Create the claim + single item (draft)
    |--------------------------------------------------------------------------
    */

    let claim = await createExpenseClaim({
      organizationId,
      userId: req.user.id,
      employeeId: employee.id,
      title: description,
      claimDate: expenseDate,
      items: [
        {
          categoryId: categoryId || null,
          expenseDate,
          description,
          amount,
          receiptAttached: Boolean(req.file),
        },
      ],
    });

    /*
    |--------------------------------------------------------------------------
    | Upload receipt (optional)
    |--------------------------------------------------------------------------
    */

    let receiptWarning = null;

    if (req.file) {
      try {
        const file = req.file;

        const extension =
          file.originalname.split(".").pop()?.toLowerCase() || "bin";

        const storageFileName = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}.${extension}`;

        const filePath = `${organizationId}/${employee.id}/expense-receipts/${claim.id}/${storageFileName}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from(RECEIPT_BUCKET)
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        const claimItemId = claim.items?.[0]?.id || null;

        await addExpenseReceipt({
          organizationId,
          userId: req.user.id,
          claimId: claim.id,
          claimItemId,
          fileName: file.originalname,
          filePath,
          fileType: file.mimetype,
          fileSize: file.size,
        });
      } catch (receiptError) {
        console.error(
          "[EmployeeReimbursements] Receipt upload failed:",
          receiptError
        );

        receiptWarning =
          "The claim was created, but the receipt could not be uploaded.";
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Submit (draft -> submitted)
    |--------------------------------------------------------------------------
    */

    claim = await submitExpenseClaim({
      organizationId,
      userId: req.user.id,
      claimId: claim.id,
    });

    console.log(
      "[EmployeeReimbursements] Claim submitted:",
      { employeeId: employee.id, claimId: claim.id }
    );

    return res.status(201).json({
      claim,
      ...(receiptWarning ? { warning: receiptWarning } : {}),
    });
  } catch (error) {
    if (error?.message?.includes("Only JPG, PNG, WEBP and PDF")) {
      return res.status(400).json({ message: error.message });
    }

    return handleRouteError(
      res,
      error,
      "Could not submit reimbursement claim."
    );
  }
});

export default router;
