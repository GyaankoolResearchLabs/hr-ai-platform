import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";

import {
  getOrganizationForUser,
} from "../services/organizationLookup.js";

import { aiService } from "../services/aiService.js";

const router = Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION GUARD
========================================================= */

async function requireOrganization(
  req,
  res,
  next
) {
  try {
    const organization =
      await getOrganizationForUser(
        req.user.id
      );

    if (!organization) {
      return res.status(403).json({
        success: false,
        message:
          "Complete organization setup first.",
      });
    }

    req.organization =
      organization;

    next();
  } catch (error) {
    console.error(
      "[Job Description] Organization lookup error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not determine organization.",
    });
  }
}

router.use(
  requireOrganization
);

/* =========================================================
   GENERATE JOB DESCRIPTION
========================================================= */

router.post(
  "/",
  async (req, res) => {
    try {
      const {
        jobTitle,
        department,
        location,
        employmentType,
        experienceLevel,
        requiredSkills,
        preferredSkills,
        responsibilities,
        education,
        salaryRange,
        companyDescription,
      } = req.body || {};

      /* ---------------------------------------------------
         VALIDATION
      --------------------------------------------------- */

      if (!jobTitle?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Job title is required.",
        });
      }

      if (!department?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Department is required.",
        });
      }

      if (!requiredSkills?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Required skills are required.",
        });
      }

      /* ---------------------------------------------------
         ORGANIZATION CONTEXT
      --------------------------------------------------- */

      const organization =
        req.organization;

      /* ---------------------------------------------------
         AI PROMPT
      --------------------------------------------------- */

      const prompt = `
Create a professional, accurate and attractive job description
for the following role.

JOB TITLE:
${jobTitle.trim()}

DEPARTMENT:
${department.trim()}

LOCATION:
${location?.trim() || "Not specified"}

EMPLOYMENT TYPE:
${employmentType?.trim() || "Full-time"}

EXPERIENCE LEVEL:
${experienceLevel?.trim() || "Not specified"}

REQUIRED SKILLS:
${requiredSkills.trim()}

PREFERRED SKILLS:
${preferredSkills?.trim() || "None specified"}

KEY RESPONSIBILITIES:
${responsibilities?.trim() || "Determine appropriate responsibilities based on the role."}

EDUCATION:
${education?.trim() || "Not specified"}

SALARY RANGE:
${salaryRange?.trim() || "Not specified"}

COMPANY / TEAM DESCRIPTION:
${companyDescription?.trim() || "Not specified"}

ORGANIZATION:
${organization?.name || "Organization"}

Create a complete job description suitable for publishing.

Structure it using these sections:

1. Job Title
2. About the Role
3. Responsibilities
4. Required Qualifications
5. Required Skills
6. Preferred Skills
7. Education
8. Experience
9. Compensation
10. What We Offer

Do not invent specific company facts, benefits,
salary figures or technologies that were not provided.

If information is missing, write a sensible generic description
rather than pretending that specific facts were supplied.

Keep the language professional and recruitment-ready.
Avoid discriminatory requirements or protected-class criteria.
`;

      /* ---------------------------------------------------
         AI REQUEST
      --------------------------------------------------- */

      console.log("");
      console.log(
        "================================================="
      );
      console.log(
        "[Job Description] Generating"
      );
      console.log(
        "================================================="
      );
      console.log(
        "Organization:",
        organization?.name
      );
      console.log(
        "Job title:",
        jobTitle
      );
      console.log(
        "Department:",
        department
      );
      console.log(
        "================================================="
      );

      const result =
        await aiService.respond(
          prompt,
          {
            categoryId:
              "job-description-generator",

            organization: {
              id:
                organization?.id,
              name:
                organization?.name,
            },

            data: {
              jobTitle,
              department,
              location,
              employmentType,
              experienceLevel,
              requiredSkills,
              preferredSkills,
              responsibilities,
              education,
              salaryRange,
              companyDescription,
            },
          }
        );

      /* ---------------------------------------------------
         AI ERROR
      --------------------------------------------------- */

      if (
        result?.status !==
        "success"
      ) {
        return res.status(503).json({
          success: false,
          message:
            result?.reply ||
            "AI service is currently unavailable.",
          status:
            result?.status ||
            "error",
        });
      }

      /* ---------------------------------------------------
         SUCCESS
      --------------------------------------------------- */

      console.log(
        "[Job Description] Generation completed."
      );

      return res.status(200).json({
        success: true,

        jobDescription:
          result.reply,

        status:
          result.status,

        job: {
          jobTitle,
          department,
          location,
          employmentType,
          experienceLevel,
        },
      });
    } catch (error) {
      console.error("");
      console.error(
        "================================================="
      );
      console.error(
        "[Job Description] ERROR"
      );
      console.error(
        "================================================="
      );
      console.error(error);
      console.error(
        "================================================="
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Could not generate the job description.",
      });
    }
  }
);

export default router;