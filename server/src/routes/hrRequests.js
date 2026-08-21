import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION
========================================================= */

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
      "HR request organization lookup error:",
      error,
    );

    return res.status(500).json({
      message: "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   CONSTANTS
========================================================= */

const REQUEST_STATUSES = [
  "submitted",
  "classified",
  "assigned",
  "in_progress",
  "resolved",
  "cancelled",
];

const PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
];

/* =========================================================
   HELPERS
========================================================= */

function cleanString(value) {
  return String(value ?? "").trim();
}

function cleanOptionalString(value) {
  const valueCleaned = cleanString(value);

  return valueCleaned || null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? ""),
  );
}

function normalizePriority(value) {
  const priority = cleanString(value).toLowerCase();

  return PRIORITIES.includes(priority)
    ? priority
    : "normal";
}

function normalizeStatus(value) {
  const status = cleanString(value).toLowerCase();

  return REQUEST_STATUSES.includes(status)
    ? status
    : "submitted";
}

/* =========================================================
   GET ALL HR REQUESTS
=========================================================

   GET
   /api/hr-requests

   Returns requests belonging ONLY to the current
   user's organization.
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId =
      req.organization.id;

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("hr_requests")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      );

    if (error) {
      console.error(
        "Get HR requests error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load HR requests",
      });
    }

    return res.json({
      requests: data || [],
    });
  } catch (error) {
    console.error(
      "Unexpected get HR requests error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not load HR requests",
    });
  }
});

/* =========================================================
   GET SINGLE HR REQUEST
=========================================================

   GET
   /api/hr-requests/:id
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const requestId =
      req.params.id;

    if (!isUuid(requestId)) {
      return res.status(400).json({
        message:
          "Invalid HR request ID",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("hr_requests")
      .select("*")
      .eq(
        "id",
        requestId,
      )
      .eq(
        "organization_id",
        req.organization.id,
      )
      .maybeSingle();

    if (error) {
      console.error(
        "Get HR request error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load HR request",
      });
    }

    if (!data) {
      return res.status(404).json({
        message:
          "HR request not found",
      });
    }

    return res.json({
      request: data,
    });
  } catch (error) {
    console.error(
      "Unexpected get HR request error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not load HR request",
    });
  }
});

/* =========================================================
   CREATE HR REQUEST
=========================================================

   POST
   /api/hr-requests

   Body:

   {
     "title": "Need salary certificate",
     "description": "I need my salary certificate...",
     "category": "documents",
     "priority": "normal"
   }
========================================================= */

router.post("/", async (req, res) => {
  try {
    const title =
      cleanString(
        req.body?.title,
      );

    const description =
      cleanOptionalString(
        req.body?.description,
      );

    const category =
      cleanString(
        req.body?.category,
      ).toLowerCase() ||
      "general";

    const priority =
      normalizePriority(
        req.body?.priority,
      );

    /* -------------------------------------------------------
       VALIDATION
    ------------------------------------------------------- */

    if (!title) {
      return res.status(400).json({
        message:
          "Request title is required",
      });
    }

    if (title.length > 200) {
      return res.status(400).json({
        message:
          "Request title must be 200 characters or less",
      });
    }

    if (
      description &&
      description.length > 5000
    ) {
      return res.status(400).json({
        message:
          "Request description must be 5000 characters or less",
      });
    }

    /* -------------------------------------------------------
       CREATE REQUEST
    ------------------------------------------------------- */

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("hr_requests")
      .insert({
        organization_id:
          req.organization.id,

        requested_by:
          req.user.id,

        title,

        description,

        category,

        priority,

        status:
          "submitted",
      })
      .select("*")
      .single();

    if (error) {
      console.error(
        "Create HR request error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not create HR request",
      });
    }

    console.log(
      `[HR Requests] Created request ${data.id} by ${req.user.id}`,
    );

    return res.status(201).json({
      message:
        "HR request submitted successfully",

      request: data,
    });
  } catch (error) {
    console.error(
      "Unexpected create HR request error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not create HR request",
    });
  }
});

