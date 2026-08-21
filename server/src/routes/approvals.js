import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

router.use(requireAuth);

async function requireOrganization(req, res, next) {
  try {
    const organization = await getOrganizationForUser(req.user.id);

    if (!organization) {
      return res.status(403).json({
        message: "Complete organization setup first",
      });
    }

    req.organization = organization;
    next();
  } catch (error) {
    console.error("Approval organization lookup error:", error);

    return res.status(500).json({
      message: "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

const APPROVER_TYPES = ["user", "role", "manager"];

const REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
];

const PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
];

const ACTIONS = [
  "submitted",
  "assigned",
  "approved",
  "rejected",
  "cancelled",
  "commented",
];

function cleanString(value) {
  return String(value ?? "").trim();
}

function cleanOptionalString(value) {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? ""),
  );
}

async function isOrganizationMember(
  organizationId,
  userId,
) {
  if (!organizationId || !userId) {
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function getFirstMemberForRole(
  organizationId,
  role,
) {
  // First look for an exact role match.
  const { data: exactMember, error: exactError } =
    await supabaseAdmin
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", organizationId)
      .eq("role", role)
      .limit(1)
      .maybeSingle();

  if (exactError) {
    throw exactError;
  }

  if (exactMember) {
    return exactMember;
  }

  // The organization owner is also the highest-level
  // administrative approver. If no manager exists,
  // use the organization owner as the manager fallback.
  if (role === "manager") {
    const { data: ownerMember, error: ownerError } =
      await supabaseAdmin
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", organizationId)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle();

    if (ownerError) {
      throw ownerError;
    }

    if (ownerMember) {
      return {
        user_id: ownerMember.user_id,
        role: "manager",
      };
    }
  }

  return null;
}

async function resolveApprover({
  organizationId,
  approverType,
  approverUserId,
  approverRole,
  managerUserId = null,
}) {
  if (approverType === "user") {
    if (!isUuid(approverUserId)) {
      return {
        error: "A valid approver user is required",
      };
    }

    const member = await isOrganizationMember(
      organizationId,
      approverUserId,
    );

    if (!member) {
      return {
        error:
          "Approver must belong to this organization",
      };
    }

    return {
      approverUserId,
      approverRole: null,
    };
  }

  if (approverType === "role") {
    const role = cleanString(approverRole);

    if (!role) {
      return {
        error: "Approver role is required",
      };
    }

    const member = await getFirstMemberForRole(
      organizationId,
      role,
    );

    if (!member) {
      return {
        error: `No organization member is currently assigned the role '${role}'`,
      };
    }

    return {
      approverUserId: member.user_id,
      approverRole: role,
    };
  }

  if (approverType === "manager") {
    if (!isUuid(managerUserId)) {
      return {
        error:
          "Manager routing requires manager_user_id in the request data",
      };
    }

    const member = await isOrganizationMember(
      organizationId,
      managerUserId,
    );

    if (!member) {
      return {
        error:
          "Manager must belong to this organization",
      };
    }

    return {
      approverUserId: managerUserId,
      approverRole: "manager",
    };
  }

  return {
    error: "Unsupported approver type",
  };
}

async function writeAction({
  organizationId,
  requestId,
  actorUserId,
  action,
  comment = null,
  metadata = {},
}) {
  if (!ACTIONS.includes(action)) {
    throw new Error(
      `Invalid approval action: ${action}`,
    );
  }

  const { error } = await supabaseAdmin
    .from("hr_approval_actions")
    .insert({
      organization_id: organizationId,
      request_id: requestId,
      actor_user_id: actorUserId,
      action,
      comment: cleanOptionalString(comment),
      metadata: isPlainObject(metadata)
        ? metadata
        : {},
    });

  if (error) {
    throw error;
  }
}

async function getRequestForOrganization(
  requestId,
  organizationId,
) {
  const { data, error } = await supabaseAdmin
    .from("hr_approval_requests")
    .select("*")
    .eq("id", requestId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

function validateRulePayload(body = {}) {
  const name = cleanString(body.name);

  const requestType = cleanString(
    body.request_type,
  );

  const approverType = cleanString(
    body.approver_type,
  );

  const approverUserId =
    cleanOptionalString(
      body.approver_user_id,
    );

  const approverRole =
    cleanOptionalString(
      body.approver_role,
    );

  const priority = Number.isInteger(
    Number(body.priority),
  )
    ? Number(body.priority)
    : 100;

  const errors = [];

  if (!name) {
    errors.push("Rule name is required");
  }

  if (!requestType) {
    errors.push("Request type is required");
  }

  if (!APPROVER_TYPES.includes(approverType)) {
    errors.push(
      `approver_type must be one of: ${APPROVER_TYPES.join(
        ", ",
      )}`,
    );
  }

  if (
    approverType === "user" &&
    !approverUserId
  ) {
    errors.push(
      "approver_user_id is required for user routing",
    );
  }

  if (
    approverType === "role" &&
    !approverRole
  ) {
    errors.push(
      "approver_role is required for role routing",
    );
  }

  if (priority < 0) {
    errors.push(
      "priority cannot be negative",
    );
  }

  return {
    errors,
    name,
    requestType,
    approverType,
    approverUserId,
    approverRole,
    priority,
  };
}

/* =========================================================
   APPROVAL RULES
========================================================= */

router.get("/rules", async (req, res) => {
  try {
    const { data, error } =
      await supabaseAdmin
        .from("hr_approval_rules")
        .select("*")
        .eq(
          "organization_id",
          req.organization.id,
        )
        .order("priority", {
          ascending: true,
        })
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      console.error(
        "Load approval rules error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load approval rules",
        detail: error.message,
      });
    }

    return res.json(data || []);
  } catch (error) {
    console.error(
      "Unexpected approval rules error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not load approval rules",
    });
  }
});

router.post("/rules", async (req, res) => {
  try {
    const {
      errors,
      name,
      requestType,
      approverType,
      approverUserId,
      approverRole,
      priority,
    } = validateRulePayload(req.body);

    if (errors.length) {
      return res.status(400).json({
        message: "Invalid approval rule",
        errors,
      });
    }

    if (approverType === "manager") {
      return res.status(400).json({
        message:
          "Manager routing is supported at request time only because the current employee model does not store a manager relationship.",
      });
    }

    const resolved =
      await resolveApprover({
        organizationId:
          req.organization.id,
        approverType,
        approverUserId,
        approverRole,
      });

    if (resolved.error) {
      return res.status(400).json({
        message: resolved.error,
      });
    }

    const conditions =
      isPlainObject(
        req.body?.conditions,
      )
        ? req.body.conditions
        : {};

    const { data, error } =
      await supabaseAdmin
        .from("hr_approval_rules")
        .insert({
          organization_id:
            req.organization.id,

          name,

          request_type:
            requestType,

          approver_type:
            approverType,

          approver_user_id:
            resolved.approverUserId,

          approver_role:
            resolved.approverRole,

          priority,

          is_active:
            req.body?.is_active !== false,

          conditions,

          created_by:
            req.user.id,
        })
        .select("*")
        .single();

    if (error) {
      console.error(
        "Create approval rule error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not create approval rule",
        detail: error.message,
      });
    }

    return res.status(201).json({
      message:
        "Approval rule created successfully",
      rule: data,
    });
  } catch (error) {
    console.error(
      "Unexpected approval rule create error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not create approval rule",
      detail:
        error?.message || null,
    });
  }
});

