import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| AUTHENTICATION
|--------------------------------------------------------------------------
*/

router.use(requireAuth);

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function optional(value) {
  const valueString = clean(value);
  return valueString || null;
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function normalizeUrl(value) {
  const url = clean(value);

  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/*
|--------------------------------------------------------------------------
| ALLOWED VALUES
|--------------------------------------------------------------------------
*/

const ALLOWED_INTEGRATION_TYPES = [
  "rest_api",
  "webhook",
  "database",
  "file",
  "custom",
];

const ALLOWED_AUTH_TYPES = [
  "none",
  "api_key",
  "bearer",
  "basic",
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

const ALLOWED_INTEGRATION_STATUSES = [
  "active",
  "inactive",
  "error",
];

const ALLOWED_MAPPING_DIRECTIONS = [
  "inbound",
  "outbound",
];

const ALLOWED_LOG_STATUSES = [
  "success",
  "failed",
  "running",
  "skipped",
];

/*
|--------------------------------------------------------------------------
| ORGANIZATION RESOLUTION
|--------------------------------------------------------------------------
|
| We intentionally use the same organization resolution pattern already
| used by the existing protected routes.
|
*/

async function resolveOrganization(req) {
  /*
   * Existing middleware may already provide the organization.
   */

  if (req.organization?.id) {
    return {
      id: req.organization.id,
      role: req.organization.role || null,
    };
  }

  /*
   * Existing auth middleware may provide organization_id.
   */

  if (req.user?.organization_id) {
    return {
      id: req.user.organization_id,
      role: req.user.organization_role || null,
    };
  }

  if (req.user?.organizationId) {
    return {
      id: req.user.organizationId,
      role: req.user.organization_role || null,
    };
  }

  /*
   * Final fallback:
   * resolve organization through organization_members.
   */

  const userId = req.user?.id;

  if (!userId) {
    console.error(
      "[Integrations] Authenticated user ID is missing."
    );

    return null;
  }

  const {
    data: membership,
    error,
  } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id, user_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[Integrations] Organization membership lookup failed:",
      error
    );

    throw error;
  }

  if (!membership?.organization_id) {
    console.error(
      "[Integrations] No organization membership found:",
      userId
    );

    return null;
  }

  return {
    id: membership.organization_id,
    role: membership.role || null,
  };
}

/*
|--------------------------------------------------------------------------
| ORGANIZATION MIDDLEWARE
|--------------------------------------------------------------------------
*/

router.use(async (req, res, next) => {
  try {
    const organization = await resolveOrganization(req);

    if (!organization?.id) {
      return res.status(403).json({
        message:
          "Authenticated user is not associated with an organization.",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "[Integrations] Organization resolution error:",
      error
    );

    return res.status(500).json({
      message: "Could not determine organization.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| ORGANIZATION ID
|--------------------------------------------------------------------------
*/

function getOrganizationId(req) {
  return (
    req.organization?.id ||
    req.user?.organization_id ||
    req.user?.organizationId ||
    null
  );
}

/*
|--------------------------------------------------------------------------
| SAFE INTEGRATION RESPONSE
|--------------------------------------------------------------------------
|
| Credentials are NEVER returned to the browser.
|--------------------------------------------------------------------------
*/

function sanitizeIntegration(integration) {
  if (!integration) {
    return integration;
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

/*
|--------------------------------------------------------------------------
| GET /api/integrations
|--------------------------------------------------------------------------
|
| Return all integrations for the authenticated organization.
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization could not be determined.",
      });
    }

    const search = clean(req.query.search).toLowerCase();
    const status = clean(req.query.status).toLowerCase();

    let query = supabaseAdmin
      .from("hr_integrations")
      .select(
        `
        id,
        organization_id,
        name,
        provider,
        description,
        integration_type,
        base_url,
        auth_type,
        sync_direction,
        sync_frequency,
        status,
        last_tested_at,
        last_success_at,
        last_error,
        created_by,
        created_at,
        updated_at,
        encrypted_credentials
        `
      )
      .eq("organization_id", organizationId)
      .order("created_at", {
        ascending: false,
      });

    if (status && ALLOWED_INTEGRATION_STATUSES.includes(status)) {
      query = query.eq("status", status);
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      console.error(
        "[Integrations] Failed to load integrations:",
        error
      );

      return res.status(500).json({
        message: "Failed to load integrations.",
        error: error.message,
      });
    }

    let integrations = Array.isArray(data)
      ? data.map(sanitizeIntegration)
      : [];

    if (search) {
      integrations = integrations.filter((integration) => {
        const searchable = [
          integration.name,
          integration.provider,
          integration.description,
          integration.integration_type,
          integration.base_url,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(search);
      });
    }

    return res.status(200).json({
      integrations,
    });
  } catch (error) {
    console.error(
      "[Integrations] GET unexpected error:",
      error
    );

    return res.status(500).json({
      message: "Unexpected error while loading integrations.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/integrations/stats
|--------------------------------------------------------------------------
*/

router.get("/stats", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization could not be determined.",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("hr_integrations")
      .select(
        "id, status, integration_type, sync_frequency"
      )
      .eq("organization_id", organizationId);

    if (error) {
      console.error(
        "[Integrations] Stats query failed:",
        error
      );

      return res.status(500).json({
        message: "Failed to load integration statistics.",
        error: error.message,
      });
    }

    const integrations = data || [];

    const stats = {
      total: integrations.length,

      active: integrations.filter(
        (item) => item.status === "active"
      ).length,

      inactive: integrations.filter(
        (item) => item.status === "inactive"
      ).length,

      error: integrations.filter(
        (item) => item.status === "error"
      ).length,

      manual: integrations.filter(
        (item) => item.sync_frequency === "manual"
      ).length,

      automatic: integrations.filter(
        (item) => item.sync_frequency !== "manual"
      ).length,
    };

    return res.status(200).json({
      stats,
    });
  } catch (error) {
    console.error(
      "[Integrations] Stats unexpected error:",
      error
    );

    return res.status(500).json({
      message:
        "Unexpected error while loading integration statistics.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/integrations/:id
|--------------------------------------------------------------------------
*/

router.get("/:id", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const integrationId = req.params.id;

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization could not be determined.",
      });
    }

    if (!validUuid(integrationId)) {
      return res.status(400).json({
        message: "Invalid integration ID.",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("hr_integrations")
      .select(
        `
        id,
        organization_id,
        name,
        provider,
        description,
        integration_type,
        base_url,
        auth_type,
        sync_direction,
        sync_frequency,
        status,
        last_tested_at,
        last_success_at,
        last_error,
        created_by,
        created_at,
        updated_at,
        encrypted_credentials
        `
      )
      .eq("id", integrationId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      console.error(
        "[Integrations] Get integration failed:",
        error
      );

      return res.status(500).json({
        message: "Failed to load integration.",
        error: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message: "Integration not found.",
      });
    }

    return res.status(200).json({
      integration: sanitizeIntegration(data),
    });
  } catch (error) {
    console.error(
      "[Integrations] Get integration unexpected error:",
      error
    );

    return res.status(500).json({
      message: "Unexpected error while loading integration.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/integrations
|--------------------------------------------------------------------------
|
| Create an integration.
|--------------------------------------------------------------------------
*/

router.post("/", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const userId = req.user?.id || null;

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization could not be determined.",
      });
    }

    const {
      name,
      provider,
      description,
      integration_type,
      base_url,
      auth_type,
      credentials,
      sync_direction,
      sync_frequency,
      status,
    } = req.body || {};

    const finalName = clean(name);
    const finalProvider = clean(provider);

    if (!finalName) {
      return res.status(400).json({
        message: "Integration name is required.",
      });
    }

    if (!finalProvider) {
      return res.status(400).json({
        message: "Provider is required.",
      });
    }

    const finalType =
      clean(integration_type).toLowerCase() ||
      "rest_api";

    if (!ALLOWED_INTEGRATION_TYPES.includes(finalType)) {
      return res.status(400).json({
        message: "Invalid integration type.",
      });
    }

    const finalAuthType =
      clean(auth_type).toLowerCase() ||
      "none";

    if (!ALLOWED_AUTH_TYPES.includes(finalAuthType)) {
      return res.status(400).json({
        message: "Invalid authentication type.",
      });
    }

    const normalizedBaseUrl = normalizeUrl(base_url);

    if (base_url && !normalizedBaseUrl) {
      return res.status(400).json({
        message:
          "Base URL must be a valid HTTP or HTTPS URL.",
      });
    }

    const finalDirection =
      clean(sync_direction).toLowerCase() ||
      "inbound";

    if (!ALLOWED_SYNC_DIRECTIONS.includes(finalDirection)) {
      return res.status(400).json({
        message: "Invalid sync direction.",
      });
    }

    const finalFrequency =
      clean(sync_frequency).toLowerCase() ||
      "manual";

    if (!ALLOWED_SYNC_FREQUENCIES.includes(finalFrequency)) {
      return res.status(400).json({
        message: "Invalid sync frequency.",
      });
    }

    const finalStatus =
      clean(status).toLowerCase() ||
      "inactive";

    if (!ALLOWED_INTEGRATION_STATUSES.includes(finalStatus)) {
      return res.status(400).json({
        message: "Invalid integration status.",
      });
    }

    /*
     * Credentials are stored as JSON text in the existing
     * encrypted_credentials column.
     *
     * IMPORTANT:
     * We never return this field to the frontend.
     *
     * Later, for production deployment, this value should be
     * encrypted using a server-side encryption key.
     */

    let credentialsPayload = null;

    if (
      credentials &&
      typeof credentials === "object" &&
      !Array.isArray(credentials)
    ) {
      credentialsPayload = JSON.stringify(credentials);
    }

    const payload = {
      organization_id: organizationId,
      name: finalName,
      provider: finalProvider,
      description: optional(description),
      integration_type: finalType,
      base_url: normalizedBaseUrl,
      auth_type: finalAuthType,
      encrypted_credentials: credentialsPayload,
      sync_direction: finalDirection,
      sync_frequency: finalFrequency,
      status: finalStatus,
      created_by: userId,
    };

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("hr_integrations")
      .insert(payload)
      .select(
        `
        id,
        organization_id,
        name,
        provider,
        description,
        integration_type,
        base_url,
        auth_type,
        sync_direction,
        sync_frequency,
        status,
        last_tested_at,
        last_success_at,
        last_error,
        created_by,
        created_at,
        updated_at,
        encrypted_credentials
        `
      )
      .single();

    if (error) {
      console.error(
        "[Integrations] Create integration failed:",
        error
      );

      return res.status(500).json({
        message: "Failed to create integration.",
        error: error.message,
      });
    }

    return res.status(201).json({
      message: "Integration created successfully.",
      integration: sanitizeIntegration(data),
    });
  } catch (error) {
    console.error(
      "[Integrations] Create integration unexpected error:",
      error
    );

    return res.status(500).json({
      message: "Unexpected error while creating integration.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| PUT /api/integrations/:id
|--------------------------------------------------------------------------
*/

router.put("/:id", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const integrationId = req.params.id;

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization could not be determined.",
      });
    }

    if (!validUuid(integrationId)) {
      return res.status(400).json({
        message: "Invalid integration ID.",
      });
    }

    /*
     * Verify ownership.
     */

    const {
      data: existing,
      error: existingError,
    } = await supabaseAdmin
      .from("hr_integrations")
      .select("*")
      .eq("id", integrationId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (existingError) {
      console.error(
        "[Integrations] Existing integration lookup failed:",
        existingError
      );

      return res.status(500).json({
        message: "Failed to verify integration.",
        error: existingError.message,
      });
    }

    if (!existing) {
      return res.status(404).json({
        message: "Integration not found.",
      });
    }

    const {
      name,
      provider,
      description,
      integration_type,
      base_url,
      auth_type,
      credentials,
      sync_direction,
      sync_frequency,
      status,
    } = req.body || {};

    const updates = {};

    if (name !== undefined) {
      const value = clean(name);

      if (!value) {
        return res.status(400).json({
          message: "Integration name cannot be empty.",
        });
      }

      updates.name = value;
    }

    if (provider !== undefined) {
      const value = clean(provider);

      if (!value) {
        return res.status(400).json({
          message: "Provider cannot be empty.",
        });
      }

      updates.provider = value;
    }

    if (description !== undefined) {
      updates.description = optional(description);
    }

    if (integration_type !== undefined) {
      const value = clean(integration_type).toLowerCase();

      if (!ALLOWED_INTEGRATION_TYPES.includes(value)) {
        return res.status(400).json({
          message: "Invalid integration type.",
        });
      }

      updates.integration_type = value;
    }

    if (base_url !== undefined) {
      const normalized = normalizeUrl(base_url);

      if (base_url && !normalized) {
        return res.status(400).json({
          message:
            "Base URL must be a valid HTTP or HTTPS URL.",
        });
      }

      updates.base_url = normalized;
    }

    if (auth_type !== undefined) {
      const value = clean(auth_type).toLowerCase();

      if (!ALLOWED_AUTH_TYPES.includes(value)) {
        return res.status(400).json({
          message: "Invalid authentication type.",
        });
      }

      updates.auth_type = value;
    }

    if (
      credentials !== undefined &&
      credentials !== null
    ) {
      if (
        typeof credentials !== "object" ||
        Array.isArray(credentials)
      ) {
        return res.status(400).json({
          message:
            "Credentials must be an object.",
        });
      }

      updates.encrypted_credentials =
        JSON.stringify(credentials);
    }

    if (sync_direction !== undefined) {
      const value =
        clean(sync_direction).toLowerCase();

      if (!ALLOWED_SYNC_DIRECTIONS.includes(value)) {
        return res.status(400).json({
          message: "Invalid sync direction.",
        });
      }

      updates.sync_direction = value;
    }

    if (sync_frequency !== undefined) {
      const value =
        clean(sync_frequency).toLowerCase();

      if (!ALLOWED_SYNC_FREQUENCIES.includes(value)) {
        return res.status(400).json({
          message: "Invalid sync frequency.",
        });
      }

      updates.sync_frequency = value;
    }

    if (status !== undefined) {
      const value = clean(status).toLowerCase();

      if (!ALLOWED_INTEGRATION_STATUSES.includes(value)) {
        return res.status(400).json({
          message: "Invalid integration status.",
        });
      }

      updates.status = value;
    }

    updates.updated_at = new Date().toISOString();

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("hr_integrations")
      .update(updates)
      .eq("id", integrationId)
      .eq("organization_id", organizationId)
      .select(
        `
        id,
        organization_id,
        name,
        provider,
        description,
        integration_type,
        base_url,
        auth_type,
        sync_direction,
        sync_frequency,
        status,
        last_tested_at,
        last_success_at,
        last_error,
        created_by,
        created_at,
        updated_at,
        encrypted_credentials
        `
      )
      .single();

    if (error) {
      console.error(
        "[Integrations] Update integration failed:",
        error
      );

      return res.status(500).json({
        message: "Failed to update integration.",
        error: error.message,
      });
    }

    return res.status(200).json({
      message: "Integration updated successfully.",
      integration: sanitizeIntegration(data),
    });
  } catch (error) {
    console.error(
      "[Integrations] Update integration unexpected error:",
      error
    );

    return res.status(500).json({
      message: "Unexpected error while updating integration.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE /api/integrations/:id
|--------------------------------------------------------------------------
|
| Delete mappings/logs first so this works even if the database
| doesn't have cascading foreign keys configured.
|--------------------------------------------------------------------------
*/

router.delete("/:id", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const integrationId = req.params.id;

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization could not be determined.",
      });
    }

    if (!validUuid(integrationId)) {
      return res.status(400).json({
        message: "Invalid integration ID.",
      });
    }

    const {
      data: existing,
      error: existingError,
    } = await supabaseAdmin
      .from("hr_integrations")
      .select("id, name")
      .eq("id", integrationId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({
        message: "Failed to verify integration.",
        error: existingError.message,
      });
    }

    if (!existing) {
      return res.status(404).json({
        message: "Integration not found.",
      });
    }

    /*
     * Delete mappings.
     */

    const {
      error: mappingsError,
    } = await supabaseAdmin
      .from("integration_mappings")
      .delete()
      .eq("integration_id", integrationId)
      .eq("organization_id", organizationId);

    if (mappingsError) {
      console.error(
        "[Integrations] Delete mappings failed:",
        mappingsError
      );

      return res.status(500).json({
        message:
          "Failed to delete integration mappings.",
        error: mappingsError.message,
      });
    }

    /*
     * Delete sync logs.
     */

    const {
      error: logsError,
    } = await supabaseAdmin
      .from("integration_sync_logs")
      .delete()
      .eq("integration_id", integrationId)
      .eq("organization_id", organizationId);

    if (logsError) {
      console.error(
        "[Integrations] Delete sync logs failed:",
        logsError
      );

      return res.status(500).json({
        message:
          "Failed to delete integration sync logs.",
        error: logsError.message,
      });
    }

    /*
     * Delete integration.
     */

    const {
      error,
    } = await supabaseAdmin
      .from("hr_integrations")
      .delete()
      .eq("id", integrationId)
      .eq("organization_id", organizationId);

    if (error) {
      console.error(
        "[Integrations] Delete integration failed:",
        error
      );

      return res.status(500).json({
        message: "Failed to delete integration.",
        error: error.message,
      });
    }

    return res.status(200).json({
      message: "Integration deleted successfully.",
    });
  } catch (error) {
    console.error(
      "[Integrations] Delete integration unexpected error:",
      error
    );

    return res.status(500).json({
      message: "Unexpected error while deleting integration.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/integrations/:id/mappings
|--------------------------------------------------------------------------
*/

router.get("/:id/mappings", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const integrationId = req.params.id;

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization could not be determined.",
      });
    }

    if (!validUuid(integrationId)) {
      return res.status(400).json({
        message: "Invalid integration ID.",
      });
    }

    /*
     * Verify integration belongs to organization.
     */

    const {
      data: integration,
      error: integrationError,
    } = await supabaseAdmin
      .from("hr_integrations")
      .select("id")
      .eq("id", integrationId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (integrationError) {
      return res.status(500).json({
        message: "Failed to verify integration.",
        error: integrationError.message,
      });
    }

    if (!integration) {
      return res.status(404).json({
        message: "Integration not found.",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("integration_mappings")
      .select("*")
      .eq("integration_id", integrationId)
      .eq("organization_id", organizationId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "[Integrations] Load mappings failed:",
        error
      );

      return res.status(500).json({
        message: "Failed to load integration mappings.",
        error: error.message,
      });
    }

    return res.status(200).json({
      mappings: data || [],
    });
  } catch (error) {
    console.error(
      "[Integrations] Mappings GET unexpected error:",
      error
    );

    return res.status(500).json({
      message:
        "Unexpected error while loading mappings.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/integrations/:id/mappings
|--------------------------------------------------------------------------
*/

router.post("/:id/mappings", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const integrationId = req.params.id;

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization could not be determined.",
      });
    }

    if (!validUuid(integrationId)) {
      return res.status(400).json({
        message: "Invalid integration ID.",
      });
    }

    const {
      source_object,
      source_field,
      target_object,
      target_field,
      direction,
      transform_rule,
      is_active,
    } = req.body || {};

    const sourceObject = clean(source_object);
    const sourceField = clean(source_field);
    const targetObject = clean(target_object);
    const targetField = clean(target_field);

    if (!sourceObject) {
      return res.status(400).json({
        message: "Source object is required.",
      });
    }

    if (!sourceField) {
      return res.status(400).json({
        message: "Source field is required.",
      });
    }

    if (!targetObject) {
      return res.status(400).json({
        message: "Target object is required.",
      });
    }

    if (!targetField) {
      return res.status(400).json({
        message: "Target field is required.",
      });
    }

    const finalDirection =
      clean(direction).toLowerCase() ||
      "inbound";

    if (!ALLOWED_MAPPING_DIRECTIONS.includes(finalDirection)) {
      return res.status(400).json({
        message: "Invalid mapping direction.",
      });
    }

    /*
     * Verify integration.
     */

    const {
      data: integration,
      error: integrationError,
    } = await supabaseAdmin
      .from("hr_integrations")
      .select("id")
      .eq("id", integrationId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (integrationError) {
      return res.status(500).json({
        message: "Failed to verify integration.",
        error: integrationError.message,
      });
    }

    if (!integration) {
      return res.status(404).json({
        message: "Integration not found.",
      });
    }

    const payload = {
      organization_id: organizationId,
      integration_id: integrationId,
      source_object: sourceObject,
      source_field: sourceField,
      target_object: targetObject,
      target_field: targetField,
      direction: finalDirection,
      transform_rule: optional(transform_rule),
      is_active:
        typeof is_active === "boolean"
          ? is_active
          : true,
    };

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("integration_mappings")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error(
        "[Integrations] Create mapping failed:",
        error
      );

      return res.status(500).json({
        message: "Failed to create integration mapping.",
        error: error.message,
      });
    }

    return res.status(201).json({
      message: "Integration mapping created successfully.",
      mapping: data,
    });
  } catch (error) {
    console.error(
      "[Integrations] Create mapping unexpected error:",
      error
    );

    return res.status(500).json({
      message:
        "Unexpected error while creating integration mapping.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| PUT /api/integrations/:integrationId/mappings/:mappingId
|--------------------------------------------------------------------------
*/

router.put(
  "/:integrationId/mappings/:mappingId",
  async (req, res) => {
    try {
      const organizationId = getOrganizationId(req);
      const integrationId =
        req.params.integrationId;
      const mappingId =
        req.params.mappingId;

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      if (!validUuid(integrationId)) {
        return res.status(400).json({
          message: "Invalid integration ID.",
        });
      }

      if (!validUuid(mappingId)) {
        return res.status(400).json({
          message: "Invalid mapping ID.",
        });
      }

      const {
        source_object,
        source_field,
        target_object,
        target_field,
        direction,
        transform_rule,
        is_active,
      } = req.body || {};

      const updates = {};

      if (source_object !== undefined) {
        const value = clean(source_object);

        if (!value) {
          return res.status(400).json({
            message: "Source object cannot be empty.",
          });
        }

        updates.source_object = value;
      }

      if (source_field !== undefined) {
        const value = clean(source_field);

        if (!value) {
          return res.status(400).json({
            message: "Source field cannot be empty.",
          });
        }

        updates.source_field = value;
      }

      if (target_object !== undefined) {
        const value = clean(target_object);

        if (!value) {
          return res.status(400).json({
            message: "Target object cannot be empty.",
          });
        }

        updates.target_object = value;
      }

      if (target_field !== undefined) {
        const value = clean(target_field);

        if (!value) {
          return res.status(400).json({
            message: "Target field cannot be empty.",
          });
        }

        updates.target_field = value;
      }

      if (direction !== undefined) {
        const value =
          clean(direction).toLowerCase();

        if (
          !ALLOWED_MAPPING_DIRECTIONS.includes(
            value
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid mapping direction.",
          });
        }

        updates.direction = value;
      }

      if (transform_rule !== undefined) {
        updates.transform_rule =
          optional(transform_rule);
      }

      if (is_active !== undefined) {
        if (typeof is_active !== "boolean") {
          return res.status(400).json({
            message:
              "is_active must be a boolean.",
          });
        }

        updates.is_active = is_active;
      }

      updates.updated_at =
        new Date().toISOString();

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("integration_mappings")
        .update(updates)
        .eq("id", mappingId)
        .eq("integration_id", integrationId)
        .eq("organization_id", organizationId)
        .select("*")
        .maybeSingle();

      if (error) {
        console.error(
          "[Integrations] Update mapping failed:",
          error
        );

        return res.status(500).json({
          message:
            "Failed to update integration mapping.",
          error: error.message,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Integration mapping not found.",
        });
      }

      return res.status(200).json({
        message:
          "Integration mapping updated successfully.",
        mapping: data,
      });
    } catch (error) {
      console.error(
        "[Integrations] Update mapping unexpected error:",
        error
      );

      return res.status(500).json({
        message:
          "Unexpected error while updating integration mapping.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| DELETE /api/integrations/:integrationId/mappings/:mappingId
|--------------------------------------------------------------------------
*/

router.delete(
  "/:integrationId/mappings/:mappingId",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const integrationId =
        req.params.integrationId;

      const mappingId =
        req.params.mappingId;

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      if (!validUuid(integrationId)) {
        return res.status(400).json({
          message: "Invalid integration ID.",
        });
      }

      if (!validUuid(mappingId)) {
        return res.status(400).json({
          message: "Invalid mapping ID.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("integration_mappings")
        .delete()
        .eq("id", mappingId)
        .eq("integration_id", integrationId)
        .eq("organization_id", organizationId)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error(
          "[Integrations] Delete mapping failed:",
          error
        );

        return res.status(500).json({
          message:
            "Failed to delete integration mapping.",
          error: error.message,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Integration mapping not found.",
        });
      }

      return res.status(200).json({
        message:
          "Integration mapping deleted successfully.",
      });
    } catch (error) {
      console.error(
        "[Integrations] Delete mapping unexpected error:",
        error
      );

      return res.status(500).json({
        message:
          "Unexpected error while deleting integration mapping.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/integrations/:id/logs
|--------------------------------------------------------------------------
*/

router.get("/:id/logs", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    const integrationId =
      req.params.id;

    if (!organizationId) {
      return res.status(403).json({
        message:
          "Organization could not be determined.",
      });
    }

    if (!validUuid(integrationId)) {
      return res.status(400).json({
        message: "Invalid integration ID.",
      });
    }

    const limitValue =
      Number(req.query.limit || 50);

    const limit = Math.min(
      Math.max(
        Number.isFinite(limitValue)
          ? Math.floor(limitValue)
          : 50,
        1
      ),
      100
    );

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("integration_sync_logs")
      .select("*")
      .eq("integration_id", integrationId)
      .eq("organization_id", organizationId)
      .order("started_at", {
        ascending: false,
      })
      .limit(limit);

    if (error) {
      console.error(
        "[Integrations] Load sync logs failed:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load integration sync logs.",
        error: error.message,
      });
    }

    return res.status(200).json({
      logs: data || [],
    });
  } catch (error) {
    console.error(
      "[Integrations] Logs GET unexpected error:",
      error
    );

    return res.status(500).json({
      message:
        "Unexpected error while loading integration sync logs.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/integrations/:id/logs
|--------------------------------------------------------------------------
|
| Allows the application to record a sync/test operation.
|--------------------------------------------------------------------------
*/

router.post("/:id/logs", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    const integrationId =
      req.params.id;

    if (!organizationId) {
      return res.status(403).json({
        message:
          "Organization could not be determined.",
      });
    }

    if (!validUuid(integrationId)) {
      return res.status(400).json({
        message: "Invalid integration ID.",
      });
    }

    const {
      operation,
      direction,
      status,
      http_status,
      duration_ms,
      records_processed,
      message,
      error_details,
      started_at,
      completed_at,
    } = req.body || {};

    const finalOperation =
      clean(operation);

    if (!finalOperation) {
      return res.status(400).json({
        message: "Operation is required.",
      });
    }

    const finalStatus =
      clean(status).toLowerCase();

    if (!ALLOWED_LOG_STATUSES.includes(finalStatus)) {
      return res.status(400).json({
        message: "Invalid sync log status.",
      });
    }

    if (
      http_status !== undefined &&
      http_status !== null &&
      (
        !Number.isInteger(
          Number(http_status)
        ) ||
        Number(http_status) < 100 ||
        Number(http_status) > 599
      )
    ) {
      return res.status(400).json({
        message: "Invalid HTTP status.",
      });
    }

    if (
      duration_ms !== undefined &&
      duration_ms !== null &&
      (
        !Number.isFinite(
          Number(duration_ms)
        ) ||
        Number(duration_ms) < 0
      )
    ) {
      return res.status(400).json({
        message: "Invalid duration.",
      });
    }

    const processed =
      records_processed === undefined ||
      records_processed === null
        ? 0
        : Number(records_processed);

    if (
      !Number.isFinite(processed) ||
      processed < 0
    ) {
      return res.status(400).json({
        message:
          "records_processed must be a non-negative number.",
      });
    }

    /*
     * Verify integration belongs to organization.
     */

    const {
      data: integration,
      error: integrationError,
    } = await supabaseAdmin
      .from("hr_integrations")
      .select("id")
      .eq("id", integrationId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (integrationError) {
      return res.status(500).json({
        message:
          "Failed to verify integration.",
        error: integrationError.message,
      });
    }

    if (!integration) {
      return res.status(404).json({
        message:
          "Integration not found.",
      });
    }

    const payload = {
      organization_id: organizationId,
      integration_id: integrationId,
      operation: finalOperation,
      direction: optional(direction),
      status: finalStatus,
      http_status:
        http_status === undefined ||
        http_status === null
          ? null
          : Number(http_status),
      duration_ms:
        duration_ms === undefined ||
        duration_ms === null
          ? null
          : Math.round(Number(duration_ms)),
      records_processed: Math.round(processed),
      message: optional(message),
      error_details: optional(error_details),
      started_at:
        started_at ||
        new Date().toISOString(),
      completed_at:
        completed_at || null,
    };

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("integration_sync_logs")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error(
        "[Integrations] Create sync log failed:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to create integration sync log.",
        error: error.message,
      });
    }

    return res.status(201).json({
      message:
        "Integration sync log created successfully.",
      log: data,
    });
  } catch (error) {
    console.error(
      "[Integrations] Create log unexpected error:",
      error
    );

    return res.status(500).json({
      message:
        "Unexpected error while creating integration sync log.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/integrations/:id/test
|--------------------------------------------------------------------------
|
| Tests a REST API integration.
|
| Supported authentication:
|   none
|   api_key
|   bearer
|   basic
|
| Credentials are read from the server-side database only.
|--------------------------------------------------------------------------
*/

router.post("/:id/test", async (req, res) => {
  const startedAt = Date.now();

  try {
    const organizationId =
      getOrganizationId(req);

    const integrationId =
      req.params.id;

    if (!organizationId) {
      return res.status(403).json({
        message:
          "Organization could not be determined.",
      });
    }

    if (!validUuid(integrationId)) {
      return res.status(400).json({
        message: "Invalid integration ID.",
      });
    }

    /*
     * Load integration including credentials.
     * This information NEVER goes to the browser.
     */

    const {
      data: integration,
      error: integrationError,
    } = await supabaseAdmin
      .from("hr_integrations")
      .select("*")
      .eq("id", integrationId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (integrationError) {
      console.error(
        "[Integrations] Test integration lookup failed:",
        integrationError
      );

      return res.status(500).json({
        message:
          "Failed to load integration.",
        error: integrationError.message,
      });
    }

    if (!integration) {
      return res.status(404).json({
        message: "Integration not found.",
      });
    }

    /*
     * Update test timestamp immediately.
     */

    await supabaseAdmin
      .from("hr_integrations")
      .update({
        last_tested_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", integrationId)
      .eq("organization_id", organizationId);

    /*
     * Only REST APIs can currently be actively tested.
     */

    if (
      integration.integration_type !==
      "rest_api"
    ) {
      const message =
        "Connection testing is currently supported for REST API integrations.";

      await supabaseAdmin
        .from("hr_integrations")
        .update({
          status: "inactive",
          last_error: message,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", integrationId)
        .eq("organization_id", organizationId);

      await supabaseAdmin
        .from("integration_sync_logs")
        .insert({
          organization_id: organizationId,
          integration_id: integrationId,
          operation: "connection_test",
          direction:
            integration.sync_direction,
          status: "skipped",
          duration_ms:
            Date.now() - startedAt,
          records_processed: 0,
          message,
          started_at:
            new Date(
              startedAt
            ).toISOString(),
          completed_at:
            new Date().toISOString(),
        });

      return res.status(200).json({
        success: false,
        status: "skipped",
        message,
      });
    }

    if (!integration.base_url) {
      const message =
        "A base URL is required to test this integration.";

      await supabaseAdmin
        .from("hr_integrations")
        .update({
          status: "error",
          last_error: message,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", integrationId)
        .eq("organization_id", organizationId);

      return res.status(400).json({
        success: false,
        message,
      });
    }

    /*
     * Parse credentials.
     */

    let credentials = {};

    if (integration.encrypted_credentials) {
      try {
        credentials =
          JSON.parse(
            integration.encrypted_credentials
          );
      } catch {
        credentials = {};
      }
    }

    /*
     * Build request headers.
     */

    const headers = {
      Accept: "application/json",
    };

    if (
      integration.auth_type ===
      "api_key"
    ) {
      const apiKey =
        credentials.api_key ||
        credentials.apiKey;

      const headerName =
        credentials.header_name ||
        credentials.headerName ||
        "x-api-key";

      if (apiKey) {
        headers[headerName] =
          String(apiKey);
      }
    }

    if (
      integration.auth_type ===
      "bearer"
    ) {
      const token =
        credentials.token ||
        credentials.access_token ||
        credentials.accessToken;

      if (token) {
        headers.Authorization =
          `Bearer ${token}`;
      }
    }

    if (
      integration.auth_type ===
      "basic"
    ) {
      const username =
        credentials.username || "";

      const password =
        credentials.password || "";

      if (username || password) {
        const encoded =
          Buffer.from(
            `${username}:${password}`
          ).toString("base64");

        headers.Authorization =
          `Basic ${encoded}`;
      }
    }

    /*
     * Timeout.
     */

    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      15000
    );

    let response;

    try {
      response = await fetch(
        integration.base_url,
        {
          method: "GET",
          headers,
          signal:
            controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const duration =
      Date.now() - startedAt;

    const responseText =
      await response.text();

    const success =
      response.ok;

    const message = success
      ? "Integration connection test succeeded."
      : `Integration returned HTTP ${response.status}.`;

    /*
     * Update integration status.
     */

    await supabaseAdmin
      .from("hr_integrations")
      .update({
        status: success
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
            : message,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", integrationId)
      .eq("organization_id", organizationId);

    /*
     * Create sync/test log.
     */

    await supabaseAdmin
      .from("integration_sync_logs")
      .insert({
        organization_id:
          organizationId,

        integration_id:
          integrationId,

        operation:
          "connection_test",

        direction:
          integration.sync_direction,

        status:
          success
            ? "success"
            : "failed",

        http_status:
          response.status,

        duration_ms:
          duration,

        records_processed:
          0,

        message,

        error_details:
          success
            ? null
            : responseText
              ? responseText.slice(
                  0,
                  2000
                )
              : null,

        started_at:
          new Date(
            startedAt
          ).toISOString(),

        completed_at:
          new Date().toISOString(),
      });

    return res.status(200).json({
      success,
      status:
        success
          ? "active"
          : "error",
      http_status:
        response.status,
      duration_ms:
        duration,
      message,
    });
  } catch (error) {
    const duration =
      Date.now() - startedAt;

    console.error(
      "[Integrations] Connection test failed:",
      error
    );

    const organizationId =
      getOrganizationId(req);

    const integrationId =
      req.params.id;

    /*
     * Update integration failure state.
     */

    if (
      organizationId &&
      validUuid(integrationId)
    ) {
      const errorMessage =
        error?.name === "AbortError"
          ? "Integration connection timed out after 15 seconds."
          : error?.message ||
            "Integration connection failed.";

      await supabaseAdmin
        .from("hr_integrations")
        .update({
          status: "error",
          last_tested_at:
            new Date().toISOString(),
          last_error:
            errorMessage,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", integrationId)
        .eq("organization_id", organizationId);

      await supabaseAdmin
        .from("integration_sync_logs")
        .insert({
          organization_id:
            organizationId,

          integration_id:
            integrationId,

          operation:
            "connection_test",

          direction:
            null,

          status:
            "failed",

          http_status:
            null,

          duration_ms:
            duration,

          records_processed:
            0,

          message:
            "Integration connection test failed.",

          error_details:
            errorMessage,

          started_at:
            new Date(
              Date.now() - duration
            ).toISOString(),

          completed_at:
            new Date().toISOString(),
        });
    }

    return res.status(502).json({
      success: false,
      message:
        error?.name === "AbortError"
          ? "Integration connection timed out after 15 seconds."
          : error?.message ||
            "Unable to connect to the integration.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

export default router;