/* =========================================================
   UPDATE HR REQUEST
=========================================================

   PATCH
   /api/hr-requests/:id

   Used for classification, assignment,
   priority changes and status changes.

   Body can contain:

   {
     "category": "payroll",
     "priority": "high",
     "status": "classified",
     "assigned_to": "USER_UUID"
   }
========================================================= */

router.patch("/:id", async (req, res) => {
  try {
    const requestId =
      req.params.id;

    if (!isUuid(requestId)) {
      return res.status(400).json({
        message:
          "Invalid HR request ID",
      });
    }

    /* -------------------------------------------------------
       CHECK REQUEST EXISTS
    ------------------------------------------------------- */

    const {
      data: existingRequest,
      error: existingError,
    } = await supabaseAdmin
      .from("hr_requests")
      .select("*")
      .eq(
        "id",
        requestId,
      )
      .eq(
        "organization_id",
        req.organization.id,
      )
      .maybeSingle();

    if (existingError) {
      console.error(
        "Find HR request error:",
        existingError,
      );

      return res.status(500).json({
        message:
          "Could not find HR request",
      });
    }

    if (!existingRequest) {
      return res.status(404).json({
        message:
          "HR request not found",
      });
    }

    /* -------------------------------------------------------
       BUILD UPDATE
    ------------------------------------------------------- */

    const updates = {};

    if (
      req.body?.title !==
      undefined
    ) {
      const title =
        cleanString(
          req.body.title,
        );

      if (!title) {
        return res.status(400).json({
          message:
            "Request title cannot be empty",
        });
      }

      if (title.length > 200) {
        return res.status(400).json({
          message:
            "Request title must be 200 characters or less",
        });
      }

      updates.title = title;
    }

    if (
      req.body?.description !==
      undefined
    ) {
      const description =
        cleanOptionalString(
          req.body.description,
        );

      if (
        description &&
        description.length > 5000
      ) {
        return res.status(400).json({
          message:
            "Request description must be 5000 characters or less",
        });
      }

      updates.description =
        description;
    }

    if (
      req.body?.category !==
      undefined
    ) {
      const category =
        cleanString(
          req.body.category,
        ).toLowerCase();

      updates.category =
        category || "general";
    }

    if (
      req.body?.priority !==
      undefined
    ) {
      updates.priority =
        normalizePriority(
          req.body.priority,
        );
    }

    if (
      req.body?.status !==
      undefined
    ) {
      const status =
        cleanString(
          req.body.status,
        ).toLowerCase();

      if (
        !REQUEST_STATUSES.includes(
          status,
        )
      ) {
        return res.status(400).json({
          message:
            `Invalid status. Allowed statuses: ${REQUEST_STATUSES.join(
              ", ",
            )}`,
        });
      }

      updates.status =
        status;

      /* -----------------------------------------------------
         RESOLUTION TIMESTAMP
      ----------------------------------------------------- */

      if (
        status === "resolved"
      ) {
        updates.resolved_at =
          new Date().toISOString();
      }

      if (
        status !== "resolved" &&
        existingRequest.status ===
          "resolved"
      ) {
        updates.resolved_at =
          null;
      }
    }

    if (
      req.body?.assigned_to !==
      undefined
    ) {
      const assignedTo =
        cleanOptionalString(
          req.body.assigned_to,
        );

      if (
        assignedTo &&
        !isUuid(assignedTo)
      ) {
        return res.status(400).json({
          message:
            "assigned_to must be a valid user ID",
        });
      }

      /* -----------------------------------------------------
         IF ASSIGNED, VERIFY USER BELONGS
         TO THE SAME ORGANIZATION
      ----------------------------------------------------- */

      if (assignedTo) {
        const {
          data: member,
          error: memberError,
        } = await supabaseAdmin
          .from(
            "organization_members",
          )
          .select(
            "user_id",
          )
          .eq(
            "organization_id",
            req.organization.id,
          )
          .eq(
            "user_id",
            assignedTo,
          )
          .maybeSingle();

        if (memberError) {
          console.error(
            "Verify HR request assignee error:",
            memberError,
          );

          return res.status(500).json({
            message:
              "Could not verify assignee",
          });
        }

        if (!member) {
          return res.status(400).json({
            message:
              "Assigned user must belong to this organization",
          });
        }
      }

      updates.assigned_to =
        assignedTo;

      /* -----------------------------------------------------
         AUTOMATIC STATUS TRANSITION
      ----------------------------------------------------- */

      if (
        assignedTo &&
        existingRequest.status ===
          "submitted"
      ) {
        updates.status =
          "assigned";
      }
    }

    /* -------------------------------------------------------
       RESOLUTION NOTE
    ------------------------------------------------------- */

    if (
      req.body?.resolution_note !==
      undefined
    ) {
      const resolutionNote =
        cleanOptionalString(
          req.body.resolution_note,
        );

      if (
        resolutionNote &&
        resolutionNote.length > 5000
      ) {
        return res.status(400).json({
          message:
            "Resolution note must be 5000 characters or less",
        });
      }

      updates.resolution_note =
        resolutionNote;
    }

    /* -------------------------------------------------------
       ALWAYS UPDATE updated_at
    ------------------------------------------------------- */

    updates.updated_at =
      new Date().toISOString();

    /* -------------------------------------------------------
       NOTHING TO UPDATE
    ------------------------------------------------------- */

    if (
      Object.keys(updates)
        .length === 1 &&
      updates.updated_at
    ) {
      return res.status(400).json({
        message:
          "No changes were provided",
      });
    }

    /* -------------------------------------------------------
       UPDATE DATABASE
    ------------------------------------------------------- */

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("hr_requests")
      .update(updates)
      .eq(
        "id",
        requestId,
      )
      .eq(
        "organization_id",
        req.organization.id,
      )
      .select("*")
      .single();

    if (error) {
      console.error(
        "Update HR request error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not update HR request",
      });
    }

    console.log(
      `[HR Requests] Updated request ${requestId}`,
    );

    return res.json({
      message:
        "HR request updated successfully",

      request: data,
    });
  } catch (error) {
    console.error(
      "Unexpected update HR request error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not update HR request",
    });
  }
});