/* =========================================================
   APPROVAL REQUESTS
========================================================= */

router.get(
  "/requests",
  async (req, res) => {
    try {
      let query =
        supabaseAdmin
          .from(
            "hr_approval_requests",
          )
          .select("*")
          .eq(
            "organization_id",
            req.organization.id,
          )
          .order("created_at", {
            ascending: false,
          });

      const status =
        cleanOptionalString(
          req.query.status,
        );

      const requestType =
        cleanOptionalString(
          req.query.request_type,
        );

      if (status) {
        if (
          !REQUEST_STATUSES.includes(
            status,
          )
        ) {
          return res.status(400).json({
            message: `Invalid status. Use: ${REQUEST_STATUSES.join(
              ", ",
            )}`,
          });
        }

        query = query.eq(
          "status",
          status,
        );
      }

      if (requestType) {
        query = query.eq(
          "request_type",
          requestType,
        );
      }

      if (
        req.query.assigned_to_me ===
        "true"
      ) {
        query = query.eq(
          "assigned_approver_id",
          req.user.id,
        );
      }

      const { data, error } =
        await query;

      if (error) {
        console.error(
          "Load approval requests error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not load approval requests",
          detail: error.message,
        });
      }

      return res.json(data || []);
    } catch (error) {
      console.error(
        "Unexpected approval requests error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load approval requests",
      });
    }
  },
);

