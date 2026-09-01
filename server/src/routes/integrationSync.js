import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";
import {
  synchronizeIntegration,
} from "../services/integrationSyncService.js";

const router = Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION
========================================================= */

router.use(async (req, res, next) => {
  try {
    if (req.organization?.id) {
      return next();
    }

    const organization =
      await getOrganizationForUser(
        req.user.id
      );

    if (!organization?.id) {
      return res.status(403).json({
        message:
          "Complete organization setup first.",
      });
    }

    req.organization =
      organization;

    return next();
  } catch (error) {
    console.error(
      "[IntegrationSync] Organization lookup failed:",
      error
    );

    return res.status(500).json({
      message:
        "Could not determine organization.",
    });
  }
});

/* =========================================================
   HELPERS
========================================================= */

function clean(value) {
  return String(
    value ?? ""
  ).trim();
}

function isValidUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

/* =========================================================
   POST /api/integrations/:id/sync
========================================================= */

router.post(
  "/:id/sync",
  async (req, res) => {
    const startedAt =
      new Date();

    const startedTimestamp =
      Date.now();

    const integrationId =
      req.params.id;

    try {
      const organizationId =
        req.organization?.id;

      /*
       * -----------------------------------------------------
       * Validate organization
       * -----------------------------------------------------
       */

      if (!organizationId) {
        return res.status(403).json({
          success: false,
          message:
            "Organization could not be determined.",
        });
      }

      /*
       * -----------------------------------------------------
       * Validate integration ID
       * -----------------------------------------------------
       */

      if (
        !isValidUUID(
          integrationId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid integration ID.",
        });
      }

      console.log(
        "--------------------------------------------------"
      );

      console.log(
        "[IntegrationSync] Starting synchronization."
      );

      console.log(
        "[IntegrationSync] Integration:",
        integrationId
      );

      console.log(
        "[IntegrationSync] Organization:",
        organizationId
      );

      /*
       * -----------------------------------------------------
       * Load integration
       * -----------------------------------------------------
       */

      const {
        data: integration,
        error:
          integrationError,
      } =
        await supabaseAdmin
          .from(
            "hr_integrations"
          )
          .select("*")
          .eq(
            "id",
            integrationId
          )
          .eq(
            "organization_id",
            organizationId
          )
          .maybeSingle();

      if (
        integrationError
      ) {
        console.error(
          "[IntegrationSync] Integration lookup failed:",
          integrationError
        );

        return res.status(500).json({
          success: false,
          message:
            "Failed to load integration.",
          error:
            integrationError.message,
        });
      }

      if (!integration) {
        return res.status(404).json({
          success: false,
          message:
            "Integration not found.",
        });
      }

      console.log(
        "[IntegrationSync] Integration loaded:",
        integration.name
      );

      /*
       * -----------------------------------------------------
       * Validate sync direction
       * -----------------------------------------------------
       */

      const syncDirection =
        clean(
          integration.sync_direction
        ).toLowerCase();

      if (
        ![
          "inbound",
          "bidirectional",
        ].includes(
          syncDirection
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This integration is not configured for inbound synchronization.",
        });
      }

      /*
       * -----------------------------------------------------
       * Validate integration type
       * -----------------------------------------------------
       */

      const integrationType =
        clean(
          integration.integration_type
        ).toLowerCase();

      if (
        integrationType !==
        "rest_api"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "The current synchronization engine supports REST API integrations.",
        });
      }

      /*
       * -----------------------------------------------------
       * Load mappings
       * -----------------------------------------------------
       */

      const {
        data: mappings,
        error:
          mappingsError,
      } =
        await supabaseAdmin
          .from(
            "integration_mappings"
          )
          .select("*")
          .eq(
            "integration_id",
            integrationId
          )
          .eq(
            "organization_id",
            organizationId
          )
          .order(
            "created_at",
            {
              ascending: true,
            }
          );

      if (
        mappingsError
      ) {
        console.error(
          "[IntegrationSync] Mapping lookup failed:",
          mappingsError
        );

        return res.status(500).json({
          success: false,
          message:
            "Failed to load integration mappings.",
          error:
            mappingsError.message,
        });
      }

      const activeMappings =
        Array.isArray(
          mappings
        )
          ? mappings.filter(
              (mapping) =>
                mapping?.is_active !==
                  false &&
                clean(
                  mapping?.direction
                ).toLowerCase() ===
                  "inbound"
            )
          : [];

      console.log(
        "[IntegrationSync] Total mappings:",
        mappings?.length || 0
      );

      console.log(
        "[IntegrationSync] Active inbound mappings:",
        activeMappings.length
      );

      /*
       * -----------------------------------------------------
       * Require mappings
       * -----------------------------------------------------
       */

      if (
        activeMappings.length ===
        0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "No active inbound mappings are configured for this integration.",
        });
      }

      /*
       * -----------------------------------------------------
       * Show mappings in server log
       * -----------------------------------------------------
       */

      console.log(
        "[IntegrationSync] Mappings:"
      );

      for (const mapping of activeMappings) {
        console.log(
          `  ${mapping.source_object}.${mapping.source_field} -> ${mapping.target_object}.${mapping.target_field}`
        );
      }

      /*
       * -----------------------------------------------------
       * Run synchronization
       * -----------------------------------------------------
       */

      const result =
        await synchronizeIntegration({
          integration,
          organizationId,
          mappings:
            activeMappings,
        });

      const durationMs =
        Date.now() -
        startedTimestamp;

      const completedAt =
        new Date();

      /*
       * -----------------------------------------------------
       * Normalize synchronization counters
       * -----------------------------------------------------
       *
       * The synchronization service already returns these
       * values. Normalize them here so the database always
       * receives valid numeric values.
       * -----------------------------------------------------
       */

      const recordsProcessed =
        Number(
          result?.recordsProcessed ?? 0
        );

      const recordsCreated =
        Number(
          result?.recordsCreated ?? 0
        );

      const recordsUpdated =
        Number(
          result?.recordsUpdated ?? 0
        );

      const recordsFailed =
        Number(
          result?.recordsFailed ?? 0
        );

      /*
       * -----------------------------------------------------
       * Determine log status
       * -----------------------------------------------------
       */

      let logStatus =
        "success";

      if (
        recordsFailed >
        0
      ) {
        logStatus =
          recordsCreated +
            recordsUpdated >
          0
            ? "partial"
            : "error";
      }

      /*
       * -----------------------------------------------------
       * Build log message
       * -----------------------------------------------------
       */

      const logMessage =
        result?.message ||
        `Synchronization completed. ${recordsProcessed} records processed.`;

      let errorDetails =
        null;

      if (
        Array.isArray(
          result?.errors
        ) &&
        result.errors.length >
          0
      ) {
        errorDetails =
          JSON.stringify(
            result.errors
          );
      }

      /*
       * -----------------------------------------------------
       * Write sync log
       * -----------------------------------------------------
       *
       * IMPORTANT:
       * The integration_sync_logs table now stores:
       *
       * records_processed
       * records_created
       * records_updated
       * records_failed
       *
       * This allows the Sync Logs UI to show the complete
       * synchronization result.
       * -----------------------------------------------------
       */

      const {
        error: logError,
      } =
        await supabaseAdmin
          .from(
            "integration_sync_logs"
          )
          .insert({
            organization_id:
              organizationId,

            integration_id:
              integrationId,

            operation:
              "sync",

            direction:
              syncDirection,

            status:
              logStatus,

            http_status:
              result?.httpStatus ??
              200,

            duration_ms:
              durationMs,

            records_processed:
              recordsProcessed,

            records_created:
              recordsCreated,

            records_updated:
              recordsUpdated,

            records_failed:
              recordsFailed,

            message:
              logMessage,

            error_details:
              errorDetails,

            started_at:
              startedAt.toISOString(),

            completed_at:
              completedAt.toISOString(),
          });

      if (logError) {
        console.error(
          "[IntegrationSync] Failed to create sync log:",
          logError
        );
      } else {
        console.log(
          "[IntegrationSync] Sync log created successfully."
        );
      }

      /*
       * -----------------------------------------------------
       * Update integration status
       * -----------------------------------------------------
       */

      const integrationUpdate =
        {
          updated_at:
            completedAt.toISOString(),

          last_error:
            recordsFailed >
            0
              ? logMessage
              : null,
        };

      /*
       * -----------------------------------------------------
       * Successful or partially successful sync
       * -----------------------------------------------------
       */

      if (
        result?.success ||
        recordsCreated +
            recordsUpdated >
          0
      ) {
        integrationUpdate.last_success_at =
          completedAt.toISOString();
      }

      /*
       * -----------------------------------------------------
       * If synchronization had failures, mark the
       * integration as error. Otherwise keep its current
       * status.
       * -----------------------------------------------------
       */

      if (
        recordsFailed >
        0
      ) {
        integrationUpdate.status =
          "error";
      }

      const {
        error:
          updateIntegrationError,
      } =
        await supabaseAdmin
          .from(
            "hr_integrations"
          )
          .update(
            integrationUpdate
          )
          .eq(
            "id",
            integrationId
          )
          .eq(
            "organization_id",
            organizationId
          );

      if (
        updateIntegrationError
      ) {
        console.error(
          "[IntegrationSync] Failed to update integration:",
          updateIntegrationError
        );
      }

      /*
       * -----------------------------------------------------
       * Final server logging
       * -----------------------------------------------------
       */

      console.log(
        "[IntegrationSync] Synchronization completed."
      );

      console.log(
        "[IntegrationSync] Records processed:",
        recordsProcessed
      );

      console.log(
        "[IntegrationSync] Records created:",
        recordsCreated
      );

      console.log(
        "[IntegrationSync] Records updated:",
        recordsUpdated
      );

      console.log(
        "[IntegrationSync] Records failed:",
        recordsFailed
      );

      console.log(
        "[IntegrationSync] Duration:",
        durationMs,
        "ms"
      );

      console.log(
        "--------------------------------------------------"
      );

      /*
       * -----------------------------------------------------
       * Return response
       * -----------------------------------------------------
       */

      return res.status(200).json({
        success:
          result?.success,

        message:
          result?.message,

        integration_id:
          integrationId,

        operation:
          "sync",

        direction:
          syncDirection,

        records_processed:
          recordsProcessed,

        records_created:
          recordsCreated,

        records_updated:
          recordsUpdated,

        records_failed:
          recordsFailed,

        duration_ms:
          durationMs,

        errors:
          result?.errors || [],
      });
    } catch (error) {
      const durationMs =
        Date.now() -
        startedTimestamp;

      console.error(
        "--------------------------------------------------"
      );

      console.error(
        "[IntegrationSync] Synchronization failed:"
      );

      console.error(
        error
      );

      console.error(
        "--------------------------------------------------"
      );

      /*
       * -----------------------------------------------------
       * Attempt to write failure log
       * -----------------------------------------------------
       */

      try {
        const organizationId =
          req.organization?.id;

        if (
          organizationId &&
          isValidUUID(
            integrationId
          )
        ) {
          const failureMessage =
            error?.message ||
            "Synchronization failed.";

          const failureHttpStatus =
            error?.response?.status ||
            null;

          await supabaseAdmin
            .from(
              "integration_sync_logs"
            )
            .insert({
              organization_id:
                organizationId,

              integration_id:
                integrationId,

              operation:
                "sync",

              direction:
                "inbound",

              status:
                "error",

              http_status:
                failureHttpStatus,

              duration_ms:
                durationMs,

              records_processed:
                0,

              records_created:
                0,

              records_updated:
                0,

              records_failed:
                0,

              message:
                failureMessage,

              error_details:
                JSON.stringify({
                  message:
                    failureMessage,

                  stack:
                    error?.stack ||
                    null,
                }),

              started_at:
                startedAt.toISOString(),

              completed_at:
                new Date().toISOString(),
            });
        }
      } catch (logError) {
        console.error(
          "[IntegrationSync] Failed to write error log:",
          logError
        );
      }

      /*
       * -----------------------------------------------------
       * Update integration error state
       * -----------------------------------------------------
       */

      try {
        const organizationId =
          req.organization?.id;

        if (
          organizationId &&
          isValidUUID(
            integrationId
          )
        ) {
          await supabaseAdmin
            .from(
              "hr_integrations"
            )
            .update({
              status:
                "error",

              last_error:
                error?.message ||
                "Synchronization failed.",

              updated_at:
                new Date().toISOString(),
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
      } catch (updateError) {
        console.error(
          "[IntegrationSync] Failed to update integration error state:",
          updateError
        );
      }

      /*
       * -----------------------------------------------------
       * Return error response
       * -----------------------------------------------------
       */

      return res.status(500).json({
        success: false,

        message:
          error?.message ||
          "Synchronization failed.",

        records_processed:
          0,

        records_created:
          0,

        records_updated:
          0,

        records_failed:
          0,

        duration_ms:
          durationMs,
      });
    }
  }
);

export default router;