import { supabase } from "../config/supabase.js";

/* =========================================================
   SERVICE ERROR
========================================================= */

function createServiceError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/* =========================================================
   NORMALIZATION HELPERS
========================================================= */

function normalizeDifficulty(value) {
  const allowed = [
    "beginner",
    "intermediate",
    "advanced",
  ];

  return allowed.includes(value)
    ? value
    : "beginner";
}

function normalizeDuration(value) {
  const duration = Number(value);

  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  return Math.round(duration);
}

/* =========================================================
   AI COURSE GENERATION
========================================================= */

async function generateCourseContent({
  courseTitle,
  courseDescription,
  sourceContent,
  difficulty,
  estimatedDurationMinutes,
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw createServiceError(
      "ANTHROPIC_API_KEY is not configured on the server.",
      500
    );
  }

  const prompt = `
You are an expert corporate learning designer.

Create a structured employee training course from the
provided source material.

COURSE TITLE:
${courseTitle}

COURSE DESCRIPTION:
${courseDescription || "Create an appropriate description."}

DIFFICULTY:
${difficulty}

ESTIMATED DURATION:
${estimatedDurationMinutes || "Not specified"} minutes

SOURCE MATERIAL:
${sourceContent}

Return ONLY valid JSON.

Use exactly this structure:

{
  "description": "string",
  "learning_objectives": [
    "string"
  ],
  "modules": [
    {
      "title": "string",
      "description": "string",
      "learning_objectives": [
        "string"
      ],
      "estimated_duration_minutes": 15,
      "lessons": [
        {
          "title": "string",
          "description": "string",
          "content": "string",
          "lesson_type": "content",
          "estimated_duration_minutes": 10,
          "learning_objectives": [
            "string"
          ]
        }
      ],
      "assessment": {
        "title": "string",
        "description": "string",
        "passing_score": 70,
        "questions": [
          {
            "question": "string",
            "question_type": "multiple_choice",
            "options": [
              "string",
              "string",
              "string",
              "string"
            ],
            "correct_answer": "string",
            "explanation": "string",
            "points": 1
          }
        ]
      }
    }
  ]
}

Requirements:

- Create 2 to 5 modules.
- Each module should contain 2 to 5 lessons.
- Each module should contain an assessment.
- Each assessment should contain 3 to 5 questions.
- Questions must be directly based on the source material.
- Make the course practical for employees.
- Do not invent unrelated information.
- Keep lesson content useful and instructional.
- Return valid JSON only.
`;

  const response = await fetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:
          process.env.ANTHROPIC_MODEL ||
          "claude-3-5-sonnet-20241022",

        max_tokens: 12000,

        temperature: 0.2,

        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "[Learning] Anthropic API error:",
      errorText
    );

    throw createServiceError(
      "AI course generation service failed.",
      502
    );
  }

  const result = await response.json();

  const text = result?.content
    ?.filter(
      (item) => item.type === "text"
    )
    ?.map((item) => item.text)
    ?.join("")
    ?.trim();

  if (!text) {
    throw createServiceError(
      "AI returned an empty course.",
      502
    );
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    console.error(
      "[Learning] Invalid AI JSON:",
      text
    );

    throw createServiceError(
      "AI returned invalid course data.",
      502
    );
  }

  return parsed;
}

/* =========================================================
   GET COMPLETE COURSE STRUCTURE
========================================================= */

async function loadCompleteCourse(
  organizationId,
  course
) {
  const courseId = course?.id;

  if (!courseId) {
    return {
      ...course,
      modules: [],
    };
  }

  const [
    modulesResult,
    lessonsResult,
    assessmentsResult,
  ] = await Promise.all([
    supabase
      .from("learning_course_modules")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "course_id",
        courseId
      )
      .order("position"),

    supabase
      .from("learning_course_lessons")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "course_id",
        courseId
      )
      .order("position"),

    supabase
      .from(
        "learning_course_assessments"
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "course_id",
        courseId
      )
      .order("position"),
  ]);

  if (modulesResult.error) {
    throw modulesResult.error;
  }

  if (lessonsResult.error) {
    throw lessonsResult.error;
  }

  if (assessmentsResult.error) {
    throw assessmentsResult.error;
  }

  const modules =
    modulesResult.data || [];

  const lessons =
    lessonsResult.data || [];

  const assessments =
    assessmentsResult.data || [];

  return {
    ...course,

    modules: modules.map(
      (module) => ({
        ...module,

        lessons: lessons.filter(
          (lesson) =>
            lesson.module_id ===
            module.id
        ),

        assessments:
          assessments.filter(
            (assessment) =>
              assessment.module_id ===
              module.id
          ),
      })
    ),
  };
}