router.post(
  "/requests",
  async (req, res) => {
    try {
      const requestType =
        cleanString(
          req.body?.request_type,
        );

      const title =
        cleanString(
          req.body?.title,
        );

      const description =
        cleanOptionalString(
          req.body?.description,
        );

      const employeeId =
        cleanOptionalString(
          req.body?.employee_id,
        );

      const priority =
        cleanString(
          req.body?.priority ||
            "normal",
        );

      const requestData =
        isPlainObject(
          req.body?.request_data,
        )
          ? req.body.request_data
          : {};

      if (!requestType) {
        return res.status(400).json({
          message:
            "request_type is required",
        });
      }

      if (!title) {
        return res.status(400).json({
          message:
            "title is required",
        });
      }

      if (
        !PRIORITIES.includes(
          priority,
        )
      ) {
        return res.status(400).json({
          message: `Invalid priority. Use: ${PRIORITIES.join(
            ", ",
          )}`,
        });
      }

      if (employeeId) {
        if (!isUuid(employeeId)) {
          return res.status(400).json({
            message:
              "employee_id must be a valid UUID",
          });
        }

        const {
          data: employee,
          error: employeeError,
        } =
          await supabaseAdmin
            .from("employees")
            .select("id")
            .eq(
              "id",
              employeeId,
            )
            .eq(
              "organization_id",
              req.organization.id,
            )
            .maybeSingle();

        if (employeeError) {
          return res.status(500).json({
            message:
              "Could not validate employee",
            detail:
              employeeError.message,
          });
        }

        if (!employee) {
          return res.status(404).json({
            message:
              "Employee not found in this organization",
          });
        }
      }

      const {
        data: rules,
        error: rulesError,
      } =
        await supabaseAdmin
          .from(
            "hr_approval_rules",
          )
          .select("*")
          .eq(
            "organization_id",
            req.organization.id,
          )
          .eq(
            "request_type",
            requestType,
          )
          .eq(
            "is_active",
            true,
          )
          .order("priority", {
            ascending: true,
          })
          .order("created_at", {
            ascending: true,
          });

      if (rulesError) {
        console.error(
          "Load matching approval rules error:",
          rulesError,
        );

        return res.status(500).json({
          message:
            "Could not determine approval routing",
          detail:
            rulesError.message,
        });
      }

      const matchingRule =
        (rules || []).find(
          (rule) => {
            const conditions =
              isPlainObject(
                rule.conditions,
              )
                ? rule.conditions
                : {};

            const conditionEntries =
              Object.entries(
                conditions,
              );

            if (
              !conditionEntries.length
            ) {
              return true;
            }

            return conditionEntries.every(
              ([
                key,
                expectedValue,
              ]) =>
                requestData[key] ===
                expectedValue,
            );
          },
        );

      if (!matchingRule) {
        return res.status(422).json({
          message:
            "No active approval rule matches this request type and data. Create a routing rule before submitting the request.",
        });
      }

      const resolved =
        await resolveApprover({
          organizationId:
            req.organization.id,

          approverType:
            matchingRule.approver_type,

          approverUserId:
            matchingRule.approver_user_id,

          approverRole:
            matchingRule.approver_role,

          managerUserId:
            requestData.manager_user_id,
        });

      if (resolved.error) {
        return res.status(422).json({
          message:
            resolved.error,

          rule_id:
            matchingRule.id,
        });
      }

      const {
        data: request,
        error: requestError,
      } =
        await supabaseAdmin
          .from(
            "hr_approval_requests",
          )
          .insert({
            organization_id:
              req.organization.id,

            request_type:
              requestType,

            title,

            description,

            employee_id:
              employeeId,

            requested_by:
              req.user.id,

            assigned_approver_id:
              resolved.approverUserId,

            assigned_approver_role:
              resolved.approverRole,

            status:
              "pending",

            priority,

            request_data: {
              ...requestData,
              routing_rule_id:
                matchingRule.id,
            },
          })
          .select("*")
          .single();

      if (requestError) {
        console.error(
          "Create approval request error:",
          requestError,
        );

        return res.status(500).json({
          message:
            "Could not create approval request",
          detail:
            requestError.message,
        });
      }

      try {
        await writeAction({
          organizationId:
            req.organization.id,

          requestId:
            request.id,

          actorUserId:
            req.user.id,

          action:
            "submitted",

          metadata: {
            request_type:
              requestType,
          },
        });

        await writeAction({
          organizationId:
            req.organization.id,

          requestId:
            request.id,

          actorUserId:
            req.user.id,

          action:
            "assigned",

          metadata: {
            rule_id:
              matchingRule.id,

            approver_user_id:
              resolved.approverUserId,

            approver_role:
              resolved.approverRole,
          },
        });
      } catch (auditError) {
        console.error(
          "Approval audit write error:",
          auditError,
        );

        return res.status(500).json({
          message:
            "Approval request was created, but its audit trail could not be recorded",

          request,

          detail:
            auditError.message,
        });
      }

      return res.status(201).json({
        message:
          "Approval request created and routed successfully",

        request,

        routing: {
          rule_id:
            matchingRule.id,

          rule_name:
            matchingRule.name,

          approver_type:
            matchingRule.approver_type,

          approver_user_id:
            resolved.approverUserId,

          approver_role:
            resolved.approverRole,
        },
      });
    } catch (error) {
      console.error(
        "Unexpected approval request create error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not create approval request",

        detail:
          error?.message || null,
      });
    }
  },
);