/* =========================================================
   RESOLVE HR REQUEST
=========================================================

   POST
   /api/hr-requests/:id/resolve

   Body:

   {
     "resolution_note": "Issue resolved..."
   }
========================================================= */

router.post(
  "/:id/resolve",
  async (req, res) => {
    try {
      const requestId =
        req.params.id;

      if (!isUuid(requestId)) {
        return res.status(400).json({
          message:
            "Invalid HR request ID",
        });
      }

      const resolutionNote =
        cleanOptionalString(
          req.body?.resolution_note,
        );

      if (
        resolutionNote &&
        resolutionNote.length > 5000
      ) {
        return res.status(400).json({
          message:
            "Resolution note must be 5000 characters or less",
        });
      }

      /* -----------------------------------------------------
         VERIFY REQUEST
      ----------------------------------------------------- */

      const {
        data: existingRequest,
        error: existingError,
      } = await supabaseAdmin
        .from(
          "hr_requests",
        )
        .select("*")
        .eq(
          "id",
          requestId,
        )
        .eq(
          "organization_id",
          req.organization.id,
        )
        .maybeSingle();

      if (existingError) {
        console.error(
          "Find HR request before resolve error:",
          existingError,
        );

        return res.status(500).json({
          message:
            "Could not find HR request",
        });
      }

      if (!existingRequest) {
        return res.status(404).json({
          message:
            "HR request not found",
        });
      }

      if (
        existingRequest.status ===
        "resolved"
      ) {
        return res.status(400).json({
          message:
            "HR request is already resolved",
        });
      }

      /* -----------------------------------------------------
         RESOLVE
      ----------------------------------------------------- */

      const now =
        new Date().toISOString();

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "hr_requests",
        )
        .update({
          status:
            "resolved",

          resolution_note:
            resolutionNote,

          resolved_at:
            now,

          updated_at:
            now,
        })
        .eq(
          "id",
          requestId,
        )
        .eq(
          "organization_id",
          req.organization.id,
        )
        .select("*")
        .single();

      if (error) {
        console.error(
          "Resolve HR request error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not resolve HR request",
        });
      }

      console.log(
        `[HR Requests] Request ${requestId} resolved by ${req.user.id}`,
      );

      return res.json({
        message:
          "HR request resolved successfully",

        request: data,
      });
    } catch (error) {
      console.error(
        "Unexpected resolve HR request error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not resolve HR request",
      });
    }
  },
);