/* =========================================================
   SAVE GENERATED COURSE
========================================================= */

export async function generateCourse({
  organizationId,
  generatedByUserId,
  sourceTitle,
  sourceContent,
  courseTitle,
  courseDescription,
  difficulty,
  estimatedDurationMinutes,
}) {
  if (!organizationId) {
    throw createServiceError(
      "Organization ID is required.",
      400
    );
  }

  if (!courseTitle?.trim()) {
    throw createServiceError(
      "Course title is required.",
      400
    );
  }

  if (!sourceContent?.trim()) {
    throw createServiceError(
      "Source content is required.",
      400
    );
  }

  const normalizedDifficulty =
    normalizeDifficulty(difficulty);

  const normalizedDuration =
    normalizeDuration(
      estimatedDurationMinutes
    );

  /* -------------------------------------------------------
     1. GENERATE WITH AI
  ------------------------------------------------------- */

  const generated =
    await generateCourseContent({
      courseTitle,
      courseDescription,
      sourceContent,
      difficulty:
        normalizedDifficulty,
      estimatedDurationMinutes:
        normalizedDuration,
    });

  /* -------------------------------------------------------
     2. CREATE COURSE
  ------------------------------------------------------- */

  const {
    data: course,
    error: courseError,
  } = await supabase
    .from("learning_courses")
    .insert({
      organization_id:
        organizationId,

      title:
        courseTitle.trim(),

      description:
        generated.description ||
        courseDescription?.trim() ||
        null,

      status: "draft",

      difficulty:
        normalizedDifficulty,

      estimated_duration_minutes:
        normalizedDuration,

      learning_objectives:
        Array.isArray(
          generated.learning_objectives
        )
          ? generated.learning_objectives
          : [],

      generated_by_user_id:
        generatedByUserId || null,
    })
    .select("*")
    .single();

  if (courseError) {
    console.error(
      "[Learning] Course insert failed:",
      courseError
    );

    throw courseError;
  }

  try {
    /* -----------------------------------------------------
       3. SAVE SOURCE
    ----------------------------------------------------- */

    const {
      error: sourceError,
    } = await supabase
      .from("learning_course_sources")
      .insert({
        organization_id:
          organizationId,

        course_id:
          course.id,

        source_type:
          "text",

        title:
          sourceTitle?.trim() ||
          courseTitle.trim(),

        source_content:
          sourceContent,

        created_by_user_id:
          generatedByUserId || null,
      });

    if (sourceError) {
      throw sourceError;
    }

    /* -----------------------------------------------------
       4. CREATE MODULES
    ----------------------------------------------------- */

    const modules =
      Array.isArray(
        generated.modules
      )
        ? generated.modules
        : [];

    for (
      let moduleIndex = 0;
      moduleIndex < modules.length;
      moduleIndex++
    ) {
      const moduleData =
        modules[moduleIndex];

      const {
        data: module,
        error: moduleError,
      } = await supabase
        .from(
          "learning_course_modules"
        )
        .insert({
          organization_id:
            organizationId,

          course_id:
            course.id,

          title:
            moduleData.title ||
            `Module ${moduleIndex + 1}`,

          description:
            moduleData.description ||
            null,

          position:
            moduleIndex,

          learning_objectives:
            Array.isArray(
              moduleData.learning_objectives
            )
              ? moduleData.learning_objectives
              : [],

          estimated_duration_minutes:
            normalizeDuration(
              moduleData.estimated_duration_minutes
            ),
        })
        .select("*")
        .single();

      if (moduleError) {
        throw moduleError;
      }

      /* ---------------------------------------------------
         5. CREATE LESSONS
      --------------------------------------------------- */

      const lessons =
        Array.isArray(
          moduleData.lessons
        )
          ? moduleData.lessons
          : [];

      for (
        let lessonIndex = 0;
        lessonIndex < lessons.length;
        lessonIndex++
      ) {
        const lesson =
          lessons[lessonIndex];

        const {
          error: lessonError,
        } = await supabase
          .from(
            "learning_course_lessons"
          )
          .insert({
            organization_id:
              organizationId,

            course_id:
              course.id,

            module_id:
              module.id,

            title:
              lesson.title ||
              `Lesson ${lessonIndex + 1}`,

            description:
              lesson.description ||
              null,

            lesson_type:
              lesson.lesson_type ||
              "content",

            content:
              lesson.content ||
              null,

            position:
              lessonIndex,

            estimated_duration_minutes:
              normalizeDuration(
                lesson.estimated_duration_minutes
              ),

            learning_objectives:
              Array.isArray(
                lesson.learning_objectives
              )
                ? lesson.learning_objectives
                : [],
          });

        if (lessonError) {
          throw lessonError;
        }
      }

      /* ---------------------------------------------------
         6. CREATE ASSESSMENT
      --------------------------------------------------- */

      const assessmentData =
        moduleData.assessment;

      if (!assessmentData) {
        continue;
      }

      const {
        data: assessment,
        error: assessmentError,
      } = await supabase
        .from(
          "learning_course_assessments"
        )
        .insert({
          organization_id:
            organizationId,

          course_id:
            course.id,

          module_id:
            module.id,

          title:
            assessmentData.title ||
            `${moduleData.title} Assessment`,

          description:
            assessmentData.description ||
            null,

          assessment_type:
            "quiz",

          passing_score:
            Number(
              assessmentData.passing_score
            ) || 70,

          position:
            moduleIndex,
        })
        .select("*")
        .single();

      if (assessmentError) {
        throw assessmentError;
      }

      /* ---------------------------------------------------
         7. CREATE QUESTIONS
      --------------------------------------------------- */

      const questions =
        Array.isArray(
          assessmentData.questions
        )
          ? assessmentData.questions
          : [];

      for (
        let questionIndex = 0;
        questionIndex < questions.length;
        questionIndex++
      ) {
        const question =
          questions[questionIndex];

        const {
          error: questionError,
        } = await supabase
          .from(
            "learning_assessment_questions"
          )
          .insert({
            organization_id:
              organizationId,

            assessment_id:
              assessment.id,

            question:
              question.question,

            question_type:
              question.question_type ||
              "multiple_choice",

            options:
              Array.isArray(
                question.options
              )
                ? question.options
                : [],

            correct_answer:
              question.correct_answer ||
              null,

            explanation:
              question.explanation ||
              null,

            points:
              Number(
                question.points
              ) || 1,

            position:
              questionIndex,
          });

        if (questionError) {
          throw questionError;
        }
      }
    }

    console.log(
      "[Learning] Course saved successfully:",
      course.id
    );

    /* -----------------------------------------------------
       8. RETURN COMPLETE COURSE
    ----------------------------------------------------- */

    return await getCourse(
      organizationId,
      course.id
    );
  } catch (error) {
    console.error(
      "[Learning] Course generation failed after insert:",
      error
    );

    /* -----------------------------------------------------
       CLEAN UP PARTIAL COURSE
    ----------------------------------------------------- */

    try {
      await supabase
        .from("learning_courses")
        .delete()
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "id",
          course.id
        );
    } catch (cleanupError) {
      console.error(
        "[Learning] Course cleanup failed:",
        cleanupError
      );
    }

    throw error;
  }
}

