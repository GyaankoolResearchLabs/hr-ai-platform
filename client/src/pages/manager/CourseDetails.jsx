import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  Layers3,
  Loader2,
  Pencil,
  Target,
  ClipboardCheck,
  CircleAlert,
} from "lucide-react";

import toast from "react-hot-toast";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function formatDuration(minutes) {
  const value = Number(minutes);

  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }

  if (value < 60) {
    return `${value} min`;
  }

  const hours = Math.floor(value / 60);
  const remaining = value % 60;

  if (remaining === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remaining} min`;
}

function formatDifficulty(value) {
  if (!value) {
    return "—";
  }

  return String(value)
    .charAt(0)
    .toUpperCase() +
    String(value).slice(1);
}

function formatStatus(value) {
  if (!value) {
    return "—";
  }

  return String(value)
    .charAt(0)
    .toUpperCase() +
    String(value).slice(1);
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getModuleLessons(module) {
  return Array.isArray(module?.lessons)
    ? module.lessons
    : [];
}

function getModuleAssessments(module) {
  return Array.isArray(module?.assessments)
    ? module.assessments
    : [];
}

/*
 * =========================================================
 * SMALL UI COMPONENTS
 * =========================================================
 */

function StatCard({
  icon,
  label,
  value,
  description,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </p>

          {description && (
            <p className="mt-1 text-xs text-slate-400">
              {description}
            </p>
          )}
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <CircleAlert
        size={24}
        className="mx-auto text-slate-400"
      />

      <h3 className="mt-3 text-sm font-semibold text-slate-700">
        {title}
      </h3>

      {description && (
        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

/*
 * =========================================================
 * LESSON CARD
 * =========================================================
 */

function LessonCard({
  lesson,
  lessonIndex,
}) {
  const [open, setOpen] = useState(
    lessonIndex === 0
  );

  const objectives = Array.isArray(
    lesson?.learning_objectives
  )
    ? lesson.learning_objectives
    : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Lesson Header */}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">
            {lessonIndex + 1}
          </div>

          <div className="min-w-0">
            <h4 className="font-semibold text-slate-900">
              {lesson?.title || "Untitled lesson"}
            </h4>

            {lesson?.description && (
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {lesson.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {lesson?.estimated_duration_minutes && (
            <div className="hidden items-center gap-1 text-xs text-slate-400 sm:flex">
              <Clock3 size={14} />

              {formatDuration(
                lesson.estimated_duration_minutes
              )}
            </div>
          )}

          {open ? (
            <ChevronUp
              size={18}
              className="text-slate-400"
            />
          ) : (
            <ChevronDown
              size={18}
              className="text-slate-400"
            />
          )}
        </div>
      </button>

      {/* Lesson Content */}

      {open && (
        <div className="border-t border-slate-200 px-5 py-5">
          {/* Content */}

          {lesson?.content ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <FileText
                  size={16}
                  className="text-slate-500"
                />

                <h5 className="text-sm font-semibold text-slate-700">
                  Lesson content
                </h5>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="whitespace-pre-line text-sm leading-7 text-slate-600">
                  {lesson.content}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">
              No lesson content available.
            </div>
          )}

          {/* Objectives */}

          {objectives.length > 0 && (
            <div className="mt-5">
              <div className="mb-3 flex items-center gap-2">
                <Target
                  size={16}
                  className="text-slate-500"
                />

                <h5 className="text-sm font-semibold text-slate-700">
                  Lesson objectives
                </h5>
              </div>

              <div className="flex flex-wrap gap-2">
                {objectives.map(
                  (objective, index) => (
                    <div
                      key={`${lesson?.id || lessonIndex}-objective-${index}`}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                    >
                      {objective}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/*
 * =========================================================
 * MODULE CARD
 * =========================================================
 */

function ModuleCard({
  module,
  index,
  initiallyOpen = false,
}) {
  const [open, setOpen] = useState(
    initiallyOpen
  );

  const lessons = getModuleLessons(module);
  const assessments =
    getModuleAssessments(module);

  const objectives = Array.isArray(
    module?.learning_objectives
  )
    ? module.learning_objectives
    : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Module Header */}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 bg-slate-50 px-5 py-5 text-left transition hover:bg-slate-100"
      >
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-semibold text-slate-700 shadow-sm">
            {index + 1}
          </div>

          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 md:text-lg">
              {module?.title ||
                `Module ${index + 1}`}
            </h3>

            {module?.description && (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                {module.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span>
                {lessons.length}{" "}
                {lessons.length === 1
                  ? "lesson"
                  : "lessons"}
              </span>

              {module?.estimated_duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock3 size={13} />

                  {formatDuration(
                    module.estimated_duration_minutes
                  )}
                </span>
              )}

              {assessments.length > 0 && (
                <span>
                  {assessments.length}{" "}
                  {assessments.length === 1
                    ? "assessment"
                    : "assessments"}
                </span>
              )}
            </div>
          </div>
        </div>

        {open ? (
          <ChevronUp
            size={20}
            className="shrink-0 text-slate-400"
          />
        ) : (
          <ChevronDown
            size={20}
            className="shrink-0 text-slate-400"
          />
        )}
      </button>

      {/* Module Content */}

      {open && (
        <div className="border-t border-slate-200 p-5">
          {/* Module Objectives */}

          {objectives.length > 0 && (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <Target
                  size={17}
                  className="text-slate-500"
                />

                <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  Module objectives
                </h4>
              </div>

              <div className="space-y-2">
                {objectives.map(
                  (objective, objectiveIndex) => (
                    <div
                      key={`${module?.id || index}-objective-${objectiveIndex}`}
                      className="flex items-start gap-3"
                    >
                      <CheckCircle2
                        size={16}
                        className="mt-0.5 shrink-0 text-slate-400"
                      />

                      <p className="text-sm leading-6 text-slate-600">
                        {objective}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Lessons */}

          <div>
            <div className="mb-3 flex items-center gap-2">
              <BookOpen
                size={17}
                className="text-slate-500"
              />

              <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Lessons
              </h4>
            </div>

            {lessons.length > 0 ? (
              <div className="space-y-3">
                {lessons.map(
                  (lesson, lessonIndex) => (
                    <LessonCard
                      key={
                        lesson?.id ||
                        `${module?.id}-${lessonIndex}`
                      }
                      lesson={lesson}
                      lessonIndex={lessonIndex}
                    />
                  )
                )}
              </div>
            ) : (
              <EmptyState
                title="No lessons available"
                description="This module does not contain any lessons yet."
              />
            )}
          </div>

          {/* Assessments */}

          {assessments.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <ClipboardCheck
                  size={17}
                  className="text-slate-500"
                />

                <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  Assessments
                </h4>
              </div>

              <div className="space-y-3">
                {assessments.map(
                  (
                    assessment,
                    assessmentIndex
                  ) => (
                    <div
                      key={
                        assessment?.id ||
                        `${module?.id}-assessment-${assessmentIndex}`
                      }
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h5 className="font-semibold text-slate-900">
                            {assessment?.title ||
                              "Assessment"}
                          </h5>

                          {assessment?.description && (
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                              {assessment.description}
                            </p>
                          )}
                        </div>

                        {assessment?.passing_score != null && (
                          <div className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                            Pass:{" "}
                            {
                              assessment.passing_score
                            }
                            %
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/*
 * =========================================================
 * MAIN COMPONENT
 * =========================================================
 */

function CourseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { organization } = useAuth();

  const organizationId =
    organization?.id;

  const [course, setCourse] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /*
   * ---------------------------------------------------------
   * LOAD COURSE
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   *
   * Nothing course-specific is hardcoded here.
   *
   * The ID comes from:
   *
   * /manager/course/:id
   *
   * Then the actual course is loaded from:
   *
   * learning_courses
   * learning_course_modules
   * learning_course_lessons
   * learning_course_assessments
   */

  useEffect(() => {
    let mounted = true;

    async function loadCourse() {
      if (!id) {
        setError("Course ID is missing.");
        setLoading(false);
        return;
      }

      if (!organizationId) {
        return;
      }

      try {
        setLoading(true);
        setError("");

        console.log(
          "[Course Details] Loading course:",
          id
        );

        console.log(
          "[Course Details] Organization:",
          organizationId
        );

        /*
         * -----------------------------------------------------
         * LOAD COURSE
         * -----------------------------------------------------
         */

        const {
          data: courseData,
          error: courseError,
        } = await supabase
          .from("learning_courses")
          .select("*")
          .eq(
            "id",
            id
          )
          .eq(
            "organization_id",
            organizationId
          )
          .maybeSingle();

        if (courseError) {
          throw courseError;
        }

        if (!courseData) {
          throw new Error(
            "Course not found."
          );
        }

        /*
         * -----------------------------------------------------
         * LOAD MODULES
         * -----------------------------------------------------
         */

        const {
          data: moduleData,
          error: moduleError,
        } = await supabase
          .from(
            "learning_course_modules"
          )
          .select("*")
          .eq(
            "course_id",
            id
          )
          .eq(
            "organization_id",
            organizationId
          )
          .order("position", {
            ascending: true,
          });

        if (moduleError) {
          throw moduleError;
        }

        /*
         * -----------------------------------------------------
         * LOAD LESSONS
         * -----------------------------------------------------
         */

        const {
          data: lessonData,
          error: lessonError,
        } = await supabase
          .from(
            "learning_course_lessons"
          )
          .select("*")
          .eq(
            "course_id",
            id
          )
          .eq(
            "organization_id",
            organizationId
          )
          .order("position", {
            ascending: true,
          });

        if (lessonError) {
          throw lessonError;
        }

        /*
         * -----------------------------------------------------
         * LOAD ASSESSMENTS
         * -----------------------------------------------------
         */

        const {
          data: assessmentData,
          error: assessmentError,
        } = await supabase
          .from(
            "learning_course_assessments"
          )
          .select("*")
          .eq(
            "course_id",
            id
          )
          .eq(
            "organization_id",
            organizationId
          )
          .order("position", {
            ascending: true,
          });

        if (assessmentError) {
          throw assessmentError;
        }

        /*
         * -----------------------------------------------------
         * BUILD COMPLETE COURSE OBJECT
         * -----------------------------------------------------
         */

        const modules =
          Array.isArray(moduleData)
            ? moduleData
            : [];

        const lessons =
          Array.isArray(lessonData)
            ? lessonData
            : [];

        const assessments =
          Array.isArray(assessmentData)
            ? assessmentData
            : [];

        const completeCourse = {
          ...courseData,

          modules: modules.map(
            (module) => ({
              ...module,

              lessons: lessons.filter(
                (lesson) =>
                  String(
                    lesson.module_id
                  ) ===
                  String(module.id)
              ),

              assessments:
                assessments.filter(
                  (assessment) =>
                    String(
                      assessment.module_id
                    ) ===
                    String(module.id)
                ),
            })
          ),
        };

        console.log(
          "[Course Details] Complete course:",
          completeCourse
        );

        if (mounted) {
          setCourse(
            completeCourse
          );
        }
      } catch (err) {
        console.error(
          "[Course Details] Failed to load course:",
          err
        );

        if (mounted) {
          setError(
            err?.message ||
              "Could not load course."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadCourse();

    return () => {
      mounted = false;
    };
  }, [
    id,
    organizationId,
  ]);

  /*
   * =========================================================
   * DERIVED DATA
   * =========================================================
   */

  const modules = useMemo(
    () =>
      Array.isArray(course?.modules)
        ? course.modules
        : [],
    [course]
  );

  const totalLessons = useMemo(
    () =>
      modules.reduce(
        (total, module) =>
          total +
          getModuleLessons(module)
            .length,
        0
      ),
    [modules]
  );

  const totalAssessments = useMemo(
    () =>
      modules.reduce(
        (total, module) =>
          total +
          getModuleAssessments(module)
            .length,
        0
      ),
    [modules]
  );

  const objectives = useMemo(
    () =>
      Array.isArray(
        course?.learning_objectives
      )
        ? course.learning_objectives
        : [],
    [course]
  );

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (
    loading ||
    !organizationId
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
          <Loader2
            size={20}
            className="animate-spin"
          />

          Loading course...
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * ERROR
   * =========================================================
   */

  if (error || !course) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <button
          type="button"
          onClick={() =>
            navigate("/manager/courses")
          }
          className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft size={16} />

          Back to courses
        </button>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <CircleAlert
            size={28}
            className="mx-auto text-red-500"
          />

          <h2 className="mt-3 text-lg font-bold text-red-900">
            Unable to load course
          </h2>

          <p className="mt-2 text-sm text-red-700">
            {error ||
              "The requested course could not be found."}
          </p>
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div className="min-w-0">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* =====================================================
            TOP NAVIGATION
        ===================================================== */}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              navigate("/manager/courses")
            }
            className="flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft size={17} />

            Back to courses
          </button>

          <button
            type="button"
            onClick={() =>
              navigate(
                `/manager/course-editor/${course.id}`
              )
            }
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Pencil size={16} />

            Edit course
          </button>
        </div>

        {/* =====================================================
            COURSE HEADER
        ===================================================== */}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    AI Generated Curriculum
                  </span>

                  {course.status && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {formatStatus(
                        course.status
                      )}
                    </span>
                  )}
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                  {course.title ||
                    "Untitled course"}
                </h1>

                {course.description && (
                  <p className="mt-4 max-w-4xl text-base leading-7 text-slate-500">
                    {course.description}
                  </p>
                )}
              </div>
            </div>

            {/* Course Metadata */}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                icon={
                  <Layers3 size={19} />
                }
                label="Modules"
                value={modules.length}
              />

              <StatCard
                icon={
                  <BookOpen size={19} />
                }
                label="Lessons"
                value={totalLessons}
              />

              <StatCard
                icon={
                  <Clock3 size={19} />
                }
                label="Duration"
                value={formatDuration(
                  course.estimated_duration_minutes
                )}
              />

              <StatCard
                icon={
                  <ClipboardCheck
                    size={19}
                  />
                }
                label="Assessments"
                value={totalAssessments}
              />
            </div>

            {/* Additional Metadata */}

            <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-slate-100 pt-5 text-sm text-slate-500">
              <div>
                <span className="font-medium text-slate-700">
                  Difficulty:
                </span>{" "}
                {formatDifficulty(
                  course.difficulty
                )}
              </div>

              <div>
                <span className="font-medium text-slate-700">
                  Created:
                </span>{" "}
                {formatDateTime(
                  course.created_at
                )}
              </div>

              {course.updated_at && (
                <div>
                  <span className="font-medium text-slate-700">
                    Updated:
                  </span>{" "}
                  {formatDateTime(
                    course.updated_at
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* =====================================================
            COURSE OBJECTIVES
        ===================================================== */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
              <Target size={19} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Learning objectives
              </h2>

              <p className="text-sm text-slate-500">
                What learners should be able to understand or perform after completing this course.
              </p>
            </div>
          </div>

          {objectives.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {objectives.map(
                (objective, index) => (
                  <div
                    key={`course-objective-${index}`}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500">
                      {index + 1}
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                      {objective}
                    </p>
                  </div>
                )
              )}
            </div>
          ) : (
            <EmptyState
              title="No learning objectives"
              description="This course does not contain learning objectives yet."
            />
          )}
        </section>

        {/* =====================================================
            COURSE MODULES
        ===================================================== */}

        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Layers3
                  size={21}
                  className="text-slate-700"
                />

                <h2 className="text-xl font-bold text-slate-900">
                  Course modules
                </h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Generated modules, lessons and assessments for this course.
              </p>
            </div>

            <span className="shrink-0 text-sm font-medium text-slate-400">
              {modules.length}{" "}
              {modules.length === 1
                ? "module"
                : "modules"}
            </span>
          </div>

          {modules.length > 0 ? (
            <div className="space-y-4">
              {modules.map(
                (module, index) => (
                  <ModuleCard
                    key={
                      module?.id ||
                      `module-${index}`
                    }
                    module={module}
                    index={index}
                    initiallyOpen={
                      index === 0
                    }
                  />
                )
              )}
            </div>
          ) : (
            <EmptyState
              title="No modules available"
              description="This course has been created but no modules have been generated yet."
            />
          )}
        </section>
      </div>
    </div>
  );
}

export default CourseDetails;