/* =========================================================
   CANCEL HR REQUEST
=========================================================

   POST
   /api/hr-requests/:id/cancel
========================================================= */

router.post(
  "/:id/cancel",
  async (req, res) => {
    try {
      const requestId =
        req.params.id;

      if (!isUuid(requestId)) {
        return res.status(400).json({
          message:
            "Invalid HR request ID",
        });
      }

      const {
        data: existingRequest,
        error: existingError,
      } = await supabaseAdmin
        .from(
          "hr_requests",
        )
        .select("id, status")
        .eq(
          "id",
          requestId,
        )
        .eq(
          "organization_id",
          req.organization.id,
        )
        .maybeSingle();

      if (existingError) {
        console.error(
          "Find HR request before cancel error:",
          existingError,
        );

        return res.status(500).json({
          message:
            "Could not find HR request",
        });
      }

      if (!existingRequest) {
        return res.status(404).json({
          message:
            "HR request not found",
        });
      }

      if (
        existingRequest.status ===
        "resolved"
      ) {
        return res.status(400).json({
          message:
            "A resolved request cannot be cancelled",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "hr_requests",
        )
        .update({
          status:
            "cancelled",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          requestId,
        )
        .eq(
          "organization_id",
          req.organization.id,
        )
        .select("*")
        .single();

      if (error) {
        console.error(
          "Cancel HR request error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not cancel HR request",
        });
      }

      return res.json({
        message:
          "HR request cancelled successfully",

        request: data,
      });
    } catch (error) {
      console.error(
        "Unexpected cancel HR request error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not cancel HR request",
      });
    }
  },
);

/* =========================================================
   DELETE HR REQUEST
=========================================================

   DELETE
   /api/hr-requests/:id

   This is mainly useful for test cleanup.
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const requestId =
        req.params.id;

      if (!isUuid(requestId)) {
        return res.status(400).json({
          message:
            "Invalid HR request ID",
        });
      }

      const {
        data: existingRequest,
        error: existingError,
      } = await supabaseAdmin
        .from(
          "hr_requests",
        )
        .select("id")
        .eq(
          "id",
          requestId,
        )
        .eq(
          "organization_id",
          req.organization.id,
        )
        .maybeSingle();

      if (existingError) {
        console.error(
          "Find HR request before delete error:",
          existingError,
        );

        return res.status(500).json({
          message:
            "Could not find HR request",
        });
      }

      if (!existingRequest) {
        return res.status(404).json({
          message:
            "HR request not found",
        });
      }

      const {
        error,
      } = await supabaseAdmin
        .from(
          "hr_requests",
        )
        .delete()
        .eq(
          "id",
          requestId,
        )
        .eq(
          "organization_id",
          req.organization.id,
        );

      if (error) {
        console.error(
          "Delete HR request error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not delete HR request",
        });
      }

      console.log(
        `[HR Requests] Deleted request ${requestId}`,
      );

      return res.json({
        message:
          "HR request deleted successfully",

        id:
          requestId,
      });
    } catch (error) {
      console.error(
        "Unexpected delete HR request error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not delete HR request",
      });
    }
  },
);

/* =========================================================
   EXPORT
========================================================= */

export default router;