/* =========================================================
   GET COURSES
   RETURNS COMPLETE COURSE STRUCTURE
========================================================= */

export async function getCourses(
  organizationId
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization ID is required.",
      400
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("learning_courses")
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (error) {
    console.error(
      "[Learning] Failed to load courses:",
      error
    );

    throw error;
  }

  const courses =
    Array.isArray(data)
      ? data
      : [];

  /*
   * IMPORTANT:
   *
   * The recommender needs module,
   * lesson and assessment content.
   *
   * Therefore GET /courses returns
   * complete course structures.
   */

  const completeCourses =
    await Promise.all(
      courses.map(
        (course) =>
          loadCompleteCourse(
            organizationId,
            course
          )
      )
    );

  return completeCourses;
}

/* =========================================================
   GET SINGLE COURSE
========================================================= */

export async function getCourse(
  organizationId,
  courseId
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization ID is required.",
      400
    );
  }

  if (!courseId) {
    throw createServiceError(
      "Course ID is required.",
      400
    );
  }

  const {
    data: course,
    error: courseError,
  } = await supabase
    .from("learning_courses")
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      courseId
    )
    .single();

  if (courseError) {
    if (
      courseError.code ===
      "PGRST116"
    ) {
      throw createServiceError(
        "Course not found.",
        404
      );
    }

    throw courseError;
  }

  return await loadCompleteCourse(
    organizationId,
    course
  );
}