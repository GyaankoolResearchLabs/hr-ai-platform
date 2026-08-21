import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

/* =========================================================
   TEXT NORMALIZATION
========================================================= */

function normalizeText(value = "") {
  return String(value)
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForMatching(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[–—]/g, "-")
    .replace(/[^\w+#.\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSkill(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^\w+#.\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   SKILL LIST PARSER
========================================================= */

function parseSkillList(value = "") {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => parseSkillList(item))
      .filter(Boolean);
  }

  return String(value)
    .split(/[,;\n|]+/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

/* =========================================================
   SKILL ALIASES
========================================================= */

const SKILL_ALIASES = {
  react: [
    "react",
    "react.js",
    "reactjs",
  ],

  "react.js": [
    "react",
    "react.js",
    "reactjs",
  ],

  reactjs: [
    "react",
    "react.js",
    "reactjs",
  ],

  javascript: [
    "javascript",
    "java script",
    "js",
  ],

  js: [
    "javascript",
    "java script",
    "js",
  ],

  typescript: [
    "typescript",
    "type script",
    "ts",
  ],

  ts: [
    "typescript",
    "type script",
    "ts",
  ],

  "node.js": [
    "node.js",
    "nodejs",
    "node js",
    "node",
  ],

  nodejs: [
    "node.js",
    "nodejs",
    "node js",
    "node",
  ],

  "node js": [
    "node.js",
    "nodejs",
    "node js",
    "node",
  ],

  node: [
    "node.js",
    "nodejs",
    "node js",
    "node",
  ],

  "express.js": [
    "express.js",
    "expressjs",
    "express js",
    "express",
  ],

  expressjs: [
    "express.js",
    "expressjs",
    "express js",
    "express",
  ],

  express: [
    "express.js",
    "expressjs",
    "express js",
    "express",
  ],

  mongodb: [
    "mongodb",
    "mongo db",
    "mongo",
  ],

  mongo: [
    "mongodb",
    "mongo db",
    "mongo",
  ],

  "mongo db": [
    "mongodb",
    "mongo db",
    "mongo",
  ],

  "rest api": [
    "rest api",
    "rest apis",
    "restful api",
    "restful apis",
  ],

  "rest apis": [
    "rest api",
    "rest apis",
    "restful api",
    "restful apis",
  ],

  "restful api": [
    "rest api",
    "rest apis",
    "restful api",
    "restful apis",
  ],

  sql: [
    "sql",
  ],

  mysql: [
    "mysql",
    "sql",
  ],

  postgresql: [
    "postgresql",
    "postgres",
    "sql",
  ],

  postgres: [
    "postgresql",
    "postgres",
    "sql",
  ],

  "tailwind css": [
    "tailwind css",
    "tailwindcss",
    "tailwind",
  ],

  tailwindcss: [
    "tailwind css",
    "tailwindcss",
    "tailwind",
  ],

  tailwind: [
    "tailwind css",
    "tailwindcss",
    "tailwind",
  ],

  aws: [
    "aws",
    "amazon web services",
  ],

  docker: [
    "docker",
  ],

  git: [
    "git",
  ],

  github: [
    "github",
    "git hub",
  ],

  html: [
    "html",
    "html5",
  ],

  css: [
    "css",
    "css3",
  ],

  python: [
    "python",
  ],

  java: [
    "java",
  ],

  "c++": [
    "c++",
    "cpp",
  ],

  "c#": [
    "c#",
    "c sharp",
  ],

  "power bi": [
    "power bi",
    "powerbi",
  ],

  "machine learning": [
    "machine learning",
    "ml",
  ],

  "deep learning": [
    "deep learning",
    "dl",
  ],

  "artificial intelligence": [
    "artificial intelligence",
    "ai",
  ],

  "data analysis": [
    "data analysis",
    "data analytics",
  ],

  pandas: [
    "pandas",
  ],

  numpy: [
    "numpy",
  ],

  "scikit-learn": [
    "scikit-learn",
    "scikit learn",
    "sklearn",
  ],

  tensorflow: [
    "tensorflow",
  ],

  pytorch: [
    "pytorch",
  ],

  redux: [
    "redux",
  ],

  "redux toolkit": [
    "redux toolkit",
    "redux",
  ],

  graphql: [
    "graphql",
  ],

  firebase: [
    "firebase",
  ],

  supabase: [
    "supabase",
  ],

  azure: [
    "azure",
    "microsoft azure",
  ],

  "google cloud": [
    "google cloud",
    "gcp",
    "google cloud platform",
  ],
};

/* =========================================================
   MATCHING HELPERS
========================================================= */

function escapeRegExp(value = "") {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function containsPhrase(text, phrase) {
  const normalizedText =
    normalizeForMatching(text);

  const normalizedPhrase =
    normalizeForMatching(phrase);

  if (!normalizedPhrase) {
    return false;
  }

  const escaped =
    escapeRegExp(normalizedPhrase);

  const regex = new RegExp(
    `(^|\\s)${escaped}(?=\\s|$)`,
    "i"
  );

  return regex.test(normalizedText);
}

function getSkillVariants(skill) {
  const normalized =
    cleanSkill(skill);

  const aliases =
    SKILL_ALIASES[normalized];

  if (aliases?.length) {
    return aliases;
  }

  return [skill];
}

function skillExists(resumeText, skill) {
  if (!skill?.trim()) {
    return false;
  }

  const variants =
    getSkillVariants(skill);

  return variants.some((variant) =>
    containsPhrase(
      resumeText,
      variant
    )
  );
}

/* =========================================================
   EXPERIENCE EXTRACTION
========================================================= */

function extractYears(text = "") {
  const normalized =
    String(text)
      .replace(/\+/g, "+");

  const matches =
    normalized.match(
      /(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(?:years?|yrs?)/gi
    );

  if (!matches?.length) {
    return null;
  }

  const numbers = matches
    .map((match) => {
      const number =
        match.match(
          /\d+(?:\.\d+)?/
        );

      return number
        ? Number(number[0])
        : null;
    })
    .filter(
      (value) =>
        Number.isFinite(value)
    );

  if (!numbers.length) {
    return null;
  }

  return Math.max(...numbers);
}

/* =========================================================
   EDUCATION EXTRACTION
========================================================= */

const EDUCATION_PATTERNS = [
  {
    label: "BCA",
    patterns: [
      /\bbca\b/i,
      /bachelor(?:'s)?\s+of\s+computer\s+applications/i,
    ],
  },

  {
    label: "MCA",
    patterns: [
      /\bmca\b/i,
      /master(?:'s)?\s+of\s+computer\s+applications/i,
    ],
  },

  {
    label: "B.Tech",
    patterns: [
      /\bb\.?\s*tech\b/i,
      /\bbtech\b/i,
      /bachelor(?:'s)?\s+of\s+technology/i,
    ],
  },

  {
    label: "M.Tech",
    patterns: [
      /\bm\.?\s*tech\b/i,
      /\bmtech\b/i,
      /master(?:'s)?\s+of\s+technology/i,
    ],
  },

  {
    label: "B.E.",
    patterns: [
      /\bb\.?\s*e\.?\b/i,
      /bachelor(?:'s)?\s+of\s+engineering/i,
    ],
  },

  {
    label: "M.E.",
    patterns: [
      /\bm\.?\s*e\.?\b/i,
      /master(?:'s)?\s+of\s+engineering/i,
    ],
  },

  {
    label: "Bachelor's degree",
    patterns: [
      /\bbachelor(?:'s)?\s+degree\b/i,
      /\bbachelor(?:'s)?\b/i,
    ],
  },

  {
    label: "Master's degree",
    patterns: [
      /\bmaster(?:'s)?\s+degree\b/i,
      /\bmaster(?:'s)?\b/i,
    ],
  },

  {
    label: "Computer Science",
    patterns: [
      /\bcomputer\s+science\b/i,
    ],
  },

  {
    label: "Information Technology",
    patterns: [
      /\binformation\s+technology\b/i,
      /\bit\b/i,
    ],
  },

  {
    label: "Computer Applications",
    patterns: [
      /\bcomputer\s+applications\b/i,
    ],
  },
];

function extractEducation(text = "") {
  const result = [];

  for (const item of EDUCATION_PATTERNS) {
    const found =
      item.patterns.some((pattern) =>
        pattern.test(text)
      );

    if (found) {
      result.push(item.label);
    }
  }

  return [
    ...new Set(result),
  ];
}

/* =========================================================
   EDUCATION MATCHING
========================================================= */

function normalizeEducationRequirement(
  education = ""
) {
  return normalizeForMatching(
    education
  );
}

function educationMatches(
  resumeText,
  requirement
) {
  if (!requirement?.trim()) {
    return {
      matched: true,
      reason: "No education requirement specified.",
    };
  }

  const requirementText =
    normalizeEducationRequirement(
      requirement
    );

  const resume =
    normalizeForMatching(
      resumeText
    );

  const educationAliases = {
    bca: [
      "bca",
      "bachelor of computer applications",
      "computer applications",
    ],

    mca: [
      "mca",
      "master of computer applications",
      "computer applications",
    ],

    btech: [
      "btech",
      "b tech",
      "bachelor of technology",
    ],

    "b.tech": [
      "btech",
      "b tech",
      "bachelor of technology",
    ],

    "b.e": [
      "b.e",
      "be",
      "bachelor of engineering",
    ],

    be: [
      "b.e",
      "be",
      "bachelor of engineering",
    ],

    mtech: [
      "mtech",
      "m tech",
      "master of technology",
    ],

    "m.tech": [
      "mtech",
      "m tech",
      "master of technology",
    ],

    mca: [
      "mca",
      "master of computer applications",
    ],

    "computer science": [
      "computer science",
    ],

    "information technology": [
      "information technology",
      "information tech",
    ],

    "computer applications": [
      "computer applications",
      "bca",
      "mca",
    ],

    bachelor: [
      "bachelor",
      "bca",
      "btech",
      "bachelor of technology",
      "bachelor of engineering",
      "bachelor of computer applications",
    ],

    master: [
      "master",
      "mca",
      "mtech",
      "master of technology",
      "master of engineering",
      "master of computer applications",
    ],
  };

  for (const [key, aliases] of Object.entries(
    educationAliases
  )) {
    if (
      requirementText.includes(key)
    ) {
      const matched =
        aliases.some((alias) =>
          containsPhrase(
            resume,
            alias
          )
        );

      if (matched) {
        return {
          matched: true,
          reason:
            `Resume contains education matching "${requirement}".`,
        };
      }
    }
  }

  const requirementWords =
    requirementText
      .split(/\s+/)
      .filter(
        (word) =>
          word.length >= 4
      );

  if (requirementWords.length) {
    const matchedWords =
      requirementWords.filter(
        (word) =>
          containsPhrase(
            resume,
            word
          )
      );

    if (
      matchedWords.length ===
      requirementWords.length
    ) {
      return {
        matched: true,
        reason:
          `Resume contains the requested education information.`,
      };
    }
  }

  return {
    matched: false,
    reason:
      `The resume does not clearly verify the required education: "${requirement}".`,
  };
}

/* =========================================================
   KNOWN RESUME SKILLS
========================================================= */

const KNOWN_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "React.js",
  "Node.js",
  "Express.js",
  "Python",
  "Java",
  "C",
  "C++",
  "C#",
  "HTML",
  "CSS",
  "Tailwind CSS",
  "Bootstrap",
  "Next.js",
  "Angular",
  "Vue.js",
  "Redux",
  "Redux Toolkit",
  "REST APIs",
  "REST API",
  "GraphQL",
  "MongoDB",
  "MySQL",
  "PostgreSQL",
  "SQL",
  "Supabase",
  "Firebase",
  "Git",
  "GitHub",
  "Docker",
  "AWS",
  "Azure",
  "Google Cloud",
  "Machine Learning",
  "Deep Learning",
  "Artificial Intelligence",
  "Data Analysis",
  "Data Analytics",
  "Pandas",
  "NumPy",
  "Scikit-learn",
  "TensorFlow",
  "PyTorch",
  "Power BI",
  "Tableau",
  "Excel",
  "Figma",
  "Agile",
  "Scrum",
];

function extractResumeSkills(
  resumeText = ""
) {
  return KNOWN_SKILLS.filter(
    (skill) =>
      skillExists(
        resumeText,
        skill
      )
  );
}

/* =========================================================
   REQUIRED EXPERIENCE
========================================================= */

function parseRequiredExperience(
  value = ""
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const match =
    String(value).match(
      /\d+(?:\.\d+)?/
    );

  return match
    ? Number(match[0])
    : 0;
}

/* =========================================================
   JOB DESCRIPTION ANALYSIS
========================================================= */

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "also",
  "and",
  "are",
  "because",
  "being",
  "both",
  "company",
  "could",
  "from",
  "have",
  "into",
  "more",
  "must",
  "only",
  "other",
  "our",
  "role",
  "should",
  "that",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "those",
  "using",
  "will",
  "with",
  "work",
  "working",
  "years",
  "your",
]);

function extractRelevantDescriptionTerms(
  jobDescription = ""
) {
  const normalized =
    normalizeForMatching(
      jobDescription
    );

  return [
    ...new Set(
      normalized
        .split(/\s+/)
        .filter(
          (word) =>
            word.length >= 4 &&
            !STOP_WORDS.has(word) &&
            !/^\d+$/.test(word)
        )
    ),
  ];
}

function calculateJobDescriptionScore(
  resumeText,
  jobDescription
) {
  if (!jobDescription?.trim()) {
    return {
      score: 5,
      percentage: 100,
      matchedTerms: [],
      totalTerms: 0,
    };
  }

  const terms =
    extractRelevantDescriptionTerms(
      jobDescription
    );

  if (!terms.length) {
    return {
      score: 5,
      percentage: 100,
      matchedTerms: [],
      totalTerms: 0,
    };
  }

  const matchedTerms =
    terms.filter((term) =>
      containsPhrase(
        resumeText,
        term
      )
    );

  const percentage =
    Math.round(
      (matchedTerms.length /
        terms.length) *
        100
    );

  return {
    score:
      (percentage / 100) * 5,

    percentage,

    matchedTerms,

    totalTerms: terms.length,
  };
}

/* =========================================================
   PDF EXTRACTION
   pdf-parse 2.4.5 API
========================================================= */

async function extractPdfText(
  buffer
) {
  let parser = null;

  try {
    parser =
      new PDFParse({
        data: buffer,
      });

    const result =
      await parser.getText();

    return normalizeText(
      result?.text || ""
    );
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Ignore parser cleanup errors.
      }
    }
  }
}

/* =========================================================
   DOCX EXTRACTION
========================================================= */

async function extractDocxText(
  buffer
) {
  try {
    const result =
      await mammoth.extractRawText({
        buffer,
      });

    return normalizeText(
      result?.value || ""
    );
  } catch (error) {
    console.error(
      "DOCX extraction error:",
      error
    );

    throw new Error(
      "Could not read the DOCX resume."
    );
  }
}

/* =========================================================
   RESUME EXTRACTION
========================================================= */

export async function extractResumeText(
  file
) {
  if (!file) {
    throw new Error(
      "No resume file was provided."
    );
  }

  if (!file.buffer) {
    throw new Error(
      "Resume file data is missing."
    );
  }

  const mimeType =
    String(
      file.mimetype || ""
    ).toLowerCase();

  let text = "";

  /* -------------------------------------------------------
     PDF
  ------------------------------------------------------- */

  if (
    mimeType ===
    "application/pdf"
  ) {
    try {
      text =
        await extractPdfText(
          file.buffer
        );
    } catch (error) {
      console.error(
        "PDF parsing error:",
        error
      );

      throw new Error(
        "Could not read the PDF resume. Please make sure the PDF contains selectable text."
      );
    }
  }

  /* -------------------------------------------------------
     DOCX
  ------------------------------------------------------- */

  else if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    text =
      await extractDocxText(
        file.buffer
      );
  }

  /* -------------------------------------------------------
     OLD DOC
  ------------------------------------------------------- */

  else if (
    mimeType ===
    "application/msword"
  ) {
    throw new Error(
      "Old .DOC files are not currently supported for text extraction. Please upload the resume as PDF or DOCX."
    );
  }

  /* -------------------------------------------------------
     UNKNOWN
  ------------------------------------------------------- */

  else {
    throw new Error(
      "Unsupported resume format."
    );
  }

  if (!text) {
    throw new Error(
      "Could not extract readable text from this resume."
    );
  }

  return text;
}

/* =========================================================
   RESUME ANALYSIS
========================================================= */

export function analyzeResume({
  resumeText = "",
  jobTitle = "",
  jobDescription = "",
  requiredSkills = "",
  preferredSkills = "",
  experience = "",
  education = "",
}) {
  const cleanResumeText =
    normalizeText(
      resumeText
    );

  if (!cleanResumeText) {
    throw new Error(
      "Resume contains no readable text."
    );
  }

  /* =======================================================
     REQUIRED SKILLS
  ======================================================= */

  const requiredSkillList =
    parseSkillList(
      requiredSkills
    );

  const matchedRequiredSkills =
    requiredSkillList.filter(
      (skill) =>
        skillExists(
          cleanResumeText,
          skill
        )
    );

  const missingRequiredSkills =
    requiredSkillList.filter(
      (skill) =>
        !skillExists(
          cleanResumeText,
          skill
        )
    );

  const requiredSkillPercentage =
    requiredSkillList.length
      ? Math.round(
          (matchedRequiredSkills.length /
            requiredSkillList.length) *
            100
        )
      : 100;

  /* =======================================================
     PREFERRED SKILLS
  ======================================================= */

  const preferredSkillList =
    parseSkillList(
      preferredSkills
    );

  const matchedPreferredSkills =
    preferredSkillList.filter(
      (skill) =>
        skillExists(
          cleanResumeText,
          skill
        )
    );

  const missingPreferredSkills =
    preferredSkillList.filter(
      (skill) =>
        !skillExists(
          cleanResumeText,
          skill
        )
    );

  const preferredSkillPercentage =
    preferredSkillList.length
      ? Math.round(
          (matchedPreferredSkills.length /
            preferredSkillList.length) *
            100
        )
      : 100;

  /* =======================================================
     DETECTED RESUME SKILLS
  ======================================================= */

  const detectedSkills =
    extractResumeSkills(
      cleanResumeText
    );

  /* =======================================================
     EXPERIENCE
  ======================================================= */

  const candidateExperience =
    extractYears(
      cleanResumeText
    );

  const requiredExperience =
    parseRequiredExperience(
      experience
    );

  let experienceStatus =
    "not_required";

  let experienceScore = 20;

  if (
    requiredExperience > 0
  ) {
    if (
      candidateExperience ===
      null
    ) {
      experienceStatus =
        "not_verified";

      /*
       * Do not treat an unverified
       * requirement as a failure.
       */
      experienceScore = 10;
    } else if (
      candidateExperience >=
      requiredExperience
    ) {
      experienceStatus =
        "meets_requirement";

      experienceScore = 20;
    } else {
      experienceStatus =
        "below_requirement";

      /*
       * Partial credit instead of
       * pretending the candidate has
       * zero suitability.
       */
      const ratio =
        candidateExperience /
        requiredExperience;

      experienceScore =
        Math.max(
          0,
          Math.round(
            ratio * 20
          )
        );
    }
  }

  /* =======================================================
     EDUCATION
  ======================================================= */

  const detectedEducation =
    extractEducation(
      cleanResumeText
    );

  const educationAnalysis =
    educationMatches(
      cleanResumeText,
      education
    );

  let educationScore = 10;

  if (!education?.trim()) {
    educationScore = 10;
  } else if (
    educationAnalysis.matched
  ) {
    educationScore = 10;
  } else {
    educationScore = 0;
  }

  /* =======================================================
     JOB DESCRIPTION
  ======================================================= */

  const descriptionAnalysis =
    calculateJobDescriptionScore(
      cleanResumeText,
      jobDescription
    );

  /* =======================================================
     WEIGHTED SCORING
     
     Required skills = 50
     Preferred skills = 15
     Experience      = 20
     Education       = 10
     Job relevance   = 5
     
     TOTAL = 100
  ======================================================= */

  const requiredSkillScore =
    requiredSkillList.length
      ? (requiredSkillPercentage /
          100) *
        50
      : 50;

  const preferredSkillScore =
    preferredSkillList.length
      ? (preferredSkillPercentage /
          100) *
        15
      : 15;

  const rawScore =
    requiredSkillScore +
    preferredSkillScore +
    experienceScore +
    educationScore +
    descriptionAnalysis.score;

  const score =
    Math.round(
      Math.max(
        0,
        Math.min(
          100,
          rawScore
        )
      )
    );

  /* =======================================================
     REQUIREMENT STATUS
  ======================================================= */

  const hasMissingRequiredSkills =
    missingRequiredSkills.length >
    0;

  const hasExperienceGap =
    experienceStatus ===
    "below_requirement";

  const experienceNeedsReview =
    experienceStatus ===
    "not_verified";

  const educationNeedsReview =
    education?.trim() &&
    !educationAnalysis.matched;

  /* =======================================================
     VERDICT
  ======================================================= */

  let verdict =
    "Review recommended";

  let verdictReason =
    "";

  /*
   * Missing required skills are
   * the most important blocker.
   */

  if (
    hasMissingRequiredSkills
  ) {
    verdict =
      "Not recommended";

    verdictReason =
      `The candidate is missing ${missingRequiredSkills.length} required skill${missingRequiredSkills.length === 1 ? "" : "s"}: ${missingRequiredSkills.join(", ")}.`;
  }

  /*
   * Required skills all present,
   * but experience is below requirement.
   */

  else if (
    hasExperienceGap
  ) {
    verdict =
      "Review recommended";

    verdictReason =
      `The candidate has all required skills, but the resume indicates approximately ${candidateExperience ?? 0} years of experience against the required ${requiredExperience} years.`;
  }

  /*
   * Required skills all present,
   * preferred skills all present,
   * experience verified,
   * education verified.
   */

  else if (
    score >= 85 &&
    !experienceNeedsReview &&
    !educationNeedsReview
  ) {
    verdict =
      "Strong match";

    verdictReason =
      "The candidate matches all required skills and defined preferences, and the resume supports the required experience and education criteria.";
  }

  /*
   * Good match but some information
   * requires human verification.
   */

  else if (
    score >= 70
  ) {
    verdict =
      "Review recommended";

    const reviewItems = [];

    if (
      experienceNeedsReview
    ) {
      reviewItems.push(
        "experience could not be clearly verified"
      );
    }

    if (
      educationNeedsReview
    ) {
      reviewItems.push(
        "education could not be fully verified"
      );
    }

    if (
      missingPreferredSkills.length
    ) {
      reviewItems.push(
        `missing preferred skills: ${missingPreferredSkills.join(", ")}`
      );
    }

    verdictReason =
      reviewItems.length
        ? `The candidate meets the core skill requirements, but ${reviewItems.join("; ")}.`
        : "The candidate shows good alignment with the role, but the profile should be reviewed before making a final hiring decision.";
  }

  else {
    verdict =
      "Not recommended";

    verdictReason =
      "The candidate does not demonstrate sufficient overall alignment with the defined job requirements.";
  }

  /* =======================================================
     STRENGTHS
  ======================================================= */

  const strengths = [];

  if (
    requiredSkillList.length
  ) {
    if (
      matchedRequiredSkills.length ===
      requiredSkillList.length
    ) {
      strengths.push(
        `All ${requiredSkillList.length} required skills were found in the resume.`
      );
    } else if (
      matchedRequiredSkills.length >
      0
    ) {
      strengths.push(
        `Matched ${matchedRequiredSkills.length} of ${requiredSkillList.length} required skills.`
      );
    }
  }

  if (
    preferredSkillList.length
  ) {
    if (
      matchedPreferredSkills.length ===
      preferredSkillList.length
    ) {
      strengths.push(
        `All ${preferredSkillList.length} preferred skills were found in the resume.`
      );
    } else if (
      matchedPreferredSkills.length >
      0
    ) {
      strengths.push(
        `Matched ${matchedPreferredSkills.length} of ${preferredSkillList.length} preferred skills.`
      );
    }
  }

  if (
    requiredExperience ===
    0
  ) {
    strengths.push(
      "No minimum experience requirement was specified."
    );
  } else if (
    candidateExperience !==
      null &&
    candidateExperience >=
      requiredExperience
  ) {
    strengths.push(
      `The resume indicates approximately ${candidateExperience} years of experience, meeting the ${requiredExperience}-year requirement.`
    );
  }

  if (
    education?.trim() &&
    educationAnalysis.matched
  ) {
    strengths.push(
      `Education requirement appears to be satisfied: ${education}.`
    );
  }

  if (
    detectedSkills.length
  ) {
    strengths.push(
      `Detected resume skills include: ${detectedSkills.slice(0, 12).join(", ")}.`
    );
  }

  /* =======================================================
     CONCERNS
  ======================================================= */

  const concerns = [];

  if (
    missingRequiredSkills.length
  ) {
    concerns.push(
      `Missing required skills: ${missingRequiredSkills.join(", ")}.`
    );
  }

  if (
    missingPreferredSkills.length
  ) {
    concerns.push(
      `Missing preferred skills: ${missingPreferredSkills.join(", ")}.`
    );
  }

  if (
    experienceStatus ===
    "below_requirement"
  ) {
    concerns.push(
      `Experience gap: approximately ${candidateExperience} years detected versus ${requiredExperience} years required.`
    );
  }

  if (
    experienceStatus ===
    "not_verified"
  ) {
    concerns.push(
      "Required experience could not be clearly verified from the resume."
    );
  }

  if (
    education?.trim() &&
    !educationAnalysis.matched
  ) {
    concerns.push(
      `Education requirement could not be verified: ${education}.`
    );
  }

  /* =======================================================
     MATCH LEVEL
  ======================================================= */

  let matchLevel =
    "low";

  if (
    score >= 85 &&
    !hasMissingRequiredSkills
  ) {
    matchLevel =
      "high";
  } else if (
    score >= 65
  ) {
    matchLevel =
      "moderate";
  }

  /* =======================================================
     RETURN COMPLETE ANALYTICS
  ======================================================= */

  return {
    score,

    verdict,

    verdictReason,

    matchLevel,

    candidateSummary: {
      jobTitle:
        jobTitle || "Not specified",

      overallSuitability:
        `${score}%`,

      recommendation:
        verdict,

      recommendationReason:
        verdictReason,
    },

    skills: {
      detected:
        detectedSkills,

      required: {
        total:
          requiredSkillList.length,

        matched:
          matchedRequiredSkills,

        missing:
          missingRequiredSkills,

        matchPercentage:
          requiredSkillPercentage,

        status:
          missingRequiredSkills.length ===
          0
            ? "complete"
            : "incomplete",
      },

      preferred: {
        total:
          preferredSkillList.length,

        matched:
          matchedPreferredSkills,

        missing:
          missingPreferredSkills,

        matchPercentage:
          preferredSkillPercentage,

        status:
          missingPreferredSkills.length ===
          0
            ? "complete"
            : "partial",
      },
    },

    experience: {
      requiredYears:
        requiredExperience,

      detectedYears:
        candidateExperience,

      status:
        experienceStatus,

      meetsRequirement:
        requiredExperience ===
          0 ||
        (
          candidateExperience !==
            null &&
          candidateExperience >=
            requiredExperience
        ),

      needsReview:
        experienceNeedsReview,

      score:
        Math.round(
          experienceScore
        ),
    },

    education: {
      requirement:
        education || null,

      detected:
        detectedEducation,

      matched:
        educationAnalysis.matched,

      meetsRequirement:
        !education?.trim() ||
        educationAnalysis.matched,

      needsReview:
        Boolean(
          education?.trim() &&
          !educationAnalysis.matched
        ),

      reason:
        educationAnalysis.reason,

      score:
        educationScore,
    },

    jobDescription: {
      relevancePercentage:
        descriptionAnalysis.percentage,

      matchedTerms:
        descriptionAnalysis.matchedTerms,

      totalTerms:
        descriptionAnalysis.totalTerms,
    },

    scoring: {
      requiredSkills:
        Math.round(
          requiredSkillScore
        ),

      preferredSkills:
        Math.round(
          preferredSkillScore
        ),

      experience:
        Math.round(
          experienceScore
        ),

      education:
        Math.round(
          educationScore
        ),

      jobDescription:
        Math.round(
          descriptionAnalysis.score
        ),

      total:
        score,
    },

    strengths,

    concerns,

    job: {
      title:
        jobTitle,

      description:
        jobDescription,
    },

    extraction: {
      characterCount:
        cleanResumeText.length,

      wordCount:
        cleanResumeText
          .split(/\s+/)
          .filter(Boolean)
          .length,

      text:
        cleanResumeText,
    },
  };
}