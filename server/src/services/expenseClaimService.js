import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   HELPERS
========================================================= */

function serviceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function money(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function nonNegativeMoney(value) {
  return Math.max(0, money(value));
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function normalizeCurrency(currency) {
  return String(currency || "INR")
    .trim()
    .toUpperCase()
    .slice(0, 3);
}

function normalizeDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function getErrorMessage(error) {
  return (
    error?.message ||
    error?.details ||
    error?.hint ||
    "An unexpected error occurred."
  );
}

function ensureOrganization(organizationId) {
  if (!organizationId) {
    throw serviceError(
      "Organization is required.",
      400,
    );
  }
}

function ensureEmployee(employeeId) {
  if (!employeeId) {
    throw serviceError(
      "Employee is required.",
      400,
    );
  }
}

/* =========================================================
   CLAIM NUMBER
========================================================= */

async function generateClaimNumber(
  organizationId,
) {
  const year = new Date().getFullYear();

  const prefix = `EXP-${year}-`;

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("expense_claims")
    .select("claim_number")
    .eq(
      "organization_id",
      organizationId,
    )
    .like(
      "claim_number",
      `${prefix}%`,
    )
    .order(
      "created_at",
      {
        ascending: false,
      },
    )
    .limit(1);

  if (error) {
    throw error;
  }

  let sequence = 1;

  if (
    Array.isArray(data) &&
    data.length > 0
  ) {
    const latest =
      String(
        data[0].claim_number || "",
      );

    const match =
      latest.match(
        new RegExp(
          `^EXP-${year}-(\\d+)$`,
        ),
      );

    if (match) {
      sequence =
        Number(match[1]) + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(5, "0")}`;
}

/* =========================================================
   EMPLOYEE
========================================================= */

export async function getExpenseEmployee({
  organizationId,
  employeeId,
}) {
  ensureOrganization(
    organizationId,
  );

  ensureEmployee(
    employeeId,
  );

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("employees")
    .select(`
      id,
      full_name,
      email,
      department,
      title,
      employee_code,
      employment_status
    `)
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      employeeId,
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw serviceError(
      "Employee not found.",
      404,
    );
  }

  return data;
}

/* =========================================================
   CATEGORIES
========================================================= */

export async function getExpenseCategories({
  organizationId,
  includeInactive = false,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  let query =
    supabaseAdmin
      .from("expense_categories")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .order(
        "name",
        {
          ascending: true,
        },
      );

  if (!includeInactive) {
    query = query.eq(
      "is_active",
      true,
    );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function createExpenseCategory({
  organizationId,
  userId = null,
  name,
  description = null,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  const normalizedName =
    String(name || "")
      .trim();

  if (!normalizedName) {
    throw serviceError(
      "Category name is required.",
      400,
    );
  }

  const {
    data: existing,
    error: existingError,
  } =
    await supabaseAdmin
      .from(
        "expense_categories",
      )
      .select("id")
      .eq(
        "organization_id",
        organizationId,
      )
      .ilike(
        "name",
        normalizedName,
      )
      .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    throw serviceError(
      "An expense category with this name already exists.",
      409,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "expense_categories",
      )
      .insert({
        organization_id:
          organizationId,

        name:
          normalizedName,

        description:
          description
            ? String(
                description,
              ).trim()
            : null,

        created_by:
          userId || null,
      })
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateExpenseCategory({
  organizationId,
  categoryId,
  name,
  description,
  isActive,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  if (!categoryId) {
    throw serviceError(
      "Category ID is required.",
      400,
    );
  }

  const patch = {};

  if (
    name !== undefined
  ) {
    const normalizedName =
      String(name || "")
        .trim();

    if (!normalizedName) {
      throw serviceError(
        "Category name is required.",
        400,
      );
    }

    patch.name =
      normalizedName;
  }

  if (
    description !== undefined
  ) {
    patch.description =
      description
        ? String(
            description,
          ).trim()
        : null;
  }

  if (
    isActive !== undefined
  ) {
    patch.is_active =
      Boolean(isActive);
  }

  if (
    Object.keys(patch).length === 0
  ) {
    throw serviceError(
      "No category changes were supplied.",
      400,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "expense_categories",
      )
      .update(patch)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        categoryId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   POLICY VALIDATION
========================================================= */

function validateExpenseItem({
  amount,
  receiptRequired,
  receiptAttached,
}) {
  const numericAmount =
    nonNegativeMoney(
      amount,
    );

  const warnings = [];
  const violations = [];

  if (numericAmount <= 0) {
    violations.push(
      "Expense amount must be greater than zero.",
    );
  }

  if (
    receiptRequired &&
    !receiptAttached
  ) {
    warnings.push(
      "A receipt is required for this expense.",
    );
  }

  let policyStatus =
    "compliant";

  if (violations.length > 0) {
    policyStatus =
      "violation";
  } else if (
    warnings.length > 0
  ) {
    policyStatus =
      "warning";
  }

  return {
    policyStatus,
    policyMessage:
      [
        ...violations,
        ...warnings,
      ].join(" "),
  };
}

/* =========================================================
   CLAIM ITEMS
========================================================= */

async function getClaimItems(
  organizationId,
  claimId,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "expense_claim_items",
      )
      .select(`
        *,
        expense_categories (
          id,
          name,
          description
        )
      `)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "claim_id",
        claimId,
      )
      .order(
        "expense_date",
        {
          ascending: true,
        },
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      );

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}

async function refreshClaimTotals({
  organizationId,
  claimId,
}) {
  const items =
    await getClaimItems(
      organizationId,
      claimId,
    );

  const totalAmount =
    money(
      items.reduce(
        (sum, item) =>
          sum +
          nonNegativeMoney(
            item.amount,
          ),
        0,
      ),
    );

  const approvedAmount =
    money(
      items.reduce(
        (sum, item) =>
          sum +
          nonNegativeMoney(
            item.approved_amount,
          ),
        0,
      ),
    );

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("expense_claims")
      .update({
        total_amount:
          totalAmount,

        approved_amount:
          approvedAmount,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function addExpenseClaimItem({
  organizationId,
  claimId,
  categoryId = null,
  expenseDate,
  merchantName = null,
  description,
  amount,
  currencyCode = "INR",
  approvedAmount = null,
  receiptRequired = false,
  receiptAttached = false,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  if (!claimId) {
    throw serviceError(
      "Claim ID is required.",
      400,
    );
  }

  const date =
    normalizeDate(
      expenseDate,
    );

  if (!date) {
    throw serviceError(
      "A valid expense date is required.",
      400,
    );
  }

  const normalizedDescription =
    String(
      description || "",
    ).trim();

  if (
    !normalizedDescription
  ) {
    throw serviceError(
      "Expense description is required.",
      400,
    );
  }

  const numericAmount =
    nonNegativeMoney(
      amount,
    );

  if (
    numericAmount <= 0
  ) {
    throw serviceError(
      "Expense amount must be greater than zero.",
      400,
    );
  }

  const policy =
    validateExpenseItem({
      amount:
        numericAmount,

      receiptRequired:
        Boolean(
          receiptRequired,
        ),

      receiptAttached:
        Boolean(
          receiptAttached,
        ),
    });

  if (
    policy.policyStatus ===
    "violation"
  ) {
    throw serviceError(
      policy.policyMessage,
      422,
    );
  }

  let normalizedApproved =
    numericAmount;

  if (
    approvedAmount !== null &&
    approvedAmount !== undefined
  ) {
    normalizedApproved =
      Math.min(
        numericAmount,
        nonNegativeMoney(
          approvedAmount,
        ),
      );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "expense_claim_items",
      )
      .insert({
        organization_id:
          organizationId,

        claim_id:
          claimId,

        category_id:
          categoryId || null,

        expense_date:
          date,

        merchant_name:
          merchantName
            ? String(
                merchantName,
              ).trim()
            : null,

        description:
          normalizedDescription,

        amount:
          numericAmount,

        currency_code:
          normalizeCurrency(
            currencyCode,
          ),

        approved_amount:
          normalizedApproved,

        receipt_required:
          Boolean(
            receiptRequired,
          ),

        receipt_attached:
          Boolean(
            receiptAttached,
          ),

        policy_status:
          policy.policyStatus,

        policy_message:
          policy.policyMessage ||
          null,
      })
      .select(`
        *,
        expense_categories (
          id,
          name,
          description
        )
      `)
      .single();

  if (error) {
    throw error;
  }

  await refreshClaimTotals({
    organizationId,
    claimId,
  });

  return data;
}

export async function updateExpenseClaimItem({
  organizationId,
  claimItemId,
  categoryId,
  expenseDate,
  merchantName,
  description,
  amount,
  currencyCode,
  approvedAmount,
  receiptRequired,
  receiptAttached,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  if (!claimItemId) {
    throw serviceError(
      "Claim item ID is required.",
      400,
    );
  }

  const patch = {};

  if (
    expenseDate !== undefined
  ) {
    const date =
      normalizeDate(
        expenseDate,
      );

    if (!date) {
      throw serviceError(
        "A valid expense date is required.",
        400,
      );
    }

    patch.expense_date =
      date;
  }

  if (
    description !== undefined
  ) {
    const value =
      String(
        description || "",
      ).trim();

    if (!value) {
      throw serviceError(
        "Expense description is required.",
        400,
      );
    }

    patch.description =
      value;
  }

  if (
    merchantName !== undefined
  ) {
    patch.merchant_name =
      merchantName
        ? String(
            merchantName,
          ).trim()
        : null;
  }

  if (
    categoryId !== undefined
  ) {
    patch.category_id =
      categoryId || null;
  }

  if (
    amount !== undefined
  ) {
    const numericAmount =
      nonNegativeMoney(
        amount,
      );

    if (
      numericAmount <= 0
    ) {
      throw serviceError(
        "Expense amount must be greater than zero.",
        400,
      );
    }

    patch.amount =
      numericAmount;
  }

  if (
    currencyCode !== undefined
  ) {
    patch.currency_code =
      normalizeCurrency(
        currencyCode,
      );
  }

  if (
    approvedAmount !== undefined
  ) {
    patch.approved_amount =
      nonNegativeMoney(
        approvedAmount,
      );
  }

  if (
    receiptRequired !== undefined
  ) {
    patch.receipt_required =
      Boolean(
        receiptRequired,
      );
  }

  if (
    receiptAttached !== undefined
  ) {
    patch.receipt_attached =
      Boolean(
        receiptAttached,
      );
  }

  if (
    Object.keys(patch).length === 0
  ) {
    throw serviceError(
      "No expense changes were supplied.",
      400,
    );
  }

  const {
    data: existing,
    error: existingError,
  } =
    await supabaseAdmin
      .from(
        "expense_claim_items",
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimItemId,
      )
      .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    throw serviceError(
      "Expense item not found.",
      404,
    );
  }

  const merged = {
    ...existing,
    ...patch,
  };

  const policy =
    validateExpenseItem({
      amount:
        merged.amount,

      receiptRequired:
        merged.receipt_required,

      receiptAttached:
        merged.receipt_attached,
    });

  if (
    policy.policyStatus ===
    "violation"
  ) {
    throw serviceError(
      policy.policyMessage,
      422,
    );
  }

  patch.policy_status =
    policy.policyStatus;

  patch.policy_message =
    policy.policyMessage ||
    null;

  if (
    patch.approved_amount !==
      undefined &&
    patch.approved_amount >
      merged.amount
  ) {
    patch.approved_amount =
      merged.amount;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "expense_claim_items",
      )
      .update(patch)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimItemId,
      )
      .select(`
        *,
        expense_categories (
          id,
          name,
          description
        )
      `)
      .single();

  if (error) {
    throw error;
  }

  await refreshClaimTotals({
    organizationId,
    claimId:
      existing.claim_id,
  });

  return data;
}

export async function deleteExpenseClaimItem({
  organizationId,
  claimItemId,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  if (!claimItemId) {
    throw serviceError(
      "Claim item ID is required.",
      400,
    );
  }

  const {
    data: item,
    error: itemError,
  } =
    await supabaseAdmin
      .from(
        "expense_claim_items",
      )
      .select(
        "id, claim_id",
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimItemId,
      )
      .maybeSingle();

  if (itemError) {
    throw itemError;
  }

  if (!item) {
    throw serviceError(
      "Expense item not found.",
      404,
    );
  }

  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "expense_claim_items",
      )
      .delete()
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimItemId,
      );

  if (error) {
    throw error;
  }

  await refreshClaimTotals({
    organizationId,
    claimId:
      item.claim_id,
  });

  return {
    success: true,
    claimId:
      item.claim_id,
  };
}

/* =========================================================
   CLAIM EVENTS
========================================================= */

async function recordClaimEvent({
  organizationId,
  claimId,
  eventType,
  oldStatus = null,
  newStatus = null,
  message = null,
  metadata = {},
  performedBy = null,
}) {
  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "expense_claim_events",
      )
      .insert({
        organization_id:
          organizationId,

        claim_id:
          claimId,

        event_type:
          eventType,

        old_status:
          oldStatus,

        new_status:
          newStatus,

        message:
          message,

        metadata:
          metadata || {},

        performed_by:
          performedBy || null,
      });

  if (error) {
    throw error;
  }
}

/* =========================================================
   CLAIM RETRIEVAL
========================================================= */

export async function getExpenseClaim({
  organizationId,
  claimId,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  if (!claimId) {
    throw serviceError(
      "Claim ID is required.",
      400,
    );
  }

  const {
    data: claim,
    error: claimError,
  } =
    await supabaseAdmin
      .from("expense_claims")
      .select(`
        *,
        employees (
          id,
          full_name,
          email,
          department,
          title,
          employee_code,
          employment_status
        )
      `)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimId,
      )
      .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  if (!claim) {
    throw serviceError(
      "Expense claim not found.",
      404,
    );
  }

  const [
    items,
    receipts,
    approvals,
    events,
  ] =
    await Promise.all([
      getClaimItems(
        organizationId,
        claimId,
      ),

      getClaimReceipts({
        organizationId,
        claimId,
      }),

      getClaimApprovals({
        organizationId,
        claimId,
      }),

      getClaimEvents({
        organizationId,
        claimId,
      }),
    ]);

  return {
    ...claim,

    items,

    receipts,

    approvals,

    events,
  };
}

export async function getExpenseClaims({
  organizationId,
  employeeId = null,
  status = null,
  search = "",
  fromDate = null,
  toDate = null,
  page = 1,
  pageSize = 20,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  const safePage =
    Math.max(
      1,
      Number(page) || 1,
    );

  const safePageSize =
    Math.min(
      100,
      Math.max(
        1,
        Number(pageSize) || 20,
      ),
    );

  const from =
    (safePage - 1) *
    safePageSize;

  const to =
    from +
    safePageSize -
    1;

  let query =
    supabaseAdmin
      .from("expense_claims")
      .select(`
        *,
        employees (
          id,
          full_name,
          email,
          department,
          title,
          employee_code,
          employment_status
        )
      `, {
        count: "exact",
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .range(
        from,
        to,
      );

  if (employeeId) {
    query =
      query.eq(
        "employee_id",
        employeeId,
      );
  }

  if (status) {
    query =
      query.eq(
        "status",
        normalizeStatus(
          status,
        ),
      );
  }

  if (fromDate) {
    const normalized =
      normalizeDate(
        fromDate,
      );

    if (normalized) {
      query =
        query.gte(
          "claim_date",
          normalized,
        );
    }
  }

  if (toDate) {
    const normalized =
      normalizeDate(
        toDate,
      );

    if (normalized) {
      query =
        query.lte(
          "claim_date",
          normalized,
        );
    }
  }

  if (
    String(search || "").trim()
  ) {
    const value =
      String(search).trim();

    query =
      query.or(
        `claim_number.ilike.%${value}%,title.ilike.%${value}%,description.ilike.%${value}%`,
      );
  }

  const {
    data,
    error,
    count,
  } = await query;

  if (error) {
    throw error;
  }

  return {
    claims:
      Array.isArray(data)
        ? data
        : [],

    pagination: {
      page:
        safePage,

      pageSize:
        safePageSize,

      total:
        count || 0,

      totalPages:
        Math.ceil(
          (count || 0) /
            safePageSize,
        ),
    },
  };
}

/* =========================================================
   CREATE CLAIM
========================================================= */

export async function createExpenseClaim({
  organizationId,
  userId = null,
  employeeId,
  title,
  description = null,
  claimDate,
  currencyCode = "INR",
  notes = null,
  items = [],
} = {}) {
  ensureOrganization(
    organizationId,
  );

  ensureEmployee(
    employeeId,
  );

  await getExpenseEmployee({
    organizationId,
    employeeId,
  });

  const normalizedTitle =
    String(title || "")
      .trim();

  if (!normalizedTitle) {
    throw serviceError(
      "Claim title is required.",
      400,
    );
  }

  const date =
    normalizeDate(
      claimDate ||
        new Date(),
    );

  if (!date) {
    throw serviceError(
      "A valid claim date is required.",
      400,
    );
  }

  const claimNumber =
    await generateClaimNumber(
      organizationId,
    );

  const {
    data: claim,
    error: claimError,
  } =
    await supabaseAdmin
      .from("expense_claims")
      .insert({
        organization_id:
          organizationId,

        employee_id:
          employeeId,

        claim_number:
          claimNumber,

        title:
          normalizedTitle,

        description:
          description
            ? String(
                description,
              ).trim()
            : null,

        claim_date:
          date,

        currency_code:
          normalizeCurrency(
            currencyCode,
          ),

        status:
          "draft",

        notes:
          notes
            ? String(
                notes,
              ).trim()
            : null,

        created_by:
          userId || null,
      })
      .select("*")
      .single();

  if (claimError) {
    throw claimError;
  }

  try {
    if (
      Array.isArray(items) &&
      items.length > 0
    ) {
      for (
        const item of items
      ) {
        await addExpenseClaimItem({
          organizationId,

          claimId:
            claim.id,

          categoryId:
            item.categoryId ||
            item.category_id ||
            null,

          expenseDate:
            item.expenseDate ||
            item.expense_date ||
            date,

          merchantName:
            item.merchantName ||
            item.merchant_name ||
            null,

          description:
            item.description,

          amount:
            item.amount,

          currencyCode:
            item.currencyCode ||
            item.currency_code ||
            currencyCode,

          approvedAmount:
            item.approvedAmount ??
            item.approved_amount ??
            null,

          receiptRequired:
            item.receiptRequired ??
            item.receipt_required ??
            false,

          receiptAttached:
            item.receiptAttached ??
            item.receipt_attached ??
            false,
        });
      }
    }

    await recordClaimEvent({
      organizationId,

      claimId:
        claim.id,

      eventType:
        "claim_created",

      newStatus:
        "draft",

      message:
        "Expense claim created.",

      performedBy:
        userId,
    });

    return await getExpenseClaim({
      organizationId,
      claimId:
        claim.id,
    });
  } catch (error) {
    await supabaseAdmin
      .from("expense_claims")
      .delete()
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claim.id,
      );

    throw error;
  }
}

/* =========================================================
   UPDATE CLAIM
========================================================= */

export async function updateExpenseClaim({
  organizationId,
  userId = null,
  claimId,
  title,
  description,
  claimDate,
  currencyCode,
  notes,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  if (!claimId) {
    throw serviceError(
      "Claim ID is required.",
      400,
    );
  }

  const {
    data: existing,
    error: existingError,
  } =
    await supabaseAdmin
      .from("expense_claims")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimId,
      )
      .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    throw serviceError(
      "Expense claim not found.",
      404,
    );
  }

  if (
    ![
      "draft",
      "rejected",
    ].includes(
      normalizeStatus(
        existing.status,
      ),
    )
  ) {
    throw serviceError(
      "Only draft or rejected claims can be edited.",
      409,
    );
  }

  const patch = {};

  if (
    title !== undefined
  ) {
    const normalized =
      String(
        title || "",
      ).trim();

    if (!normalized) {
      throw serviceError(
        "Claim title is required.",
        400,
      );
    }

    patch.title =
      normalized;
  }

  if (
    description !== undefined
  ) {
    patch.description =
      description
        ? String(
            description,
          ).trim()
        : null;
  }

  if (
    claimDate !== undefined
  ) {
    const date =
      normalizeDate(
        claimDate,
      );

    if (!date) {
      throw serviceError(
        "A valid claim date is required.",
        400,
      );
    }

    patch.claim_date =
      date;
  }

  if (
    currencyCode !== undefined
  ) {
    patch.currency_code =
      normalizeCurrency(
        currencyCode,
      );
  }

  if (
    notes !== undefined
  ) {
    patch.notes =
      notes
        ? String(
            notes,
          ).trim()
        : null;
  }

  if (
    existing.status ===
    "rejected"
  ) {
    patch.status =
      "draft";

    patch.rejection_reason =
      null;

    patch.rejected_at =
      null;

    patch.rejected_by =
      null;
  }

  if (
    Object.keys(patch).length === 0
  ) {
    throw serviceError(
      "No claim changes were supplied.",
      400,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("expense_claims")
      .update(patch)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  await recordClaimEvent({
    organizationId,

    claimId,

    eventType:
      "claim_updated",

    oldStatus:
      existing.status,

    newStatus:
      data.status,

    message:
      "Expense claim updated.",

    performedBy:
      userId,
  });

  return await getExpenseClaim({
    organizationId,
    claimId,
  });
}

/* =========================================================
   SUBMIT CLAIM
========================================================= */

export async function submitExpenseClaim({
  organizationId,
  userId = null,
  claimId,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  if (!claimId) {
    throw serviceError(
      "Claim ID is required.",
      400,
    );
  }

  const claim =
    await getExpenseClaim({
      organizationId,
      claimId,
    });

  if (
    ![
      "draft",
      "rejected",
    ].includes(
      normalizeStatus(
        claim.status,
      ),
    )
  ) {
    throw serviceError(
      "Only draft or rejected claims can be submitted.",
      409,
    );
  }

  if (
    !Array.isArray(
      claim.items,
    ) ||
    claim.items.length === 0
  ) {
    throw serviceError(
      "Add at least one expense item before submitting the claim.",
      422,
    );
  }

  const totalAmount =
    money(
      claim.items.reduce(
        (sum, item) =>
          sum +
          nonNegativeMoney(
            item.amount,
          ),
        0,
      ),
    );

  if (
    totalAmount <= 0
  ) {
    throw serviceError(
      "Claim amount must be greater than zero.",
      422,
    );
  }

  const policyViolations =
    claim.items.filter(
      (item) =>
        item.policy_status ===
        "violation",
    );

  if (
    policyViolations.length > 0
  ) {
    throw serviceError(
      "The claim contains expense items that violate policy.",
      422,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("expense_claims")
      .update({
        status:
          "submitted",

        submitted_at:
          new Date().toISOString(),

        submitted_by:
          userId || null,

        rejection_reason:
          null,

        rejected_at:
          null,

        rejected_by:
          null,
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  await recordClaimEvent({
    organizationId,

    claimId,

    eventType:
      "claim_submitted",

    oldStatus:
      claim.status,

    newStatus:
      "submitted",

    message:
      "Expense claim submitted for approval.",

    performedBy:
      userId,
  });

  return await getExpenseClaim({
    organizationId,
    claimId,
  });
}

/* =========================================================
   APPROVALS
========================================================= */

export async function getClaimApprovals({
  organizationId,
  claimId,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("expense_approvals")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "claim_id",
        claimId,
      )
      .order(
        "approval_level",
        {
          ascending: true,
        },
      );

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}

async function ensureApprovalRecord({
  organizationId,
  claimId,
  approverId,
}) {
  const existing =
    await getClaimApprovals({
      organizationId,
      claimId,
    });

  if (
    existing.length > 0
  ) {
    return existing;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("expense_approvals")
      .insert({
        organization_id:
          organizationId,

        claim_id:
          claimId,

        approver_id:
          approverId || null,

        approval_level:
          1,

        status:
          "pending",
      })
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return [data];
}

/* =========================================================
   APPROVE CLAIM
========================================================= */

export async function approveExpenseClaim({
  organizationId,
  userId = null,
  claimId,
  approvedAmount = null,
  comments = null,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  if (!claimId) {
    throw serviceError(
      "Claim ID is required.",
      400,
    );
  }

  const claim =
    await getExpenseClaim({
      organizationId,
      claimId,
    });

  if (
    ![
      "submitted",
      "under_review",
      "partially_approved",
    ].includes(
      normalizeStatus(
        claim.status,
      ),
    )
  ) {
    throw serviceError(
      "This claim cannot be approved in its current status.",
      409,
    );
  }

  const claimTotal =
    nonNegativeMoney(
      claim.total_amount,
    );

  const amount =
    approvedAmount === null ||
    approvedAmount === undefined
      ? claimTotal
      : Math.min(
          claimTotal,
          nonNegativeMoney(
            approvedAmount,
          ),
        );

  if (amount <= 0) {
    throw serviceError(
      "Approved amount must be greater than zero.",
      422,
    );
  }

  const nextStatus =
    amount < claimTotal
      ? "partially_approved"
      : "approved";

  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("expense_claims")
      .update({
        status:
          nextStatus,

        approved_amount:
          amount,

        approved_at:
          now,

        approved_by:
          userId || null,
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  await ensureApprovalRecord({
    organizationId,

    claimId,

    approverId:
      userId,
  });

  await supabaseAdmin
    .from("expense_approvals")
    .update({
      status:
        "approved",

      comments:
        comments
          ? String(
              comments,
            ).trim()
          : null,

      acted_at:
        now,
    })
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "claim_id",
      claimId,
    )
    .eq(
      "approval_level",
      1,
    );

  await recordClaimEvent({
    organizationId,

    claimId,

    eventType:
      "claim_approved",

    oldStatus:
      claim.status,

    newStatus:
      nextStatus,

    message:
      amount < claimTotal
        ? `Expense claim partially approved for ${amount}.`
        : "Expense claim approved.",

    metadata: {
      approvedAmount:
        amount,

      comments:
        comments || null,
    },

    performedBy:
      userId,
  });

  return await getExpenseClaim({
    organizationId,
    claimId,
  });
}

/* =========================================================
   REJECT CLAIM
========================================================= */

export async function rejectExpenseClaim({
  organizationId,
  userId = null,
  claimId,
  reason,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  if (!claimId) {
    throw serviceError(
      "Claim ID is required.",
      400,
    );
  }

  const normalizedReason =
    String(
      reason || "",
    ).trim();

  if (!normalizedReason) {
    throw serviceError(
      "Rejection reason is required.",
      422,
    );
  }

  const claim =
    await getExpenseClaim({
      organizationId,
      claimId,
    });

  if (
    ![
      "submitted",
      "under_review",
      "partially_approved",
    ].includes(
      normalizeStatus(
        claim.status,
      ),
    )
  ) {
    throw serviceError(
      "This claim cannot be rejected in its current status.",
      409,
    );
  }

  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("expense_claims")
      .update({
        status:
          "rejected",

        rejected_at:
          now,

        rejected_by:
          userId || null,

        rejection_reason:
          normalizedReason,
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  await ensureApprovalRecord({
    organizationId,

    claimId,

    approverId:
      userId,
  });

  await supabaseAdmin
    .from("expense_approvals")
    .update({
      status:
        "rejected",

      comments:
        normalizedReason,

      acted_at:
        now,
    })
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "claim_id",
      claimId,
    )
    .eq(
      "approval_level",
      1,
    );

  await recordClaimEvent({
    organizationId,

    claimId,

    eventType:
      "claim_rejected",

    oldStatus:
      claim.status,

    newStatus:
      "rejected",

    message:
      normalizedReason,

    performedBy:
      userId,
  });

  return await getExpenseClaim({
    organizationId,
    claimId,
  });
}

/* =========================================================
   MARK UNDER REVIEW
========================================================= */

export async function reviewExpenseClaim({
  organizationId,
  userId = null,
  claimId,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  const claim =
    await getExpenseClaim({
      organizationId,
      claimId,
    });

  if (
    claim.status !==
    "submitted"
  ) {
    throw serviceError(
      "Only submitted claims can be moved under review.",
      409,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("expense_claims")
      .update({
        status:
          "under_review",
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  await ensureApprovalRecord({
    organizationId,

    claimId,

    approverId:
      userId,
  });

  await recordClaimEvent({
    organizationId,

    claimId,

    eventType:
      "claim_under_review",

    oldStatus:
      claim.status,

    newStatus:
      "under_review",

    message:
      "Expense claim moved under review.",

    performedBy:
      userId,
  });

  return data;
}

/* =========================================================
   PAYMENT
========================================================= */

export async function markExpenseClaimPaid({
  organizationId,
  userId = null,
  claimId,
  paymentReference = null,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  const claim =
    await getExpenseClaim({
      organizationId,
      claimId,
    });

  if (
    ![
      "approved",
      "partially_approved",
    ].includes(
      normalizeStatus(
        claim.status,
      ),
    )
  ) {
    throw serviceError(
      "Only approved claims can be marked as paid.",
      409,
    );
  }

  const amount =
    nonNegativeMoney(
      claim.approved_amount,
    );

  if (amount <= 0) {
    throw serviceError(
      "Approved amount must be greater than zero before payment.",
      422,
    );
  }

  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("expense_claims")
      .update({
        status:
          "paid",

        reimbursed_amount:
          amount,

        paid_at:
          now,

        paid_by:
          userId || null,

        payment_reference:
          paymentReference
            ? String(
                paymentReference,
              ).trim()
            : null,

        payroll_reconciliation_status:
          "queued",
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  await recordClaimEvent({
    organizationId,

    claimId,

    eventType:
      "claim_paid",

    oldStatus:
      claim.status,

    newStatus:
      "paid",

    message:
      "Expense claim marked as paid.",

    metadata: {
      reimbursedAmount:
        amount,

      paymentReference:
        paymentReference || null,
    },

    performedBy:
      userId,
  });

  return await getExpenseClaim({
    organizationId,
    claimId,
  });
}

/* =========================================================
   PAYROLL RECONCILIATION
========================================================= */

export async function reconcileExpenseClaim({
  organizationId,
  userId = null,
  claimId,
  payrollRunId,
  payrollRunItemId = null,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  const claim =
    await getExpenseClaim({
      organizationId,
      claimId,
    });

  if (
    ![
      "paid",
      "approved",
      "partially_approved",
    ].includes(
      normalizeStatus(
        claim.status,
      ),
    )
  ) {
    throw serviceError(
      "Only approved or paid claims can be reconciled.",
      409,
    );
  }

  if (!payrollRunId) {
    throw serviceError(
      "Payroll run is required for reconciliation.",
      400,
    );
  }

  const {
    data: payrollRun,
    error: payrollRunError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select(
        "id, payroll_month, status",
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        payrollRunId,
      )
      .maybeSingle();

  if (payrollRunError) {
    throw payrollRunError;
  }

  if (!payrollRun) {
    throw serviceError(
      "Payroll run not found.",
      404,
    );
  }

  let resolvedItemId =
    payrollRunItemId ||
    null;

  if (!resolvedItemId) {
    const {
      data: item,
      error: itemError,
    } =
      await supabaseAdmin
        .from(
          "payroll_run_items",
        )
        .select("id")
        .eq(
          "organization_id",
          organizationId,
        )
        .eq(
          "payroll_run_id",
          payrollRunId,
        )
        .eq(
          "employee_id",
          claim.employee_id,
        )
        .maybeSingle();

    if (itemError) {
      throw itemError;
    }

    if (!item) {
      throw serviceError(
        "No payroll item exists for this employee in the selected payroll run.",
        422,
      );
    }

    resolvedItemId =
      item.id;
  }

  const {
    data: payrollItem,
    error: payrollItemError,
  } =
    await supabaseAdmin
      .from(
        "payroll_run_items",
      )
      .select(
        "id, employee_id, reimbursements",
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_id",
        payrollRunId,
      )
      .eq(
        "id",
        resolvedItemId,
      )
      .maybeSingle();

  if (payrollItemError) {
    throw payrollItemError;
  }

  if (!payrollItem) {
    throw serviceError(
      "Payroll item not found.",
      404,
    );
  }

  if (
    payrollItem.employee_id !==
    claim.employee_id
  ) {
    throw serviceError(
      "The selected payroll item does not belong to the claim employee.",
      422,
    );
  }

  const reimbursement =
    nonNegativeMoney(
      claim.approved_amount ||
        claim.reimbursed_amount,
    );

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("expense_claims")
      .update({
        payroll_run_id:
          payrollRunId,

        payroll_run_item_id:
          resolvedItemId,

        payroll_reconciliation_status:
          "reconciled",

        reimbursed_amount:
          Math.max(
            nonNegativeMoney(
              claim.reimbursed_amount,
            ),
            reimbursement,
          ),

        status:
          "reconciled",

        reconciled_at:
          new Date().toISOString(),

        reconciled_by:
          userId || null,
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  await recordClaimEvent({
    organizationId,

    claimId,

    eventType:
      "claim_reconciled",

    oldStatus:
      claim.status,

    newStatus:
      "reconciled",

    message:
      "Expense claim reconciled against payroll.",

    metadata: {
      payrollRunId,

      payrollRunItemId:
        resolvedItemId,

      payrollMonth:
        payrollRun.payroll_month,

      amount:
        reimbursement,
    },

    performedBy:
      userId,
  });

  return await getExpenseClaim({
    organizationId,
    claimId,
  });
}

/* =========================================================
   RECEIPTS
========================================================= */

export async function getClaimReceipts({
  organizationId,
  claimId,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "expense_receipts",
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "claim_id",
        claimId,
      )
      .order(
        "uploaded_at",
        {
          ascending: true,
        },
      );

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function addExpenseReceipt({
  organizationId,
  userId = null,
  claimId,
  claimItemId = null,
  fileName,
  filePath,
  fileType = null,
  fileSize = null,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  if (!claimId) {
    throw serviceError(
      "Claim ID is required.",
      400,
    );
  }

  if (!fileName) {
    throw serviceError(
      "Receipt file name is required.",
      400,
    );
  }

  if (!filePath) {
    throw serviceError(
      "Receipt file path is required.",
      400,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "expense_receipts",
      )
      .insert({
        organization_id:
          organizationId,

        claim_id:
          claimId,

        claim_item_id:
          claimItemId || null,

        file_name:
          String(
            fileName,
          ).trim(),

        file_path:
          String(
            filePath,
          ).trim(),

        file_type:
          fileType || null,

        file_size:
          fileSize
            ? Number(fileSize)
            : null,

        uploaded_by:
          userId || null,
      })
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  if (claimItemId) {
    await supabaseAdmin
      .from(
        "expense_claim_items",
      )
      .update({
        receipt_attached:
          true,
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimItemId,
      );
  }

  await recordClaimEvent({
    organizationId,

    claimId,

    eventType:
      "receipt_uploaded",

    message:
      "Expense receipt uploaded.",

    metadata: {
      receiptId:
        data.id,

      fileName:
        data.file_name,
    },

    performedBy:
      userId,
  });

  return data;
}

export async function deleteExpenseReceipt({
  organizationId,
  userId = null,
  receiptId,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  if (!receiptId) {
    throw serviceError(
      "Receipt ID is required.",
      400,
    );
  }

  const {
    data: receipt,
    error: receiptError,
  } =
    await supabaseAdmin
      .from(
        "expense_receipts",
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        receiptId,
      )
      .maybeSingle();

  if (receiptError) {
    throw receiptError;
  }

  if (!receipt) {
    throw serviceError(
      "Receipt not found.",
      404,
    );
  }

  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "expense_receipts",
      )
      .delete()
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        receiptId,
      );

  if (error) {
    throw error;
  }

  if (receipt.claim_item_id) {
    const {
      data: remaining,
    } =
      await supabaseAdmin
        .from(
          "expense_receipts",
        )
        .select("id")
        .eq(
          "organization_id",
          organizationId,
        )
        .eq(
          "claim_item_id",
          receipt.claim_item_id,
        );

    if (
      !Array.isArray(
        remaining,
      ) ||
      remaining.length === 0
    ) {
      await supabaseAdmin
        .from(
          "expense_claim_items",
        )
        .update({
          receipt_attached:
            false,
        })
        .eq(
          "organization_id",
          organizationId,
        )
        .eq(
          "id",
          receipt.claim_item_id,
        );
    }
  }

  await recordClaimEvent({
    organizationId,

    claimId:
      receipt.claim_id,

    eventType:
      "receipt_deleted",

    message:
      "Expense receipt deleted.",

    metadata: {
      receiptId:
        receipt.id,

      fileName:
        receipt.file_name,
    },

    performedBy:
      userId,
  });

  return {
    success: true,
  };
}

/* =========================================================
   EVENTS
========================================================= */

export async function getClaimEvents({
  organizationId,
  claimId,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "expense_claim_events",
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "claim_id",
        claimId,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      );

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}

/* =========================================================
   CANCEL CLAIM
========================================================= */

export async function cancelExpenseClaim({
  organizationId,
  userId = null,
  claimId,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  const claim =
    await getExpenseClaim({
      organizationId,
      claimId,
    });

  if (
    [
      "paid",
      "reconciled",
      "cancelled",
    ].includes(
      normalizeStatus(
        claim.status,
      ),
    )
  ) {
    throw serviceError(
      "This claim cannot be cancelled.",
      409,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("expense_claims")
      .update({
        status:
          "cancelled",
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  await recordClaimEvent({
    organizationId,

    claimId,

    eventType:
      "claim_cancelled",

    oldStatus:
      claim.status,

    newStatus:
      "cancelled",

    message:
      "Expense claim cancelled.",

    performedBy:
      userId,
  });

  return data;
}

/* =========================================================
   DELETE DRAFT CLAIM
========================================================= */

export async function deleteExpenseClaim({
  organizationId,
  claimId,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  const claim =
    await getExpenseClaim({
      organizationId,
      claimId,
    });

  if (
    claim.status !==
    "draft"
  ) {
    throw serviceError(
      "Only draft claims can be deleted.",
      409,
    );
  }

  const {
    error,
  } =
    await supabaseAdmin
      .from("expense_claims")
      .delete()
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        claimId,
      );

  if (error) {
    throw error;
  }

  return {
    success: true,
  };
}

/* =========================================================
   DASHBOARD SUMMARY
========================================================= */

export async function getExpenseSummary({
  organizationId,
  fromDate = null,
  toDate = null,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  let query =
    supabaseAdmin
      .from("expense_claims")
      .select(`
        id,
        employee_id,
        total_amount,
        approved_amount,
        reimbursed_amount,
        status,
        payroll_reconciliation_status,
        claim_date
      `)
      .eq(
        "organization_id",
        organizationId,
      );

  if (fromDate) {
    const date =
      normalizeDate(
        fromDate,
      );

    if (date) {
      query =
        query.gte(
          "claim_date",
          date,
        );
    }
  }

  if (toDate) {
    const date =
      normalizeDate(
        toDate,
      );

    if (date) {
      query =
        query.lte(
          "claim_date",
          date,
        );
    }
  }

  const {
    data,
    error,
  } =
    await query;

  if (error) {
    throw error;
  }

  const claims =
    Array.isArray(data)
      ? data
      : [];

  const summary = {
    totalClaims:
      claims.length,

    draft:
      0,

    submitted:
      0,

    underReview:
      0,

    approved:
      0,

    partiallyApproved:
      0,

    rejected:
      0,

    paid:
      0,

    reconciled:
      0,

    cancelled:
      0,

    totalAmount:
      0,

    approvedAmount:
      0,

    reimbursedAmount:
      0,

    pendingAmount:
      0,

    unreconciledAmount:
      0,
  };

  for (
    const claim of claims
  ) {
    const status =
      normalizeStatus(
        claim.status,
      );

    switch (status) {
      case "draft":
        summary.draft += 1;
        break;

      case "submitted":
        summary.submitted += 1;
        break;

      case "under_review":
        summary.underReview += 1;
        break;

      case "approved":
        summary.approved += 1;
        break;

      case "partially_approved":
        summary.partiallyApproved += 1;
        break;

      case "rejected":
        summary.rejected += 1;
        break;

      case "paid":
        summary.paid += 1;
        break;

      case "reconciled":
        summary.reconciled += 1;
        break;

      case "cancelled":
        summary.cancelled += 1;
        break;

      default:
        break;
    }

    summary.totalAmount +=
      nonNegativeMoney(
        claim.total_amount,
      );

    summary.approvedAmount +=
      nonNegativeMoney(
        claim.approved_amount,
      );

    summary.reimbursedAmount +=
      nonNegativeMoney(
        claim.reimbursed_amount,
      );

    if (
      [
        "submitted",
        "under_review",
        "approved",
        "partially_approved",
      ].includes(status)
    ) {
      summary.pendingAmount +=
        nonNegativeMoney(
          claim.total_amount,
        ) -
        nonNegativeMoney(
          claim.reimbursed_amount,
        );
    }

    if (
      claim.payroll_reconciliation_status !==
      "reconciled"
    ) {
      summary.unreconciledAmount +=
        nonNegativeMoney(
          claim.approved_amount,
        ) -
        nonNegativeMoney(
          claim.reimbursed_amount,
        );
    }
  }

  summary.totalAmount =
    money(
      summary.totalAmount,
    );

  summary.approvedAmount =
    money(
      summary.approvedAmount,
    );

  summary.reimbursedAmount =
    money(
      summary.reimbursedAmount,
    );

  summary.pendingAmount =
    money(
      Math.max(
        0,
        summary.pendingAmount,
      ),
    );

  summary.unreconciledAmount =
    money(
      Math.max(
        0,
        summary.unreconciledAmount,
      ),
    );

  return summary;
}

/* =========================================================
   EMPLOYEE SELF-SERVICE
========================================================= */

export async function getEmployeeExpenseClaims({
  organizationId,
  employeeId,
  status = null,
  page = 1,
  pageSize = 20,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  ensureEmployee(
    employeeId,
  );

  return getExpenseClaims({
    organizationId,

    employeeId,

    status,

    page,

    pageSize,
  });
}

/* =========================================================
   PAYROLL RECONCILIATION QUEUE
========================================================= */

export async function getPayrollReconciliationQueue({
  organizationId,
  payrollRunId = null,
} = {}) {
  ensureOrganization(
    organizationId,
  );

  let query =
    supabaseAdmin
      .from("expense_claims")
      .select(`
        *,
        employees (
          id,
          full_name,
          email,
          department,
          employee_code
        )
      `)
      .eq(
        "organization_id",
        organizationId,
      )
      .in(
        "payroll_reconciliation_status",
        [
          "queued",
          "included",
        ],
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      );

  if (payrollRunId) {
    query =
      query.eq(
        "payroll_run_id",
        payrollRunId,
      );
  }

  const {
    data,
    error,
  } =
    await query;

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}

/* =========================================================
   CLAIM STATISTICS
========================================================= */

export async function getExpenseStatistics({
  organizationId,
} = {}) {
  const summary =
    await getExpenseSummary({
      organizationId,
    });

  const {
    data: categories,
    error,
  } =
    await supabaseAdmin
      .from(
        "expense_claim_items",
      )
      .select(`
        amount,
        category_id,
        expense_categories (
          id,
          name
        )
      `)
      .eq(
        "organization_id",
        organizationId,
      );

  if (error) {
    throw error;
  }

  const categoryTotals =
    {};

  for (
    const item of
      categories || []
  ) {
    const name =
      item?.expense_categories
        ?.name ||
      "Uncategorized";

    if (
      !categoryTotals[name]
    ) {
      categoryTotals[name] =
        0;
    }

    categoryTotals[name] +=
      nonNegativeMoney(
        item.amount,
      );
  }

  const topCategories =
    Object.entries(
      categoryTotals,
    )
      .map(
        ([name, amount]) => ({
          name,

          amount:
            money(amount),
        }),
      )
      .sort(
        (a, b) =>
          b.amount -
          a.amount,
      );

  return {
    ...summary,

    topCategories,
  };
}