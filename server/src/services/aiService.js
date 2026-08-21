import "dotenv/config";
import OpenAI from "openai";

/*
|--------------------------------------------------------------------------
| OPENAI CLIENT
|--------------------------------------------------------------------------
*/

const apiKey = process.env.OPENAI_API_KEY;

const openai = apiKey
  ? new OpenAI({
      apiKey,
    })
  : null;

const MODEL =
  process.env.OPENAI_MODEL ||
  "gpt-5.6-luna";

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function clean(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function cleanList(value) {
  return clean(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/*
|--------------------------------------------------------------------------
| JOB DESCRIPTION GENERATOR
|--------------------------------------------------------------------------
|
| This is the real AI-powered Job Description Generator.
|
| Frontend sends:
|
| {
|   jobTitle,
|   department,
|   location,
|   employmentType,
|   experienceLevel,
|   requiredSkills,
|   preferredSkills,
|   responsibilities,
|   education,
|   salaryRange,
|   companyDescription
| }
|
|--------------------------------------------------------------------------
*/

async function generateJobDescription(data = {}) {
  if (!openai) {
    throw new Error(
      "OpenAI API key is not configured. Add OPENAI_API_KEY to the server .env file."
    );
  }

  const jobTitle = clean(data.jobTitle);
  const department = clean(data.department);
  const location = clean(data.location);
  const employmentType =
    clean(data.employmentType) || "Full-time";
  const experienceLevel = clean(
    data.experienceLevel
  );

  const requiredSkills = cleanList(
    data.requiredSkills
  );

  const preferredSkills = cleanList(
    data.preferredSkills
  );

  const responsibilities = clean(
    data.responsibilities
  );

  const education = clean(data.education);
  const salaryRange = clean(
    data.salaryRange
  );

  const companyDescription = clean(
    data.companyDescription
  );

  /*
  |--------------------------------------------------------------------------
  | VALIDATION
  |--------------------------------------------------------------------------
  */

  if (!jobTitle) {
    throw new Error(
      "Job title is required."
    );
  }

  if (!department) {
    throw new Error(
      "Department is required."
    );
  }

  if (
    requiredSkills.length === 0
  ) {
    throw new Error(
      "At least one required skill is required."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | PROMPT
  |--------------------------------------------------------------------------
  */

  const prompt = `
You are an expert HR recruiter, talent acquisition specialist,
and professional job-description writer.

Create a high-quality, realistic, role-specific job description
for an organization's recruitment process.

IMPORTANT RULES:

1. Do not invent qualifications that conflict with the recruiter input.
2. Use the supplied requirements as the source of truth.
3. Make the JD professional and suitable for an actual job posting.
4. Avoid generic AI-sounding language.
5. Do not mention that AI was used.
6. Do not use exaggerated claims.
7. Keep the responsibilities realistic for the role and seniority.
8. Clearly distinguish required skills from preferred skills.
9. Do not add technologies that were not supplied unless they are
   absolutely necessary to describe the supplied responsibility.
10. Do not fabricate salary information.
11. If salary is not supplied, simply omit the salary section.
12. If education is not supplied, do not invent a degree requirement.
13. If location is not supplied, do not invent one.
14. Make the final output easy for an HR recruiter to copy directly
    into a recruitment portal.
15. Do not wrap the response in Markdown code fences.

RECRUITER INPUT:

Job Title:
${jobTitle}

Department:
${department}

Location:
${location || "Not specified"}

Employment Type:
${employmentType}

Experience Level:
${experienceLevel || "Not specified"}

Required Skills:
${requiredSkills.join(", ")}

Preferred Skills:
${
  preferredSkills.length
    ? preferredSkills.join(", ")
    : "None specified"
}

Responsibilities supplied by recruiter:
${
  responsibilities ||
  "Generate realistic responsibilities based on the supplied role, seniority, and skills."
}

Education:
${education || "Not specified"}

Salary Range:
${salaryRange || "Not specified"}

Company Description:
${
  companyDescription ||
  "Not provided. Keep the company context neutral and professional."
}

OUTPUT FORMAT:

JOB TITLE
[Professional title]

ABOUT THE ROLE
[2-4 concise paragraphs explaining the role]

KEY RESPONSIBILITIES
• [Responsibility]
• [Responsibility]
• [Responsibility]
• [Responsibility]
• [Responsibility]
• [Responsibility]

REQUIRED QUALIFICATIONS
• [Qualification]
• [Qualification]
• [Qualification]

REQUIRED SKILLS
• [Skill]
• [Skill]

PREFERRED SKILLS
• [Skill]
• [Skill]

EDUCATION
[Education requirement or omit this section if none was supplied]

EXPERIENCE
[Experience requirement]

LOCATION & EMPLOYMENT
[Location and employment type]

SALARY
[Only include if supplied]

ABOUT THE COMPANY
[Company description if supplied]

WHY JOIN US
Write 3-4 realistic, professional points based only on information
that can reasonably be inferred from the supplied company/role context.

FINAL REQUIREMENT:

The result must read like a professional JD written by an experienced
recruiter, not like an AI-generated template.
`;

  /*
  |--------------------------------------------------------------------------
  | OPENAI REQUEST
  |--------------------------------------------------------------------------
  */

  console.log(
    "[AI] Generating job description..."
  );

  console.log(
    "[AI] Model:",
    MODEL
  );

  console.log(
    "[AI] Job title:",
    jobTitle
  );

  const response =
    await openai.responses.create({
      model: MODEL,
      input: prompt,
    });

  /*
  |--------------------------------------------------------------------------
  | EXTRACT OUTPUT
  |--------------------------------------------------------------------------
  */

  const generatedText =
    response?.output_text?.trim();

  if (!generatedText) {
    console.error(
      "[AI] OpenAI returned no output:",
      response
    );

    throw new Error(
      "OpenAI did not return a job description."
    );
  }

  console.log(
    "[AI] Job description generated successfully."
  );

  return generatedText;
}

/*
|--------------------------------------------------------------------------
| GENERAL AI RESPONSE
|--------------------------------------------------------------------------
|
| Existing AI Assistant can continue using this function.
|
|--------------------------------------------------------------------------
*/

async function respond(
  prompt,
  context = {}
) {
  if (!openai) {
    return {
      reply:
        "The AI service is not configured. Please add OPENAI_API_KEY to the server .env file.",
      status: "error",
    };
  }

  const userPrompt = clean(prompt);

  if (!userPrompt) {
    return {
      reply:
        "Please provide a question or instruction.",
      status: "error",
    };
  }

  const category =
    clean(context?.categoryId);

  const organizationContext =
    context?.organization
      ? JSON.stringify(
          context.organization
        )
      : "";

  const systemInstruction = `
You are the AI assistant for an HR automation platform.

Your job is to help HR teams with:
- recruitment
- employee management
- onboarding
- performance
- attendance
- leave
- payroll
- employee relations
- compliance
- HR analytics
- workforce planning
- learning and development
- HR administration

Give practical, professional answers.

Do not fabricate organization-specific information.

If organization data is supplied, use it only as context.

If you do not have enough information, clearly say what is missing.

Current HR category:
${category || "General HR"}

Organization context:
${organizationContext || "None supplied"}
`;

  try {
    const response =
      await openai.responses.create({
        model: MODEL,

        input: [
          {
            role: "system",
            content: systemInstruction,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

    const reply =
      response?.output_text?.trim();

    if (!reply) {
      throw new Error(
        "OpenAI returned an empty response."
      );
    }

    return {
      reply,
      status: "success",
    };
  } catch (error) {
    console.error(
      "[AI] Assistant request failed:",
      error
    );

    return {
      reply:
        "The AI service is temporarily unavailable. Please try again.",
      status: "error",
    };
  }
}

/*
|--------------------------------------------------------------------------
| EXPORTED AI SERVICE
|--------------------------------------------------------------------------
*/

export const aiService = {
  respond,

  generateJobDescription,
};