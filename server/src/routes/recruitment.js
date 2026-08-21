import { Router } from "express";
import multer from "multer";

import { requireAuth } from "../middleware/auth.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";
import {
  extractResumeText,
  analyzeResume,
} from "../services/resumeScreeningService.js";

const router = Router();

router.use(requireAuth);

async function requireOrganization(req, res, next) {
  try {
    const organization = await getOrganizationForUser(
      req.user.id
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
      "Recruitment organization lookup error:",
      error
    );

    return res.status(500).json({
      message: "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

const resumeUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error(
          "Only PDF, DOC and DOCX resume files are allowed."
        )
      );
    }

    callback(null, true);
  },
});

router.post(
  "/screen",
  resumeUpload.single("resume"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload a resume.",
        });
      }

      const {
        jobTitle,
        jobDescription,
        requiredSkills,
        preferredSkills,
        experience,
        education,
      } = req.body || {};

      if (!jobTitle?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Job title is required.",
        });
      }

      if (!jobDescription?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Job description is required.",
        });
      }

      if (!requiredSkills?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "At least one required skill is required.",
        });
      }

      console.log("");
      console.log(
        "================================================="
      );
      console.log("RESUME SCREENING REQUEST");
      console.log(
        "================================================="
      );
      console.log(
        "File:",
        req.file.originalname
      );
      console.log(
        "MIME:",
        req.file.mimetype
      );
      console.log(
        "Size:",
        req.file.size,
        "bytes"
      );
      console.log(
        "Job title:",
        jobTitle
      );
      console.log(
        "Required skills:",
        requiredSkills
      );
      console.log(
        "Preferred skills:",
        preferredSkills ||
          "None specified"
      );
      console.log(
        "Experience:",
        experience ||
          "Not specified"
      );
      console.log(
        "Education:",
        education ||
          "Not specified"
      );
      console.log(
        "================================================="
      );

      /*
       * STEP 1
       * Extract the REAL text from the uploaded resume.
       */
      const resumeText =
        await extractResumeText(
          req.file
        );

      console.log(
        "[SCREENING] Extracted resume characters:",
        resumeText.length
      );

      /*
       * STEP 2
       * Run the complete analytics engine.
       */
      const analysis =
        analyzeResume({
          resumeText,

          jobTitle:
            jobTitle.trim(),

          jobDescription:
            jobDescription.trim(),

          requiredSkills:
            requiredSkills.trim(),

          preferredSkills:
            preferredSkills?.trim() ||
            "",

          experience:
            experience?.trim() ||
            "",

          education:
            education?.trim() ||
            "",
        });

      console.log("");
      console.log(
        "================================================="
      );
      console.log(
        "RESUME SCREENING COMPLETED"
      );
      console.log(
        "================================================="
      );

      console.log(
        "Score:",
        analysis.score
      );

      console.log(
        "Verdict:",
        analysis.verdict
      );

      console.log(
        "Required matched:",
        analysis.skills
          .required
          .matched
      );

      console.log(
        "Required missing:",
        analysis.skills
          .required
          .missing
      );

      console.log(
        "Preferred matched:",
        analysis.skills
          .preferred
          .matched
      );

      console.log(
        "Preferred missing:",
        analysis.skills
          .preferred
          .missing
      );

      console.log(
        "Experience:",
        analysis.experience
      );

      console.log(
        "Education:",
        analysis.education
      );

      console.log(
        "================================================="
      );

      /*
       * STEP 3
       * Send both the extracted resume and
       * the complete analytics back to frontend.
       */
      return res.status(200).json({
        success: true,

        message:
          "Resume processed and analyzed successfully.",

        candidate: {
          fileName:
            req.file.originalname,

          fileSize:
            req.file.size,

          mimeType:
            req.file.mimetype,
        },

        screeningCriteria: {
          jobTitle:
            jobTitle.trim(),

          jobDescription:
            jobDescription.trim(),

          requiredSkills:
            requiredSkills.trim(),

          preferredSkills:
            preferredSkills?.trim() ||
            "",

          experience:
            experience?.trim() ||
            "",

          education:
            education?.trim() ||
            "",
        },

        extraction: {
          success: true,

          characterCount:
            resumeText.length,

          resumeText,
        },

        analysis,
      });
    } catch (error) {
      console.error("");
      console.error(
        "================================================="
      );
      console.error(
        "RESUME SCREENING ERROR"
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
          "Could not process the resume.",
      });
    }
  }
);

/*
 * Multer errors
 */
router.use(
  (error, req, res, next) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Resume file is too large. Maximum size is 5 MB.",
        });
      }

      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "Resume upload failed.",
      });
    }

    if (error) {
      console.error(
        "Recruitment upload error:",
        error
      );

      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "Resume upload failed.",
      });
    }

    next();
  }
);

export default router;