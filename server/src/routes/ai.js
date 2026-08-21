import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { aiService } from "../services/aiService.js";

const router = Router();

// POST /api/ai/assistant
router.post("/assistant", requireAuth, async (req, res) => {
  const { prompt, context } = req.body || {};

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ message: "prompt is required" });
  }

  const result = await aiService.respond(prompt.trim(), context);
  res.json(result);
});
/*
|--------------------------------------------------------------------------
| JOB DESCRIPTION GENERATOR
|--------------------------------------------------------------------------
|
| POST /api/ai/job-description
|
|--------------------------------------------------------------------------
*/

router.post(
  "/job-description",
  requireAuth,
  async (req, res) => {
    try {
      console.log("");
      console.log(
        "================================================="
      );
      console.log(
        "[AI] JOB DESCRIPTION GENERATOR"
      );
      console.log(
        "================================================="
      );

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

      /*
      |--------------------------------------------------------------------------
      | VALIDATION
      |--------------------------------------------------------------------------
      */

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
            "At least one required skill is required.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | DEBUG
      |--------------------------------------------------------------------------
      */

      console.log(
        "[AI] Job title:",
        jobTitle
      );

      console.log(
        "[AI] Department:",
        department
      );

      console.log(
        "[AI] Required skills:",
        requiredSkills
      );

      console.log(
        "[AI] Preferred skills:",
        preferredSkills ||
          "None"
      );

      console.log(
        "[AI] Experience:",
        experienceLevel ||
          "Not specified"
      );

      /*
      |--------------------------------------------------------------------------
      | GENERATE
      |--------------------------------------------------------------------------
      */

      const jobDescription =
        await aiService.generateJobDescription(
          {
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
          }
        );

      /*
      |--------------------------------------------------------------------------
      | SUCCESS
      |--------------------------------------------------------------------------
      */

      console.log(
        "[AI] Job description generated successfully."
      );

      console.log(
        "================================================="
      );

      return res.status(200).json({
        success: true,

        jobDescription,

        result:
          jobDescription,

        reply:
          jobDescription,

        status: "success",
      });
    } catch (error) {
      console.error("");
      console.error(
        "================================================="
      );

      console.error(
        "[AI] JOB DESCRIPTION GENERATOR ERROR"
      );

      console.error(
        "================================================="
      );

      console.error(error);

      console.error(
        "================================================="
      );

      /*
      |--------------------------------------------------------------------------
      | OPENAI CONFIGURATION ERROR
      |--------------------------------------------------------------------------
      */

      if (
        error?.message?.includes(
          "OPENAI_API_KEY"
        )
      ) {
        return res.status(500).json({
          success: false,

          message:
            "OpenAI API key is not configured on the server.",

          detail:
            "Add OPENAI_API_KEY to server/.env and restart the backend.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | OPENAI API ERROR
      |--------------------------------------------------------------------------
      */

      if (
        error?.status ||
        error?.statusCode
      ) {
        return res.status(502).json({
          success: false,

          message:
            "The OpenAI service could not generate the job description.",

          detail:
            error?.message ||
            "OpenAI request failed.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | GENERIC ERROR
      |--------------------------------------------------------------------------
      */

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