router.get(
  "/requests/:id",
  async (req, res) => {
    try {
      const request =
        await getRequestForOrganization(
          req.params.id,
          req.organization.id,
        );

      if (!request) {
        return res.status(404).json({
          message:
            "Approval request not found",
        });
      }

      return res.json(request);
    } catch (error) {
      console.error(
        "Load approval request error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load approval request",
      });
    }
  },
);

/* =========================================================
   AUDIT LOG
========================================================= */

router.get(
  "/requests/:id/actions",
  async (req, res) => {
    try {
      const request =
        await getRequestForOrganization(
          req.params.id,
          req.organization.id,
        );

      if (!request) {
        return res.status(404).json({
          message:
            "Approval request not found",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "hr_approval_actions",
        )
        .select("*")
        .eq(
          "request_id",
          request.id,
        )
        .eq(
          "organization_id",
          req.organization.id,
        )
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Load approval actions error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not load approval audit trail",

          detail:
            error.message,
        });
      }

      return res.json(data || []);
    } catch (error) {
      console.error(
        "Unexpected approval actions error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load approval audit trail",
      });
    }
  },
);

/* =========================================================
   APPROVE / REJECT
========================================================= */

async function decideRequest(
  req,
  res,
  decision,
) {
  try {
    const request =
      await getRequestForOrganization(
        req.params.id,
        req.organization.id,
      );

    if (!request) {
      return res.status(404).json({
        message:
          "Approval request not found",
      });
    }

    if (
      request.status !==
      "pending"
    ) {
      return res.status(409).json({
        message: `Approval request is already ${request.status}`,
      });
    }

    if (
      request.assigned_approver_id !==
      req.user.id
    ) {
      return res.status(403).json({
        message:
          "Only the currently assigned approver can decide this request",
      });
    }

    const comment =
      cleanOptionalString(
        req.body?.comment,
      );

    const now =
      new Date().toISOString();

    const status =
      decision === "approve"
        ? "approved"
        : "rejected";

    const action = status;

    const {
      data: updatedRequest,
      error: updateError,
    } =
      await supabaseAdmin
        .from(
          "hr_approval_requests",
        )
        .update({
          status,

          decision_comment:
            comment,

          decided_at:
            now,

          updated_at:
            now,
        })
        .eq(
          "id",
          request.id,
        )
        .eq(
          "organization_id",
          req.organization.id,
        )
        .eq(
          "status",
          "pending",
        )
        .eq(
          "assigned_approver_id",
          req.user.id,
        )
        .select("*")
        .maybeSingle();

    if (updateError) {
      console.error(
        "Update approval decision error:",
        updateError,
      );

      return res.status(500).json({
        message:
          "Could not record approval decision",

        detail:
          updateError.message,
      });
    }

    if (!updatedRequest) {
      return res.status(409).json({
        message:
          "The approval request changed before your decision could be recorded",
      });
    }

    try {
      await writeAction({
        organizationId:
          req.organization.id,

        requestId:
          request.id,

        actorUserId:
          req.user.id,

        action,

        comment,

        metadata: {
          previous_status:
            request.status,
        },
      });
    } catch (auditError) {
      console.error(
        "Approval decision audit error:",
        auditError,
      );

      return res.status(500).json({
        message:
          "Decision was recorded, but the audit trail could not be written",

        request:
          updatedRequest,

        detail:
          auditError.message,
      });
    }

    return res.json({
      message:
        status === "approved"
          ? "Approval request approved successfully"
          : "Approval request rejected successfully",

      request:
        updatedRequest,
    });
  } catch (error) {
    console.error(
      "Unexpected approval decision error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not record approval decision",

      detail:
        error?.message || null,
    });
  }
}

