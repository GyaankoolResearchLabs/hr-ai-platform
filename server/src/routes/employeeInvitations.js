import crypto from "node:crypto";

import { Router } from "express";

import {
  requireAuth,
  requireAuthWithoutOrg,
} from "../middleware/auth.js";

import { supabaseAdmin } from "../config/supabase.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| EMPLOYEE INVITATIONS
|--------------------------------------------------------------------------
|
| Links an employees row to a Supabase auth user so an employee can log in
| to the employee portal.
|
| POST /api/employee-invitations
|   HR invites an existing employee (by employee id) — creates a pending
|   invitation and sends the Supabase invite email.
|
| POST /api/employee-invitations/accept
|   The invited employee redeems the token — links employees.user_id and
|   creates their organization_members row with role 'employee'.
|
|   This route runs BEFORE the user has an organization membership, so it
|   uses requireAuthWithoutOrg. The organization is taken from the
|   invitation row, never from the request body.
|--------------------------------------------------------------------------
*/

const INVITATION_TTL_DAYS = 14;

const EMPLOYEE_ROLE = "employee";

/* =========================================================
   HELPERS
========================================================= */

function clean(value) {
  return String(value ?? "").trim();
}

function cleanEmail(value) {
  return clean(value).toLowerCase();
}

function createInvitationToken() {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

function getExpiryTimestamp() {
  return new Date(
    Date.now() +
      INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

function getAcceptUrl(token) {
  const origin = clean(
    process.env.CLIENT_ORIGIN
  ).replace(/\/$/, "");

  const base =
    origin || "http://localhost:5173";

  return `${base}/accept-invite?token=${token}`;
}

/*
 * HR-side users are every member whose role is not 'employee'.
 * Employees invited through this route are created with role
 * 'employee' and must not be able to invite anyone.
 */
function isHrUser(req) {
  return (
    clean(req.user?.organization_role).toLowerCase() !==
    EMPLOYEE_ROLE
  );
}

function serializeInvitation(row) {
  if (!row) {
    return row;
  }

  return {
    id: row.id,
    organization_id: row.organization_id,
    employee_id: row.employee_id,
    email: row.email,
    status: row.status,
    invited_by: row.invited_by,
    expires_at: row.expires_at,
    accepted_at: row.accepted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/*
|--------------------------------------------------------------------------
| POST /api/employee-invitations
|--------------------------------------------------------------------------
| HR invites an employee by employee id.
|--------------------------------------------------------------------------
*/

router.post("/", requireAuth, async (req, res) => {
  try {
    const organizationId =
      req.user?.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        message: "Organization context is required.",
      });
    }

    if (!isHrUser(req)) {
      return res.status(403).json({
        message:
          "Only HR users can invite employees.",
      });
    }

    const employeeId = clean(
      req.body?.employeeId ??
        req.body?.employee_id
    );

    if (!employeeId) {
      return res.status(400).json({
        message: "Employee ID is required.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Load the employee inside the caller's organization
    |--------------------------------------------------------------------------
    |
    | Scoping by organization_id is what stops HR in one organization from
    | inviting an employee that belongs to another one.
    |--------------------------------------------------------------------------
    */

    const {
      data: employee,
      error: employeeError,
    } = await supabaseAdmin
      .from("employees")
      .select("id, organization_id, full_name, email, user_id")
      .eq("id", employeeId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (employeeError) {
      console.error(
        "[EmployeeInvitations] Employee lookup failed:",
        employeeError
      );

      return res.status(500).json({
        message: "Failed to load employee.",
        detail: employeeError.message,
      });
    }

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found.",
      });
    }

    if (employee.user_id) {
      return res.status(409).json({
        message:
          "This employee already has a linked user account.",
      });
    }

    const email = cleanEmail(employee.email);

    if (!email) {
      return res.status(400).json({
        message:
          "This employee has no email address to invite.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Supersede any earlier pending invitation
    |--------------------------------------------------------------------------
    */

    const {
      error: cancelError,
    } = await supabaseAdmin
      .from("employee_invitations")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("employee_id", employee.id)
      .eq("status", "pending");

    if (cancelError) {
      console.error(
        "[EmployeeInvitations] Failed to cancel previous invitations:",
        cancelError
      );

      return res.status(500).json({
        message: "Failed to create invitation.",
        detail: cancelError.message,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Create the invitation
    |--------------------------------------------------------------------------
    */

    const token = createInvitationToken();

    const {
      data: invitation,
      error: invitationError,
    } = await supabaseAdmin
      .from("employee_invitations")
      .insert({
        organization_id: organizationId,
        employee_id: employee.id,
        email,
        token,
        status: "pending",
        invited_by: req.user.id,
        expires_at: getExpiryTimestamp(),
      })
      .select()
      .single();

    if (invitationError) {
      console.error(
        "[EmployeeInvitations] POST error:",
        invitationError
      );

      return res.status(500).json({
        message: "Failed to create invitation.",
        detail: invitationError.message,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Send the Supabase invite email
    |--------------------------------------------------------------------------
    |
    | If the person already has a Supabase auth account the invite call
    | fails — that is not fatal. The invitation row is still valid and the
    | accept URL is returned so HR can share it directly.
    |--------------------------------------------------------------------------
    */

    const acceptUrl = getAcceptUrl(token);

    let emailSent = false;
    let emailError = null;

    try {
      const {
        error: inviteError,
      } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: acceptUrl,

          data: {
            employee_invitation_token: token,
            employee_id: employee.id,
            organization_id: organizationId,
            full_name: employee.full_name || null,
          },
        }
      );

      if (inviteError) {
        throw inviteError;
      }

      emailSent = true;

      console.log(
        "[EmployeeInvitations] Invite email sent:",
        email
      );
    } catch (error) {
      emailError =
        error?.message ||
        "Failed to send invite email.";

      console.warn(
        "[EmployeeInvitations] Invite email not sent:",
        emailError
      );
    }

    console.log(
      "[EmployeeInvitations] Invitation created:",
      invitation.id
    );

    return res.status(201).json({
      ...serializeInvitation(invitation),
      token,
      accept_url: acceptUrl,
      email_sent: emailSent,
      email_error: emailError,
    });
  } catch (error) {
    console.error(
      "[EmployeeInvitations] POST exception:",
      error
    );

    return res.status(500).json({
      message:
        error.message || "Failed to create invitation.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/employee-invitations/accept
|--------------------------------------------------------------------------
| The invited employee redeems their token.
|--------------------------------------------------------------------------
*/

router.post(
  "/accept",
  requireAuthWithoutOrg,
  async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          message: "Authenticated user not found.",
        });
      }

      const token = clean(req.body?.token);

      if (!token) {
        return res.status(400).json({
          message: "Invitation token is required.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Load the invitation
      |--------------------------------------------------------------------------
      */

      const {
        data: invitation,
        error: invitationError,
      } = await supabaseAdmin
        .from("employee_invitations")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (invitationError) {
        console.error(
          "[EmployeeInvitations] Invitation lookup failed:",
          invitationError
        );

        return res.status(500).json({
          message: "Failed to load invitation.",
          detail: invitationError.message,
        });
      }

      if (!invitation) {
        return res.status(404).json({
          message: "Invitation not found.",
        });
      }

      if (invitation.status !== "pending") {
        return res.status(409).json({
          message: `This invitation is already ${invitation.status}.`,
        });
      }

      if (
        invitation.expires_at &&
        new Date(invitation.expires_at).getTime() <=
          Date.now()
      ) {
        await supabaseAdmin
          .from("employee_invitations")
          .update({
            status: "expired",
            updated_at: new Date().toISOString(),
          })
          .eq("id", invitation.id)
          .eq("status", "pending");

        return res.status(410).json({
          message: "This invitation has expired.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | The token alone is not enough
      |--------------------------------------------------------------------------
      |
      | The signed-in account must be the invited address, so a leaked link
      | cannot be redeemed by somebody else.
      |--------------------------------------------------------------------------
      */

      const userEmail = cleanEmail(req.user?.email);

      if (
        !userEmail ||
        userEmail !== cleanEmail(invitation.email)
      ) {
        console.warn(
          "[EmployeeInvitations] Invitation email mismatch:",
          {
            userId,
            invitationId: invitation.id,
          }
        );

        return res.status(403).json({
          message:
            "This invitation was issued to a different email address.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Load the employee record
      |--------------------------------------------------------------------------
      */

      const {
        data: employee,
        error: employeeError,
      } = await supabaseAdmin
        .from("employees")
        .select("id, organization_id, full_name, email, user_id")
        .eq("id", invitation.employee_id)
        .eq("organization_id", invitation.organization_id)
        .maybeSingle();

      if (employeeError) {
        console.error(
          "[EmployeeInvitations] Employee lookup failed:",
          employeeError
        );

        return res.status(500).json({
          message: "Failed to load employee.",
          detail: employeeError.message,
        });
      }

      if (!employee) {
        return res.status(404).json({
          message: "Employee record no longer exists.",
        });
      }

      if (
        employee.user_id &&
        employee.user_id !== userId
      ) {
        return res.status(409).json({
          message:
            "This employee is already linked to another user account.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Link employees.user_id
      |--------------------------------------------------------------------------
      |
      | Guarded with .is("user_id", null) so two concurrent accepts cannot
      | overwrite an existing link.
      |--------------------------------------------------------------------------
      */

      let linkedEmployee = employee;

      if (!employee.user_id) {
        const {
          data: updatedEmployee,
          error: linkError,
        } = await supabaseAdmin
          .from("employees")
          .update({
            user_id: userId,
          })
          .eq("id", employee.id)
          .eq("organization_id", invitation.organization_id)
          .is("user_id", null)
          .select()
          .maybeSingle();

        if (linkError) {
          console.error(
            "[EmployeeInvitations] Failed to link employee:",
            linkError
          );

          return res.status(500).json({
            message: "Failed to link employee account.",
            detail: linkError.message,
          });
        }

        if (!updatedEmployee) {
          return res.status(409).json({
            message:
              "This employee is already linked to another user account.",
          });
        }

        linkedEmployee = updatedEmployee;
      }

      /*
      |--------------------------------------------------------------------------
      | Create the organization membership
      |--------------------------------------------------------------------------
      |
      | organization_members has unique(user_id): a user belongs to exactly
      | one organization.
      |--------------------------------------------------------------------------
      */

      const {
        data: existingMembership,
        error: membershipLookupError,
      } = await supabaseAdmin
        .from("organization_members")
        .select("id, organization_id, role")
        .eq("user_id", userId)
        .maybeSingle();

      if (membershipLookupError) {
        console.error(
          "[EmployeeInvitations] Membership lookup failed:",
          membershipLookupError
        );

        return res.status(500).json({
          message: "Failed to load organization membership.",
          detail: membershipLookupError.message,
        });
      }

      if (
        existingMembership &&
        existingMembership.organization_id !==
          invitation.organization_id
      ) {
        return res.status(409).json({
          message:
            "This user already belongs to another organization.",
        });
      }

      if (!existingMembership) {
        const {
          error: membershipError,
        } = await supabaseAdmin
          .from("organization_members")
          .insert({
            organization_id: invitation.organization_id,
            user_id: userId,
            role: EMPLOYEE_ROLE,
          });

        if (membershipError) {
          console.error(
            "[EmployeeInvitations] Failed to create membership:",
            membershipError
          );

          return res.status(500).json({
            message:
              "Failed to create organization membership.",
            detail: membershipError.message,
          });
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Mark the invitation accepted
      |--------------------------------------------------------------------------
      */

      const acceptedAt = new Date().toISOString();

      const {
        data: acceptedInvitation,
        error: acceptError,
      } = await supabaseAdmin
        .from("employee_invitations")
        .update({
          status: "accepted",
          accepted_at: acceptedAt,
          updated_at: acceptedAt,
        })
        .eq("id", invitation.id)
        .eq("status", "pending")
        .select()
        .maybeSingle();

      if (acceptError) {
        console.error(
          "[EmployeeInvitations] Failed to mark invitation accepted:",
          acceptError
        );

        return res.status(500).json({
          message: "Failed to accept invitation.",
          detail: acceptError.message,
        });
      }

      console.log(
        "[EmployeeInvitations] Invitation accepted:",
        {
          invitationId: invitation.id,
          userId,
          employeeId: linkedEmployee.id,
          organizationId: invitation.organization_id,
        }
      );

      return res.json({
        success: true,

        invitation: serializeInvitation(
          acceptedInvitation || {
            ...invitation,
            status: "accepted",
            accepted_at: acceptedAt,
          }
        ),

        employee: {
          id: linkedEmployee.id,
          full_name: linkedEmployee.full_name,
          email: linkedEmployee.email,
          organization_id: linkedEmployee.organization_id,
        },

        organization_id: invitation.organization_id,
        organization_role: EMPLOYEE_ROLE,
      });
    } catch (error) {
      console.error(
        "[EmployeeInvitations] Accept exception:",
        error
      );

      return res.status(500).json({
        message:
          error.message || "Failed to accept invitation.",
      });
    }
  }
);

export default router;
