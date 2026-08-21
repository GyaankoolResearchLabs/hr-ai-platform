import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "[Learning] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing."
  );
}

const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceKey || "placeholder-service-role-key"
);

export async function generateCourse(req, res) {
  try {
    console.log("[Learning] Course generation request received.");

    const {
      sourceTitle,
      sourceContent,
      courseTitle,
      description,
      difficulty,
      estimatedDurationMinutes,
    } = req.body;

    if (!sourceContent || !sourceContent.trim()) {
      return res.status(400).json({
        success: false,
        message: "Source content is required.",
      });
    }

    if (!courseTitle || !courseTitle.trim()) {
      return res.status(400).json({
        success: false,
        message: "Course title is required.",
      });
    }

    /*
     * Your existing auth middleware should attach the authenticated
     * user to req.user.
     */
    const userId =
      req.user?.id ||
      req.user?.user_id ||
      req.user?.sub ||
      null;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found.",
      });
    }

    console.log("[Learning] Authenticated user:", userId);

    /*
     * Find the organization belonging to the logged-in user.
     */
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error(
        "[Learning] Organization lookup error:",
        membershipError
      );

      return res.status(500).json({
        success: false,
        message: "Failed to determine organization.",
        error: membershipError.message,
      });
    }

    if (!membership?.organization_id) {
      return res.status(400).json({
        success: false,
        message: "No organization found for this user.",
      });
    }

    const organizationId = membership.organization_id;

    console.log("[Learning] Organization:", organizationId);

    /*
     * ---------------------------------------------------------
     * 1. CREATE COURSE
     * ---------------------------------------------------------
     */

    const { data: course, error: courseError } = await supabase
      .from("learning_courses")
      .insert({
        organization_id: organizationId,
        title: courseTitle.trim(),
        description: description?.trim() || null,
        status: "draft",
        difficulty: difficulty || "beginner",
        estimated_duration_minutes:
          Number(estimatedDurationMinutes) || 30,
        learning_objectives: [],
        generated_by_user_id: userId,
      })
      .select()
      .single();

    if (courseError) {
      console.error("[Learning] Course creation error:", courseError);

      return res.status(500).json({
        success: false,
        message: "Failed to create course.",
        error: courseError.message,
      });
    }

    console.log("[Learning] Course created:", course.id);

    /*
     * ---------------------------------------------------------
     * 2. SAVE SOURCE CONTENT
     * ---------------------------------------------------------
     */

    const { data: source, error: sourceError } = await supabase
      .from("learning_course_sources")
      .insert({
        organization_id: organizationId,
        course_id: course.id,
        source_type: "text",
        title: sourceTitle?.trim() || courseTitle.trim(),
        source_content: sourceContent.trim(),
        metadata: {
          generated_by: "ai-course-generator",
        },
        created_by_user_id: userId,
      })
      .select()
      .single();

    if (sourceError) {
      console.error("[Learning] Source creation error:", sourceError);

      /*
       * Remove the course if source creation fails so we don't
       * leave an incomplete course behind.
       */
      await supabase
        .from("learning_courses")
        .delete()
        .eq("id", course.id);

      return res.status(500).json({
        success: false,
        message: "Failed to save source content.",
        error: sourceError.message,
      });
    }

    console.log("[Learning] Source created:", source.id);

    /*
     * ---------------------------------------------------------
     * 3. CREATE COURSE STRUCTURE
     * ---------------------------------------------------------
     *
     * For the first working version we generate a useful
     * structure directly from the supplied content.
     *
     * Once the complete pipeline is working, we can replace
     * this section with Claude/AI generation.
     */

    const cleanedContent = sourceContent
      .trim()
      .replace(/\r/g, "");

    const paragraphs = cleanedContent
      .split(/\n\s*\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    const usableParagraphs =
      paragraphs.length > 0
        ? paragraphs
        : [cleanedContent];

    const moduleCount = Math.min(
      Math.max(usableParagraphs.length, 1),
      5
    );

    const modules = [];

    for (let i = 0; i < moduleCount; i++) {
      const paragraph =
        usableParagraphs[i] ||
        usableParagraphs[usableParagraphs.length - 1];

      const moduleTitle =
        paragraph
          .split(/[.!?\n]/)
          .map((part) => part.trim())
          .find((part) => part.length >= 4)
          ?.slice(0, 80) ||
        `Module ${i + 1}`;

      const { data: module, error: moduleError } = await supabase
        .from("learning_course_modules")
        .insert({
          organization_id: organizationId,
          course_id: course.id,
          title:
            moduleTitle.charAt(0).toUpperCase() +
            moduleTitle.slice(1),
          description:
            paragraph.slice(0, 300) ||
            `Learning module ${i + 1}`,
          position: i,
          learning_objectives: [
            `Understand the key concepts covered in ${moduleTitle}.`,
            "Apply the concepts to practical workplace situations.",
          ],
          estimated_duration_minutes: Math.max(
            Math.round(
              (Number(estimatedDurationMinutes) || 30) /
                moduleCount
            ),
            5
          ),
        })
        .select()
        .single();

      if (moduleError) {
        console.error(
          "[Learning] Module creation error:",
          moduleError
        );

        return res.status(500).json({
          success: false,
          message: "Failed to create course modules.",
          error: moduleError.message,
        });
      }

      modules.push(module);

      /*
       * -------------------------------------------------------
       * LESSON
       * -------------------------------------------------------
       */

      const lessonContent =
        paragraph.length > 1000
          ? paragraph.slice(0, 1000) + "..."
          : paragraph;

      const { data: lesson, error: lessonError } = await supabase
        .from("learning_course_lessons")
        .insert({
          organization_id: organizationId,
          course_id: course.id,
          module_id: module.id,
          title: `${module.title} - Lesson`,
          description: `Core learning content for ${module.title}.`,
          lesson_type: "content",
          content: lessonContent,
          position: 0,
          estimated_duration_minutes: Math.max(
            Math.round(
              (Number(estimatedDurationMinutes) || 30) /
                moduleCount
            ),
            5
          ),
          learning_objectives: [
            `Understand ${module.title}.`,
            "Apply the knowledge in practice.",
          ],
        })
        .select()
        .single();

      if (lessonError) {
        console.error(
          "[Learning] Lesson creation error:",
          lessonError
        );

        return res.status(500).json({
          success: false,
          message: "Failed to create course lessons.",
          error: lessonError.message,
        });
      }

      /*
       * -------------------------------------------------------
       * ASSESSMENT
       * -------------------------------------------------------
       */

      const { data: assessment, error: assessmentError } =
        await supabase
          .from("learning_course_assessments")
          .insert({
            organization_id: organizationId,
            course_id: course.id,
            module_id: module.id,
            title: `${module.title} Assessment`,
            description: `Assessment for ${module.title}.`,
            assessment_type: "quiz",
            passing_score: 70,
            position: 0,
          })
          .select()
          .single();

      if (assessmentError) {
        console.error(
          "[Learning] Assessment creation error:",
          assessmentError
        );

        return res.status(500).json({
          success: false,
          message: "Failed to create assessments.",
          error: assessmentError.message,
        });
      }

      /*
       * -------------------------------------------------------
       * ASSESSMENT QUESTION
       * -------------------------------------------------------
       */

      const { error: questionError } = await supabase
        .from("learning_assessment_questions")
        .insert({
          organization_id: organizationId,
          assessment_id: assessment.id,
          question: `What is the main topic covered in "${module.title}"?`,
          question_type: "multiple_choice",
          options: [
            module.title,
            "Employee payroll",
            "Recruitment administration",
            "Office attendance",
          ],
          correct_answer: module.title,
          explanation: `The lesson focuses on ${module.title}.`,
          points: 1,
          position: 0,
        });

      if (questionError) {
        console.error(
          "[Learning] Question creation error:",
          questionError
        );

        return res.status(500).json({
          success: false,
          message: "Failed to create assessment questions.",
          error: questionError.message,
        });
      }
    }

    /*
     * ---------------------------------------------------------
     * 4. UPDATE COURSE OBJECTIVES
     * ---------------------------------------------------------
     */

    const learningObjectives = [
      "Understand the key concepts covered in the source material.",
      "Apply the concepts in practical workplace situations.",
      "Demonstrate understanding through assessments.",
    ];

    const { data: updatedCourse, error: updateError } =
      await supabase
        .from("learning_courses")
        .update({
          learning_objectives: learningObjectives,
          updated_at: new Date().toISOString(),
        })
        .eq("id", course.id)
        .select()
        .single();

    if (updateError) {
      console.error(
        "[Learning] Course update error:",
        updateError
      );

      return res.status(500).json({
        success: false,
        message: "Course was created but failed to finalize.",
        error: updateError.message,
      });
    }

    console.log(
      "[Learning] Course generation completed:",
      updatedCourse.id
    );

    return res.status(201).json({
      success: true,
      message: "Course generated successfully.",
      course: updatedCourse,
    });
  } catch (error) {
    console.error("[Learning] Unexpected error:", error);

    return res.status(500).json({
      success: false,
      message: "Course generation failed.",
      error: error.message,
    });
  }
}