router.post(
  "/requests/:id/approve",
  async (req, res) => {
    return decideRequest(
      req,
      res,
      "approve",
    );
  },
);

router.post(
  "/requests/:id/reject",
  async (req, res) => {
    return decideRequest(
      req,
      res,
      "reject",
    );
  },
);

/* =========================================================
   CANCEL
========================================================= */

router.post(
  "/requests/:id/cancel",
  async (req, res) => {
    try {
      const request =
        await getRequestForOrganization(
          req.params.id,
          req.organization.id,
        );

      if (!request) {
        return res.status(404).json({
          message:
            "Approval request not found",
        });
      }

      if (
        request.status !==
        "pending"
      ) {
        return res.status(409).json({
          message: `Approval request is already ${request.status}`,
        });
      }

      const now =
        new Date().toISOString();

      const {
        data: updatedRequest,
        error: updateError,
      } =
        await supabaseAdmin
          .from(
            "hr_approval_requests",
          )
          .update({
            status:
              "cancelled",

            updated_at:
              now,
          })
          .eq(
            "id",
            request.id,
          )
          .eq(
            "organization_id",
            req.organization.id,
          )
          .eq(
            "status",
            "pending",
          )
          .select("*")
          .maybeSingle();

      if (updateError) {
        console.error(
          "Cancel approval request error:",
          updateError,
        );

        return res.status(500).json({
          message:
            "Could not cancel approval request",

          detail:
            updateError.message,
        });
      }

      if (!updatedRequest) {
        return res.status(409).json({
          message:
            "Approval request could not be cancelled",
        });
      }

      try {
        await writeAction({
          organizationId:
            req.organization.id,

          requestId:
            request.id,

          actorUserId:
            req.user.id,

          action:
            "cancelled",

          comment:
            req.body?.comment,
        });
      } catch (auditError) {
        console.error(
          "Cancel audit error:",
          auditError,
        );

        return res.status(500).json({
          message:
            "Request was cancelled, but the audit trail could not be written",

          request:
            updatedRequest,

          detail:
            auditError.message,
        });
      }

      return res.json({
        message:
          "Approval request cancelled successfully",

        request:
          updatedRequest,
      });
    } catch (error) {
      console.error(
        "Unexpected approval cancellation error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not cancel approval request",
      });
    }
  },
);

export default router;