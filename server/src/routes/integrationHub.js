import { Router } from "express";
import crypto from "crypto";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

/* =========================================================
   CONFIGURATION
========================================================= */

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const REQUEST_TIMEOUT_MS = 10000;

const ALLOWED_INTEGRATION_TYPES = [
  "rest_api",
  "webhook",
  "custom",
];

const ALLOWED_AUTH_TYPES = [
  "none",
  "api_key",
  "bearer_token",
  "basic_auth",
];

const ALLOWED_SYNC_DIRECTIONS = [
  "inbound",
  "outbound",
  "bidirectional",
];

const ALLOWED_SYNC_FREQUENCIES = [
  "manual",
  "hourly",
  "daily",
  "weekly",
];

const ALLOWED_STATUSES = [
  "inactive",
  "active",
  "error",
  "testing",
];

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION
========================================================= */

async function requireOrganization(req, res, next) {
  try {
    if (req.organization?.id) {
      return next();
    }

    const organization = await getOrganizationForUser(
      req.user.id
    );

    if (!organization?.id) {
      return res.status(403).json({
        message: "Complete organization setup first.",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "[IntegrationHub] Organization lookup error:",
      error
    );

    return res.status(500).json({
      message: "Could not determine organization.",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   HELPERS
========================================================= */

function cleanString(value) {
  return String(value ?? "").trim();
}

function nullableString(value) {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function isValidUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "")
  );
}

function getOrganizationId(req) {
  return (
    req.organization?.id ||
    req.user?.organization_id ||
    req.user?.organizationId ||
    null
  );
}

/* =========================================================
   ENCRYPTION
========================================================= */

function getEncryptionKey() {
  const rawKey = cleanString(
    process.env.INTEGRATION_ENCRYPTION_KEY
  );

  if (!rawKey) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY is missing from server environment."
    );
  }

  try {
    const base64Key = Buffer.from(rawKey, "base64");

    if (base64Key.length === 32) {
      return base64Key;
    }
  } catch {
    // Continue with hex handling.
  }

  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  throw new Error(
    "INTEGRATION_ENCRYPTION_KEY must represent exactly 32 bytes."
  );
}

function encryptCredentials(credentials) {
  const key = getEncryptionKey();

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    key,
    iv
  );

  const plaintext = JSON.stringify(credentials || {});

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

function decryptCredentials(encryptedValue) {
  if (!encryptedValue) {
    return {};
  }

  const parts = String(encryptedValue).split(".");

  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted credentials format."
    );
  }

  const [
    ivBase64,
    authTagBase64,
    encryptedBase64,
  ] = parts;

  const key = getEncryptionKey();

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(
    authTagBase64,
    "base64"
  );
  const encrypted = Buffer.from(
    encryptedBase64,
    "base64"
  );

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    key,
    iv
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

/* =========================================================
   SAFE RESPONSE
========================================================= */

function sanitizeIntegration(integration) {
  if (!integration) {
    return null;
  }

  const {
    encrypted_credentials,
    ...safeIntegration
  } = integration;

  return {
    ...safeIntegration,
    has_credentials: Boolean(encrypted_credentials),
  };
}

/* =========================================================
   REQUEST TIMEOUT
========================================================= */

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = REQUEST_TIMEOUT_MS
) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return {
      response,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        `Connection request timed out after ${timeoutMs}ms.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   BUILD AUTH HEADERS
========================================================= */

function buildAuthHeaders(authType, credentials) {
  const headers = {
    Accept: "application/json",
  };

  if (authType === "api_key") {
    const keyName =
      cleanString(credentials?.key_name) ||
      "apikey";

    const keyValue = cleanString(
      credentials?.api_key
    );

    if (!keyValue) {
      throw new Error("API key is required.");
    }

    headers[keyName] = keyValue;
  }

  if (authType === "bearer_token") {
    const token = cleanString(
      credentials?.bearer_token
    );

    if (!token) {
      throw new Error(
        "Bearer token is required."
      );
    }

    headers.Authorization = `Bearer ${token}`;
  }

  if (authType === "basic_auth") {
    const username = cleanString(
      credentials?.username
    );

    const password = String(
      credentials?.password ?? ""
    );

    if (!username || !password) {
      throw new Error(
        "Username and password are required."
      );
    }

    const encoded = Buffer.from(
      `${username}:${password}`
    ).toString("base64");

    headers.Authorization = `Basic ${encoded}`;
  }

  return headers;
}

/* =========================================================
   VALIDATE URL
========================================================= */

function validateBaseUrl(value) {
  const url = cleanString(value);

  if (!url) {
    throw new Error("Base URL is required.");
  }

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      "Base URL must be a valid URL."
    );
  }

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:"
  ) {
    throw new Error(
      "Base URL must use HTTP or HTTPS."
    );
  }

  return parsed.toString();
}

/* =========================================================
   VALIDATE INTEGRATION INPUT
========================================================= */

function validateIntegrationInput(body, options = {}) {
  const name = cleanString(body.name);

  const provider = cleanString(body.provider);

  const description = nullableString(
    body.description
  );

  const integrationType =
    cleanString(body.integration_type) ||
    "rest_api";

  const authType =
    cleanString(body.auth_type) ||
    "none";

  const syncDirection =
    cleanString(body.sync_direction) ||
    "inbound";

  const syncFrequency =
    cleanString(body.sync_frequency) ||
    "manual";

  const status =
    cleanString(body.status) ||
    "inactive";

  if (!name) {
    throw new Error(
      "Integration name is required."
    );
  }

  if (!provider) {
    throw new Error(
      "Provider is required."
    );
  }

  if (
    !ALLOWED_INTEGRATION_TYPES.includes(
      integrationType
    )
  ) {
    throw new Error(
      "Invalid integration type."
    );
  }

  if (
    !ALLOWED_AUTH_TYPES.includes(authType)
  ) {
    throw new Error(
      "Invalid authentication type."
    );
  }

  if (
    !ALLOWED_SYNC_DIRECTIONS.includes(
      syncDirection
    )
  ) {
    throw new Error(
      "Invalid sync direction."
    );
  }

  if (
    !ALLOWED_SYNC_FREQUENCIES.includes(
      syncFrequency
    )
  ) {
    throw new Error(
      "Invalid sync frequency."
    );
  }

  if (
    !ALLOWED_STATUSES.includes(status)
  ) {
    throw new Error(
      "Invalid integration status."
    );
  }

  let baseUrl = nullableString(
    body.base_url
  );

  if (
    integrationType === "rest_api" ||
    baseUrl
  ) {
    baseUrl = validateBaseUrl(baseUrl);
  }

  const credentials =
    body.credentials &&
    typeof body.credentials === "object"
      ? body.credentials
      : {};

  if (authType === "api_key") {
    if (!cleanString(credentials.api_key)) {
      throw new Error("API key is required.");
    }
  }

  if (authType === "bearer_token") {
    if (
      !cleanString(
        credentials.bearer_token
      )
    ) {
      throw new Error(
        "Bearer token is required."
      );
    }
  }

  if (authType === "basic_auth") {
    if (
      !cleanString(credentials.username) ||
      !String(credentials.password ?? "")
    ) {
      throw new Error(
        "Username and password are required."
      );
    }
  }

  return {
    name,
    provider,
    description,
    integration_type: integrationType,
    base_url: baseUrl,
    auth_type: authType,
    sync_direction: syncDirection,
    sync_frequency: syncFrequency,
    status,
    credentials,
    encryptCredentials:
      options.encryptCredentials !== false,
  };
}

/* =========================================================
   SYNC LOG
========================================================= */

async function createSyncLog({
  organizationId,
  integrationId,
  operation,
  direction,
  status,
  httpStatus,
  durationMs,
  recordsProcessed = 0,
  message,
  errorDetails,
  startedAt,
  completedAt,
}) {
  const { error } = await supabaseAdmin
    .from("integration_sync_logs")
    .insert({
      organization_id: organizationId,
      integration_id: integrationId,
      operation,
      direction: direction || null,
      status,
      http_status: httpStatus ?? null,
      duration_ms: durationMs ?? null,
      records_processed: recordsProcessed,
      message: message || null,
      error_details: errorDetails || null,
      started_at:
        startedAt ||
        new Date().toISOString(),
      completed_at:
        completedAt ||
        new Date().toISOString(),
    });

  if (error) {
    console.error(
      "[IntegrationHub] Sync log insert failed:",
      error
    );
  }
}

/* =========================================================
   GET INTEGRATION
========================================================= */

async function getIntegrationForOrganization(
  integrationId,
  organizationId
) {
  const { data, error } =
    await supabaseAdmin
      .from("hr_integrations")
      .select("*")
      .eq("id", integrationId)
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
   NORMALIZE EXTERNAL EMPLOYEE RESPONSE
========================================================= */

function normalizeEmployeeResponse(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    payload &&
    Array.isArray(payload.employees)
  ) {
    return payload.employees;
  }

  if (
    payload &&
    Array.isArray(payload.data)
  ) {
    return payload.data;
  }

  if (
    payload &&
    Array.isArray(payload.results)
  ) {
    return payload.results;
  }

  if (
    payload &&
    Array.isArray(payload.records)
  ) {
    return payload.records;
  }

  return [];
}

/* =========================================================
   NORMALIZE EMPLOYEE
========================================================= */

function normalizeEmployee(
  employee,
  mappingLookup = []
) {
  const mapped = {};

  for (const mapping of mappingLookup) {
    if (!mapping.is_active) {
      continue;
    }

    const sourceValue =
      employee?.[mapping.source_field];

    if (
      sourceValue === undefined ||
      sourceValue === null
    ) {
      continue;
    }

    let value = sourceValue;

    const rule = cleanString(
      mapping.transform_rule
    );

    if (rule) {
      if (rule === "lowercase") {
        value = String(value).toLowerCase();
      }

      if (rule === "uppercase") {
        value = String(value).toUpperCase();
      }

      if (rule === "trim") {
        value = String(value).trim();
      }
    }

    mapped[mapping.target_field] = value;
  }

  /*
   * Fallback mappings for common HR employee APIs.
   */
  const employeeId =
    mapped.employee_id ??
    mapped.employeeId ??
    employee.employee_id ??
    employee.employeeId ??
    employee.id ??
    employee.employeeNumber ??
    employee.employee_number ??
    null;

  const name =
    mapped.name ??
    employee.name ??
    [
      employee.first_name,
      employee.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

  const email =
    mapped.email ??
    employee.email ??
    employee.work_email ??
    employee.workEmail ??
    null;

  const department =
    mapped.department ??
    employee.department ??
    employee.department_name ??
    employee.departmentName ??
    null;

  const jobTitle =
    mapped.job_title ??
    employee.job_title ??
    employee.jobTitle ??
    employee.position ??
    null;

  const phone =
    mapped.phone ??
    employee.phone ??
    employee.mobile ??
    employee.mobile_number ??
    null;

  return {
    ...mapped,

    employee_id: employeeId,
    name: name || null,
    email: email || null,
    department: department || null,
    job_title: jobTitle || null,
    phone: phone || null,
    source_data: employee,
  };
}

/* =========================================================
   UPSERT EMPLOYEE
========================================================= */

async function upsertEmployee(
  organizationId,
  employee
) {
  const employeeId = cleanString(
    employee.employee_id
  );

  const email = cleanString(
    employee.email
  ).toLowerCase();

  if (!employeeId && !email) {
    throw new Error(
      "Employee does not contain employee_id or email."
    );
  }

  /*
   * IMPORTANT:
   * Adjust this table name/columns only if your
   * existing employee table uses different names.
   */
  const employeeTable =
    "employees";

  let existing = null;

  if (employeeId) {
    const { data, error } =
      await supabaseAdmin
        .from(employeeTable)
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "employee_id",
          employeeId
        )
        .maybeSingle();

    if (error) {
      throw error;
    }

    existing = data;
  }

  if (!existing && email) {
    const { data, error } =
      await supabaseAdmin
        .from(employeeTable)
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .eq("email", email)
        .maybeSingle();

    if (error) {
      throw error;
    }

    existing = data;
  }

  const payload = {
    organization_id: organizationId,
    employee_id: employeeId || null,
    name: employee.name || null,
    email: email || null,
    department:
      employee.department || null,
    job_title:
      employee.job_title || null,
    phone: employee.phone || null,
    updated_at:
      new Date().toISOString(),
  };

  /*
   * Preserve source payload if the column exists
   * in your employee table.
   */
  payload.source_data =
    employee.source_data || null;

  if (existing?.id) {
    const { data, error } =
      await supabaseAdmin
        .from(employeeTable)
        .update(payload)
        .eq("id", existing.id)
        .eq(
          "organization_id",
          organizationId
        )
        .select("*")
        .single();

    if (error) {
      throw error;
    }

    return {
      action: "updated",
      employee: data,
    };
  }

  const { data, error } =
    await supabaseAdmin
      .from(employeeTable)
      .insert(payload)
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return {
    action: "created",
    employee: data,
  };
}

/* =========================================================
   GET /
   Dashboard data
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    const {
      data: integrations,
      error: integrationsError,
    } = await supabaseAdmin
      .from("hr_integrations")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .order("created_at", {
        ascending: false,
      });

    if (integrationsError) {
      console.error(
        "[IntegrationHub] Load integrations error:",
        integrationsError
      );

      return res.status(500).json({
        message:
          "Failed to load integrations.",
        error:
          integrationsError.message,
      });
    }

    const {
      data: logs,
      error: logsError,
    } = await supabaseAdmin
      .from("integration_sync_logs")
      .select(`
        *,
        hr_integrations (
          id,
          name,
          provider
        )
      `)
      .eq(
        "organization_id",
        organizationId
      )
      .order("started_at", {
        ascending: false,
      })
      .limit(20);

    if (logsError) {
      console.error(
        "[IntegrationHub] Load sync logs error:",
        logsError
      );

      return res.status(500).json({
        message:
          "Failed to load integration activity.",
        error:
          logsError.message,
      });
    }

    const safeIntegrations =
      (integrations || []).map(
        sanitizeIntegration
      );

    const total =
      safeIntegrations.length;

    const connected =
      safeIntegrations.filter(
        (item) =>
          item.status === "active"
      ).length;

    const errors =
      safeIntegrations.filter(
        (item) =>
          item.status === "error"
      ).length;

    const testing =
      safeIntegrations.filter(
        (item) =>
          item.status === "testing"
      ).length;

    const lastSuccessfulSync =
      safeIntegrations
        .map(
          (item) =>
            item.last_success_at
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            new Date(b) -
            new Date(a)
        )[0] || null;

    return res.status(200).json({
      integrations:
        safeIntegrations,

      activity:
        logs || [],

      statistics: {
        total,
        connected,
        errors,
        testing,

        inactive:
          safeIntegrations.filter(
            (item) =>
              item.status ===
              "inactive"
          ).length,

        last_successful_sync:
          lastSuccessfulSync,
      },
    });
  } catch (error) {
    console.error(
      "[IntegrationHub] Unexpected dashboard error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load Integration Hub.",
      error: error.message,
    });
  }
});

/* =========================================================
   POST /
   Create integration
========================================================= */

router.post("/", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    const validated =
      validateIntegrationInput(
        req.body || {}
      );

    const encryptedCredentials =
      encryptCredentials(
        validated.credentials
      );

    const insertPayload = {
      organization_id:
        organizationId,

      name:
        validated.name,

      provider:
        validated.provider,

      description:
        validated.description,

      integration_type:
        validated.integration_type,

      base_url:
        validated.base_url,

      auth_type:
        validated.auth_type,

      encrypted_credentials:
        encryptedCredentials,

      sync_direction:
        validated.sync_direction,

      sync_frequency:
        validated.sync_frequency,

      status:
        validated.status,

      created_by:
        req.user.id,
    };

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("hr_integrations")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error(
        "[IntegrationHub] Create integration error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to create integration.",
        error:
          error.message,
      });
    }

    return res.status(201).json({
      message:
        "Integration created successfully.",

      integration:
        sanitizeIntegration(data),
    });
  } catch (error) {
    console.error(
      "[IntegrationHub] Create integration unexpected error:",
      error
    );

    const status =
      error.message?.includes(
        "required"
      ) ||
      error.message?.includes(
        "valid"
      ) ||
      error.message?.includes(
        "Invalid"
      )
        ? 400
        : 500;

    return res.status(status).json({
      message:
        error.message ||
        "Failed to create integration.",
    });
  }
});

/* =========================================================
   GET /:id
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    const integrationId =
      req.params.id;

    if (!isValidUUID(integrationId)) {
      return res.status(400).json({
        message:
          "Invalid integration ID.",
      });
    }

    const integration =
      await getIntegrationForOrganization(
        integrationId,
        organizationId
      );

    if (!integration) {
      return res.status(404).json({
        message:
          "Integration not found.",
      });
    }

    const {
      data: mappings,
      error: mappingsError,
    } = await supabaseAdmin
      .from("integration_mappings")
      .select("*")
      .eq(
        "integration_id",
        integrationId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order("created_at", {
        ascending: true,
      });

    if (mappingsError) {
      return res.status(500).json({
        message:
          "Failed to load integration mappings.",
        error:
          mappingsError.message,
      });
    }

    return res.status(200).json({
      integration:
        sanitizeIntegration(
          integration
        ),

      mappings:
        mappings || [],
    });
  } catch (error) {
    console.error(
      "[IntegrationHub] Get integration error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load integration.",
      error: error.message,
    });
  }
});

/* =========================================================
   PUT /:id
========================================================= */

router.put("/:id", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    const integrationId =
      req.params.id;

    if (!isValidUUID(integrationId)) {
      return res.status(400).json({
        message:
          "Invalid integration ID.",
      });
    }

    const existing =
      await getIntegrationForOrganization(
        integrationId,
        organizationId
      );

    if (!existing) {
      return res.status(404).json({
        message:
          "Integration not found.",
      });
    }

    /*
     * If credentials are not supplied,
     * keep the existing encrypted credentials.
     */
    let credentials = {};

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "credentials"
      )
    ) {
      credentials =
        req.body.credentials || {};
    } else {
      credentials =
        decryptCredentials(
          existing.encrypted_credentials
        );
    }

    const validated =
      validateIntegrationInput({
        ...existing,
        ...req.body,
        credentials,
      });

    const updatePayload = {
      name:
        validated.name,

      provider:
        validated.provider,

      description:
        validated.description,

      integration_type:
        validated.integration_type,

      base_url:
        validated.base_url,

      auth_type:
        validated.auth_type,

      sync_direction:
        validated.sync_direction,

      sync_frequency:
        validated.sync_frequency,

      status:
        validated.status,

      updated_at:
        new Date().toISOString(),
    };

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "credentials"
      )
    ) {
      updatePayload.encrypted_credentials =
        encryptCredentials(
          validated.credentials
        );
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("hr_integrations")
      .update(updatePayload)
      .eq("id", integrationId)
      .eq(
        "organization_id",
        organizationId
      )
      .select("*")
      .single();

    if (error) {
      console.error(
        "[IntegrationHub] Update integration error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to update integration.",
        error:
          error.message,
      });
    }

    return res.status(200).json({
      message:
        "Integration updated successfully.",

      integration:
        sanitizeIntegration(data),
    });
  } catch (error) {
    console.error(
      "[IntegrationHub] Update integration unexpected error:",
      error
    );

    return res.status(400).json({
      message:
        error.message ||
        "Failed to update integration.",
    });
  }
});

/* =========================================================
   DELETE /:id
========================================================= */

router.delete("/:id", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    const integrationId =
      req.params.id;

    if (!isValidUUID(integrationId)) {
      return res.status(400).json({
        message:
          "Invalid integration ID.",
      });
    }

    const existing =
      await getIntegrationForOrganization(
        integrationId,
        organizationId
      );

    if (!existing) {
      return res.status(404).json({
        message:
          "Integration not found.",
      });
    }

    const { error } =
      await supabaseAdmin
        .from("hr_integrations")
        .delete()
        .eq("id", integrationId)
        .eq(
          "organization_id",
          organizationId
        );

    if (error) {
      console.error(
        "[IntegrationHub] Delete integration error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to delete integration.",
        error:
          error.message,
      });
    }

    return res.status(200).json({
      message:
        "Integration deleted successfully.",
    });
  } catch (error) {
    console.error(
      "[IntegrationHub] Delete integration error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to delete integration.",
      error: error.message,
    });
  }
});

/* =========================================================
   POST /:id/test
   Test actual external integration
========================================================= */

router.post("/:id/test", async (req, res) => {
  const startedAt = new Date();

  try {
    const organizationId =
      getOrganizationId(req);

    const integrationId =
      req.params.id;

    if (!isValidUUID(integrationId)) {
      return res.status(400).json({
        message:
          "Invalid integration ID.",
      });
    }

    const integration =
      await getIntegrationForOrganization(
        integrationId,
        organizationId
      );

    if (!integration) {
      return res.status(404).json({
        message:
          "Integration not found.",
      });
    }

    if (!integration.base_url) {
      return res.status(400).json({
        message:
          "This integration does not have a base URL to test.",
      });
    }

    const credentials =
      decryptCredentials(
        integration.encrypted_credentials
      );

    const headers =
      buildAuthHeaders(
        integration.auth_type,
        credentials
      );

    await supabaseAdmin
      .from("hr_integrations")
      .update({
        status: "testing",
        last_tested_at:
          startedAt.toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", integrationId)
      .eq(
        "organization_id",
        organizationId
      );

    const {
      response,
      durationMs,
    } = await fetchWithTimeout(
      integration.base_url,
      {
        method: "GET",
        headers,
      }
    );

    const responseText =
      await response.text();

    const success =
      response.ok;

    const message =
      success
        ? "Connection successful."
        : `Connection returned HTTP ${response.status}.`;

    await createSyncLog({
      organizationId,
      integrationId,
      operation:
        "connection_test",
      direction:
        integration.sync_direction,
      status:
        success
          ? "success"
          : "failed",
      httpStatus:
        response.status,
      durationMs,
      recordsProcessed: 0,
      message,
      errorDetails:
        success
          ? null
          : responseText.slice(
              0,
              2000
            ),
      startedAt:
        startedAt.toISOString(),
      completedAt:
        new Date().toISOString(),
    });

    await supabaseAdmin
      .from("hr_integrations")
      .update({
        status:
          success
            ? "active"
            : "error",

        last_tested_at:
          new Date().toISOString(),

        last_success_at:
          success
            ? new Date().toISOString()
            : integration.last_success_at,

        last_error:
          success
            ? null
            : responseText.slice(
                0,
                2000
              ),

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", integrationId)
      .eq(
        "organization_id",
        organizationId
      );

    return res.status(200).json({
      success,
      message,

      result: {
        http_status:
          response.status,

        duration_ms:
          durationMs,

        tested_at:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    const completedAt =
      new Date();

    console.error(
      "[IntegrationHub] Connection test failed:",
      error
    );

    const organizationId =
      getOrganizationId(req);

    const integrationId =
      req.params.id;

    if (
      isValidUUID(integrationId)
    ) {
      await createSyncLog({
        organizationId,
        integrationId,
        operation:
          "connection_test",
        status: "failed",
        message:
          "Connection test failed.",
        errorDetails:
          error.message,
        startedAt:
          startedAt.toISOString(),
        completedAt:
          completedAt.toISOString(),
      });

      await supabaseAdmin
        .from("hr_integrations")
        .update({
          status: "error",

          last_tested_at:
            completedAt.toISOString(),

          last_error:
            error.message,

          updated_at:
            completedAt.toISOString(),
        })
        .eq("id", integrationId)
        .eq(
          "organization_id",
          organizationId
        );
    }

    return res.status(200).json({
      success: false,

      message:
        error.message ||
        "Connection test failed.",

      result: {
        tested_at:
          completedAt.toISOString(),
      },
    });
  }
});

/* =========================================================
   GET /:id/logs
========================================================= */

router.get("/:id/logs", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    const integrationId =
      req.params.id;

    if (!isValidUUID(integrationId)) {
      return res.status(400).json({
        message:
          "Invalid integration ID.",
      });
    }

    const integration =
      await getIntegrationForOrganization(
        integrationId,
        organizationId
      );

    if (!integration) {
      return res.status(404).json({
        message:
          "Integration not found.",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("integration_sync_logs")
      .select("*")
      .eq(
        "integration_id",
        integrationId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order("started_at", {
        ascending: false,
      })
      .limit(100);

    if (error) {
      return res.status(500).json({
        message:
          "Failed to load integration logs.",
        error:
          error.message,
      });
    }

    return res.status(200).json({
      logs: data || [],
    });
  } catch (error) {
    console.error(
      "[IntegrationHub] Integration logs error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load integration logs.",
      error: error.message,
    });
  }
});

/* =========================================================
   MAPPINGS
========================================================= */

/*
 * GET /:id/mappings
 */

router.get(
  "/:id/mappings",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const integrationId =
        req.params.id;

      if (!isValidUUID(integrationId)) {
        return res.status(400).json({
          message:
            "Invalid integration ID.",
        });
      }

      const integration =
        await getIntegrationForOrganization(
          integrationId,
          organizationId
        );

      if (!integration) {
        return res.status(404).json({
          message:
            "Integration not found.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("integration_mappings")
        .select("*")
        .eq(
          "integration_id",
          integrationId
        )
        .eq(
          "organization_id",
          organizationId
        )
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        return res.status(500).json({
          message:
            "Failed to load mappings.",
          error:
            error.message,
        });
      }

      return res.status(200).json({
        mappings:
          data || [],
      });
    } catch (error) {
      console.error(
        "[IntegrationHub] Get mappings error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load mappings.",
        error: error.message,
      });
    }
  }
);

/*
 * POST /:id/mappings
 */

router.post(
  "/:id/mappings",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const integrationId =
        req.params.id;

      if (!isValidUUID(integrationId)) {
        return res.status(400).json({
          message:
            "Invalid integration ID.",
        });
      }

      const integration =
        await getIntegrationForOrganization(
          integrationId,
          organizationId
        );

      if (!integration) {
        return res.status(404).json({
          message:
            "Integration not found.",
        });
      }

      const sourceObject =
        cleanString(
          req.body?.source_object
        );

      const sourceField =
        cleanString(
          req.body?.source_field
        );

      const targetObject =
        cleanString(
          req.body?.target_object
        );

      const targetField =
        cleanString(
          req.body?.target_field
        );

      const direction =
        cleanString(
          req.body?.direction
        ) || "inbound";

      const transformRule =
        nullableString(
          req.body?.transform_rule
        );

      const isActive =
        req.body?.is_active !== false;

      if (
        !sourceObject ||
        !sourceField ||
        !targetObject ||
        !targetField
      ) {
        return res.status(400).json({
          message:
            "Source object, source field, target object, and target field are required.",
        });
      }

      if (
        ![
          "inbound",
          "outbound",
        ].includes(direction)
      ) {
        return res.status(400).json({
          message:
            "Invalid mapping direction.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("integration_mappings")
        .insert({
          organization_id:
            organizationId,

          integration_id:
            integrationId,

          source_object:
            sourceObject,

          source_field:
            sourceField,

          target_object:
            targetObject,

          target_field:
            targetField,

          direction,

          transform_rule:
            transformRule,

          is_active:
            isActive,
        })
        .select("*")
        .single();

      if (error) {
        console.error(
          "[IntegrationHub] Create mapping error:",
          error
        );

        return res.status(500).json({
          message:
            "Failed to create field mapping.",
          error:
            error.message,
        });
      }

      return res.status(201).json({
        message:
          "Field mapping created successfully.",

        mapping:
          data,
      });
    } catch (error) {
      console.error(
        "[IntegrationHub] Create mapping error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to create field mapping.",
        error: error.message,
      });
    }
  }
);

/*
 * PUT /:id/mappings/:mappingId
 */

router.put(
  "/:id/mappings/:mappingId",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const integrationId =
        req.params.id;

      const mappingId =
        req.params.mappingId;

      if (
        !isValidUUID(
          integrationId
        ) ||
        !isValidUUID(mappingId)
      ) {
        return res.status(400).json({
          message:
            "Invalid integration or mapping ID.",
        });
      }

      const {
        data: mapping,
        error:
          mappingLookupError,
      } = await supabaseAdmin
        .from("integration_mappings")
        .select("*")
        .eq("id", mappingId)
        .eq(
          "integration_id",
          integrationId
        )
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

      if (mappingLookupError) {
        return res.status(500).json({
          message:
            "Failed to find mapping.",
          error:
            mappingLookupError.message,
        });
      }

      if (!mapping) {
        return res.status(404).json({
          message:
            "Mapping not found.",
        });
      }

      const updatePayload = {
        updated_at:
          new Date().toISOString(),
      };

      const fields = [
        "source_object",
        "source_field",
        "target_object",
        "target_field",
        "direction",
        "transform_rule",
        "is_active",
      ];

      for (const field of fields) {
        if (
          Object.prototype.hasOwnProperty.call(
            req.body || {},
            field
          )
        ) {
          updatePayload[field] =
            req.body[field];
        }
      }

      if (
        updatePayload.direction &&
        ![
          "inbound",
          "outbound",
        ].includes(
          updatePayload.direction
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid mapping direction.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("integration_mappings")
        .update(updatePayload)
        .eq("id", mappingId)
        .eq(
          "integration_id",
          integrationId
        )
        .eq(
          "organization_id",
          organizationId
        )
        .select("*")
        .single();

      if (error) {
        return res.status(500).json({
          message:
            "Failed to update mapping.",
          error:
            error.message,
        });
      }

      return res.status(200).json({
        message:
          "Field mapping updated successfully.",

        mapping:
          data,
      });
    } catch (error) {
      console.error(
        "[IntegrationHub] Update mapping error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to update field mapping.",
        error: error.message,
      });
    }
  }
);

/*
 * DELETE /:id/mappings/:mappingId
 */

router.delete(
  "/:id/mappings/:mappingId",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const integrationId =
        req.params.id;

      const mappingId =
        req.params.mappingId;

      if (
        !isValidUUID(
          integrationId
        ) ||
        !isValidUUID(mappingId)
      ) {
        return res.status(400).json({
          message:
            "Invalid integration or mapping ID.",
        });
      }

      const {
        data: mapping,
        error: lookupError,
      } = await supabaseAdmin
        .from("integration_mappings")
        .select("id")
        .eq("id", mappingId)
        .eq(
          "integration_id",
          integrationId
        )
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

      if (lookupError) {
        return res.status(500).json({
          message:
            "Failed to find mapping.",
          error:
            lookupError.message,
        });
      }

      if (!mapping) {
        return res.status(404).json({
          message:
            "Mapping not found.",
        });
      }

      const { error } =
        await supabaseAdmin
          .from(
            "integration_mappings"
          )
          .delete()
          .eq(
            "id",
            mappingId
          )
          .eq(
            "integration_id",
            integrationId
          )
          .eq(
            "organization_id",
            organizationId
          );

      if (error) {
        return res.status(500).json({
          message:
            "Failed to delete mapping.",
          error:
            error.message,
        });
      }

      return res.status(200).json({
        message:
          "Field mapping deleted successfully.",
      });
    } catch (error) {
      console.error(
        "[IntegrationHub] Delete mapping error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to delete field mapping.",
        error: error.message,
      });
    }
  }
);

/* =========================================================
   POST /:id/sync-employees
   Synchronize employees from external HR system
========================================================= */

router.post(
  "/:id/sync-employees",
  async (req, res) => {
    const startedAt = new Date();

    try {
      const organizationId =
        getOrganizationId(req);

      const integrationId =
        req.params.id;

      if (!isValidUUID(integrationId)) {
        return res.status(400).json({
          message:
            "Invalid integration ID.",
        });
      }

      const integration =
        await getIntegrationForOrganization(
          integrationId,
          organizationId
        );

      if (!integration) {
        return res.status(404).json({
          message:
            "Integration not found.",
        });
      }

      if (!integration.base_url) {
        return res.status(400).json({
          message:
            "Integration does not have a base URL.",
        });
      }

      console.log(
        "[IntegrationHub] Starting employee synchronization."
      );

      /*
       * Load encrypted credentials.
       */
      const credentials =
        decryptCredentials(
          integration.encrypted_credentials
        );

      /*
       * Build authentication headers.
       */
      const headers =
        buildAuthHeaders(
          integration.auth_type,
          credentials
        );

      /*
       * Mark integration as testing.
       */
      await supabaseAdmin
        .from("hr_integrations")
        .update({
          status: "testing",
          last_tested_at:
            startedAt.toISOString(),
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", integrationId)
        .eq(
          "organization_id",
          organizationId
        );

      console.log(
        "[IntegrationHub] Fetching external employee records..."
      );

      const {
        response,
        durationMs,
      } = await fetchWithTimeout(
        integration.base_url,
        {
          method: "GET",
          headers,
        }
      );

      const responseText =
        await response.text();

      if (!response.ok) {
        throw new Error(
          `External employee API returned HTTP ${response.status}: ${responseText.slice(
            0,
            500
          )}`
        );
      }

      let payload;

      try {
        payload = responseText
          ? JSON.parse(responseText)
          : null;
      } catch {
        throw new Error(
          "External employee API returned invalid JSON."
        );
      }

      const externalEmployees =
        normalizeEmployeeResponse(
          payload
        );

      console.log(
        "[IntegrationHub] External employees received:",
        externalEmployees.length
      );

      if (!externalEmployees.length) {
        throw new Error(
          "External employee API returned zero employee records."
        );
      }

      /*
       * Load active mappings.
       */
      const {
        data: mappings,
        error: mappingsError,
      } = await supabaseAdmin
        .from("integration_mappings")
        .select("*")
        .eq(
          "integration_id",
          integrationId
        )
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "direction",
          "inbound"
        )
        .eq(
          "is_active",
          true
        )
        .order("created_at", {
          ascending: true,
        });

      if (mappingsError) {
        throw mappingsError;
      }

      let recordsCreated = 0;
      let recordsUpdated = 0;
      let recordsFailed = 0;

      const failures = [];

      /*
       * Convert each external employee
       * into the internal employee format.
       */
      for (
        let index = 0;
        index < externalEmployees.length;
        index += 1
      ) {
        const externalEmployee =
          externalEmployees[index];

        try {
          const normalized =
            normalizeEmployee(
              externalEmployee,
              mappings || []
            );

          const result =
            await upsertEmployee(
              organizationId,
              normalized
            );

          if (
            result.action ===
            "created"
          ) {
            recordsCreated += 1;

            console.log(
              "[IntegrationHub] Employee created:",
              normalized.employee_id ||
                normalized.email
            );
          }

          if (
            result.action ===
            "updated"
          ) {
            recordsUpdated += 1;

            console.log(
              "[IntegrationHub] Employee updated:",
              normalized.employee_id ||
                normalized.email
            );
          }
        } catch (employeeError) {
          recordsFailed += 1;

          failures.push({
            index,
            employee:
              externalEmployee,
            error:
              employeeError.message,
          });

          console.error(
            "[IntegrationHub] Employee synchronization failed:",
            {
              index,
              error:
                employeeError.message,
            }
          );
        }
      }

      const completedAt =
        new Date();

      const recordsProcessed =
        externalEmployees.length;

      const success =
        recordsFailed === 0;

      const message =
        success
          ? `Employee synchronization completed successfully. ${recordsCreated} created, ${recordsUpdated} updated.`
          : `Employee synchronization completed with errors. ${recordsCreated} created, ${recordsUpdated} updated, ${recordsFailed} failed.`;

      /*
       * Log synchronization.
       */
      await createSyncLog({
        organizationId,
        integrationId,
        operation:
          "employee_sync",
        direction:
          "inbound",
        status:
          success
            ? "success"
            : "failed",
        httpStatus:
          response.status,
        durationMs,
        recordsProcessed,
        message,
        errorDetails:
          failures.length
            ? JSON.stringify(
                failures
              ).slice(
                0,
                10000
              )
            : null,
        startedAt:
          startedAt.toISOString(),
        completedAt:
          completedAt.toISOString(),
      });

      /*
       * Update integration state.
       */
      await supabaseAdmin
        .from("hr_integrations")
        .update({
          status:
            success
              ? "active"
              : "error",

          last_tested_at:
            completedAt.toISOString(),

          last_success_at:
            success
              ? completedAt.toISOString()
              : integration.last_success_at,

          last_error:
            success
              ? null
              : `${recordsFailed} employee record(s) failed during synchronization.`,

          updated_at:
            completedAt.toISOString(),
        })
        .eq("id", integrationId)
        .eq(
          "organization_id",
          organizationId
        );

      return res.status(
        success ? 200 : 207
      ).json({
        success,
        message,

        statistics: {
          external_records:
            externalEmployees.length,

          records_processed:
            recordsProcessed,

          records_created:
            recordsCreated,

          records_updated:
            recordsUpdated,

          records_failed:
            recordsFailed,
        },

        failures,

        synced_at:
          completedAt.toISOString(),
      });
    } catch (error) {
      const completedAt =
        new Date();

      console.error(
        "[IntegrationHub] Employee synchronization failed:",
        error
      );

      const organizationId =
        getOrganizationId(req);

      const integrationId =
        req.params.id;

      if (
        isValidUUID(
          integrationId
        )
      ) {
        await createSyncLog({
          organizationId,
          integrationId,
          operation:
            "employee_sync",
          direction:
            "inbound",
          status:
            "failed",
          recordsProcessed: 0,
          message:
            "Employee synchronization failed.",
          errorDetails:
            error.message,
          startedAt:
            startedAt.toISOString(),
          completedAt:
            completedAt.toISOString(),
        });

        await supabaseAdmin
          .from("hr_integrations")
          .update({
            status: "error",

            last_tested_at:
              completedAt.toISOString(),

            last_error:
              error.message,

            updated_at:
              completedAt.toISOString(),
          })
          .eq(
            "id",
            integrationId
          )
          .eq(
            "organization_id",
            organizationId
          );
      }

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Employee synchronization failed.",

        statistics: {
          external_records: 0,
          records_processed: 0,
          records_created: 0,
          records_updated: 0,
          records_failed: 0,
        },

        synced_at:
          completedAt.toISOString(),
      });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;