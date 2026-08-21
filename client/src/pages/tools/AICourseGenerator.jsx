import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Edit3,
  FileText,
  Layers3,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

const API_BASE_URL = "http://localhost:4000/api";

export default function AICourseGenerator() {
  const location = useLocation();
  const skillGapRequest = location?.state || {};

  const {
    organization,
    organizationLoading,
    organizationError,
    refreshOrganization,
  } = useAuth();

  /* =========================================================
     FORM STATE
  ========================================================= */

  const [sourceTitle, setSourceTitle] = useState(
    skillGapRequest?.sourceTitle || "Employee Safety Handbook"
  );

  const requestedSkillGaps = Array.isArray(skillGapRequest?.skillGaps)
    ? skillGapRequest.skillGaps.filter(Boolean)
    : skillGapRequest?.skillGap
      ? [skillGapRequest.skillGap]
      : [];

  const requestedSkillText = requestedSkillGaps.join(", ");

  const [sourceContent, setSourceContent] = useState(() =>
    requestedSkillText
      ? `Skill gap identified: ${requestedSkillText}

Create practical employee training that develops the identified skill gap${requestedSkillGaps.length > 1 ? "s" : ""}.

The course should explain the required knowledge and behaviors, provide practical examples and workplace scenarios, and include measurable learning objectives and an assessment.

The training must be suitable for an employee who needs to improve: ${requestedSkillText}.`
      : `Workplace Safety

All employees must follow workplace safety procedures at all times.

Employees must keep work areas clean and free from hazards.

Personal protective equipment must be used whenever required.

Employees should immediately report unsafe conditions to their manager or HR.

Emergency exits must remain clear and accessible.

In the event of an emergency, employees should follow the organization's emergency response procedures.

Managers are responsible for ensuring that employees understand applicable safety procedures and receive appropriate training.`
  );

  const [courseTitle, setCourseTitle] = useState(
    skillGapRequest?.courseTitle ||
      (requestedSkillText
        ? `${requestedSkillText} Development Training`
        : "Workplace Safety")
  );

  const [description, setDescription] = useState(
    skillGapRequest?.courseDescription ||
      (requestedSkillText
        ? `Training designed to close the identified skill gap${requestedSkillGaps.length > 1 ? "s" : ""}: ${requestedSkillText}.`
        : "Learn essential workplace safety procedures, hazard reporting, emergency response, and employee responsibilities.")
  );

  const [difficulty, setDifficulty] = useState("beginner");

  const [estimatedDuration, setEstimatedDuration] = useState(30);

  /* =========================================================
     UI STATE
  ========================================================= */

  const [generating, setGenerating] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [generatedCourse, setGeneratedCourse] = useState(null);

  const [expandedModules, setExpandedModules] = useState({});

  const [editingCourse, setEditingCourse] = useState(false);

  const [editingModule, setEditingModule] = useState(null);

  const [editingLesson, setEditingLesson] = useState(null);

  const [editingAssessment, setEditingAssessment] = useState(null);

  const [savingLocal, setSavingLocal] = useState(false);

  /* =========================================================
     ORGANIZATION
  ========================================================= */

  function getOrganizationId(org) {
    if (!org) {
      return null;
    }

    return (
      org.id ||
      org.organization_id ||
      org.organizationId ||
      org?.data?.id ||
      org?.data?.organization_id ||
      null
    );
  }

  /* =========================================================
     GENERATE COURSE
  ========================================================= */

  async function generateCourse() {
    try {
      setGenerating(true);
      setError("");
      setSuccess("");
      setGeneratedCourse(null);

      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error(
          "Your session is not available. Please sign in again."
        );
      }

      let currentOrganization = organization;

      if (!currentOrganization && !organizationLoading) {
        try {
          await refreshOrganization();
        } catch (organizationRefreshError) {
          console.error(
            "[AI Course Generator] Organization refresh failed:",
            organizationRefreshError
          );
        }
      }

      const organizationId =
        getOrganizationId(currentOrganization);

      console.log(
        "[AI Course Generator] Organization:",
        currentOrganization
      );

      console.log(
        "[AI Course Generator] Organization ID:",
        organizationId
      );

      if (!organizationId) {
        throw new Error(
          organizationError ||
            "Organization could not be loaded. Please refresh the page and try again."
        );
      }

      if (!sourceTitle.trim()) {
        throw new Error("Please enter a source title.");
      }

      if (!sourceContent.trim()) {
        throw new Error("Please provide source content.");
      }

      if (!courseTitle.trim()) {
        throw new Error("Please enter a course title.");
      }

      if (!description.trim()) {
        throw new Error("Please enter a course description.");
      }

      const duration = Number(estimatedDuration);

      if (!duration || duration <= 0) {
        throw new Error(
          "Estimated duration must be greater than 0."
        );
      }

      const payload = {
        organizationId,
        sourceTitle: sourceTitle.trim(),
        sourceContent: sourceContent.trim(),
        courseTitle: courseTitle.trim(),
        description: description.trim(),
        difficulty,
        estimatedDurationMinutes: duration,
      };

      console.log(
        "[AI Course Generator] Generating course..."
      );

      console.log(
        "[AI Course Generator] Payload:",
        payload
      );

      const response = await fetch(
        `${API_BASE_URL}/learning/courses/generate`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify(payload),
        }
      );

      const responseText = await response.text();

      let data = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(
            `Server returned an invalid response (${response.status}).`
          );
        }
      }

      if (!response.ok) {
        console.error(
          "[AI Course Generator] Backend error:",
          {
            status: response.status,
            data,
          }
        );

        throw new Error(
          data?.message ||
            data?.error ||
            `Course generation failed (${response.status}).`
        );
      }

      const course =
        data?.course ||
        data?.data ||
        data;

      console.log(
        "[AI Course Generator] Course generated:",
        course
      );

      setGeneratedCourse(course);

      const modules = course?.modules || [];

      const initialExpandedState = {};

      modules.forEach((module, index) => {
        initialExpandedState[
          module?.id || `module-${index}`
        ] = index === 0;
      });

      setExpandedModules(initialExpandedState);

      setSuccess(
        "Course generated successfully."
      );
    } catch (err) {
      console.error(
        "[AI Course Generator] Error:",
        err
      );

      setError(
        err?.message ||
          "Course generation failed."
      );
    } finally {
      setGenerating(false);
    }
  }

  /* =========================================================
     COURSE COUNTS
  ========================================================= */

  const courseStats = useMemo(() => {
    if (!generatedCourse) {
      return {
        modules: 0,
        lessons: 0,
        assessments: 0,
      };
    }

    const modules =
      Array.isArray(generatedCourse.modules)
        ? generatedCourse.modules
        : [];

    const lessons = modules.reduce(
      (total, module) =>
        total +
        (Array.isArray(module.lessons)
          ? module.lessons.length
          : 0),
      0
    );

    const assessments = modules.reduce(
      (total, module) =>
        total +
        (Array.isArray(module.assessments)
          ? module.assessments.length
          : 0),
      0
    );

    return {
      modules: modules.length,
      lessons,
      assessments,
    };
  }, [generatedCourse]);

  /* =========================================================
     MODULE TOGGLE
  ========================================================= */

  function toggleModule(moduleId) {
    setExpandedModules((current) => ({
      ...current,
      [moduleId]: !current[moduleId],
    }));
  }

  /* =========================================================
     COURSE EDITING
  ========================================================= */

  function updateCourseField(field, value) {
    setGeneratedCourse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value,
      };
    });
  }

  /* =========================================================
     MODULE EDITING
  ========================================================= */

  function updateModuleField(
    moduleId,
    field,
    value
  ) {
    setGeneratedCourse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        modules: (current.modules || []).map(
          (module) =>
            module.id === moduleId
              ? {
                  ...module,
                  [field]: value,
                }
              : module
        ),
      };
    });
  }

  function deleteModule(moduleId) {
    const confirmed = window.confirm(
      "Delete this module and all its lessons and assessments?"
    );

    if (!confirmed) {
      return;
    }

    setGeneratedCourse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        modules: (current.modules || [])
          .filter(
            (module) =>
              module.id !== moduleId
          )
          .map((module, index) => ({
            ...module,
            position: index,
          })),
      };
    });

    setSuccess("Module removed from the course.");
  }

  function addModule() {
    const newModuleId =
      `local-module-${Date.now()}`;

    const newModule = {
      id: newModuleId,
      title: "New Module",
      description:
        "Add a description for this module.",
      position:
        generatedCourse?.modules?.length || 0,
      learning_objectives: [],
      estimated_duration_minutes: 15,
      lessons: [],
      assessments: [],
    };

    setGeneratedCourse((current) => ({
      ...current,
      modules: [
        ...(current?.modules || []),
        newModule,
      ],
    }));

    setExpandedModules((current) => ({
      ...current,
      [newModuleId]: true,
    }));

    setEditingModule(newModuleId);
  }

  /* =========================================================
     LESSON EDITING
  ========================================================= */

  function updateLessonField(
    moduleId,
    lessonId,
    field,
    value
  ) {
    setGeneratedCourse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,

        modules: (current.modules || []).map(
          (module) => {
            if (module.id !== moduleId) {
              return module;
            }

            return {
              ...module,

              lessons: (
                module.lessons || []
              ).map((lesson) =>
                lesson.id === lessonId
                  ? {
                      ...lesson,
                      [field]: value,
                    }
                  : lesson
              ),
            };
          }
        ),
      };
    });
  }

  function deleteLesson(
    moduleId,
    lessonId
  ) {
    const confirmed = window.confirm(
      "Delete this lesson?"
    );

    if (!confirmed) {
      return;
    }

    setGeneratedCourse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,

        modules: (current.modules || []).map(
          (module) => {
            if (module.id !== moduleId) {
              return module;
            }

            return {
              ...module,

              lessons: (
                module.lessons || []
              )
                .filter(
                  (lesson) =>
                    lesson.id !== lessonId
                )
                .map((lesson, index) => ({
                  ...lesson,
                  position: index,
                })),
            };
          }
        ),
      };
    });

    setSuccess("Lesson removed.");
  }

  function addLesson(moduleId) {
    const newLessonId =
      `local-lesson-${Date.now()}`;

    const newLesson = {
      id: newLessonId,
      title: "New Lesson",
      description:
        "Add a description for this lesson.",
      lesson_type: "content",
      content:
        "Add the lesson content here.",
      position: 0,
      estimated_duration_minutes: 5,
      learning_objectives: [],
    };

    setGeneratedCourse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,

        modules: (current.modules || []).map(
          (module) => {
            if (module.id !== moduleId) {
              return module;
            }

            const lessons =
              module.lessons || [];

            return {
              ...module,

              lessons: [
                ...lessons,
                {
                  ...newLesson,
                  position: lessons.length,
                },
              ],
            };
          }
        ),
      };
    });

    setEditingLesson(newLessonId);
  }

  /* =========================================================
     ASSESSMENT EDITING
  ========================================================= */

  function updateAssessmentField(
    moduleId,
    assessmentId,
    field,
    value
  ) {
    setGeneratedCourse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,

        modules: (current.modules || []).map(
          (module) => {
            if (module.id !== moduleId) {
              return module;
            }

            return {
              ...module,

              assessments: (
                module.assessments || []
              ).map((assessment) =>
                assessment.id === assessmentId
                  ? {
                      ...assessment,
                      [field]: value,
                    }
                  : assessment
              ),
            };
          }
        ),
      };
    });
  }

  function deleteAssessment(
    moduleId,
    assessmentId
  ) {
    const confirmed = window.confirm(
      "Delete this assessment?"
    );

    if (!confirmed) {
      return;
    }

    setGeneratedCourse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,

        modules: (current.modules || []).map(
          (module) => {
            if (module.id !== moduleId) {
              return module;
            }

            return {
              ...module,

              assessments: (
                module.assessments || []
              ).filter(
                (assessment) =>
                  assessment.id !==
                  assessmentId
              ),
            };
          }
        ),
      };
    });

    setSuccess("Assessment removed.");
  }

  /* =========================================================
     LOCAL DRAFT SAVE
  ========================================================= */

  function saveLocalDraft() {
    if (!generatedCourse) {
      return;
    }

    try {
      setSavingLocal(true);

      localStorage.setItem(
        "ai-course-generator-draft",
        JSON.stringify(generatedCourse)
      );

      setSuccess(
        "Course draft saved in this browser."
      );
    } catch (err) {
      console.error(
        "Failed to save local draft:",
        err
      );

      setError(
        "Could not save the local course draft."
      );
    } finally {
      setSavingLocal(false);
    }
  }

  function loadLocalDraft() {
    try {
      const saved =
        localStorage.getItem(
          "ai-course-generator-draft"
        );

      if (!saved) {
        setError(
          "No saved course draft was found."
        );
        return;
      }

      const parsed = JSON.parse(saved);

      setGeneratedCourse(parsed);

      const modules =
        parsed?.modules || [];

      const state = {};

      modules.forEach((module, index) => {
        state[
          module?.id || `module-${index}`
        ] = index === 0;
      });

      setExpandedModules(state);

      setSuccess(
        "Saved course draft loaded."
      );
    } catch (err) {
      console.error(
        "Failed to load local draft:",
        err
      );

      setError(
        "Saved course draft is invalid."
      );
    }
  }

  /* =========================================================
     RESET
  ========================================================= */

  function clearGeneratedCourse() {
    const confirmed = window.confirm(
      "Clear the generated course from this page?"
    );

    if (!confirmed) {
      return;
    }

    setGeneratedCourse(null);
    setEditingCourse(false);
    setEditingModule(null);
    setEditingLesson(null);
    setEditingAssessment(null);
    setSuccess("");
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-w-0">
      <div className="mx-auto w-full max-w-7xl">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

          <div className="flex items-start gap-3">

            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Sparkles size={20} />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                AI Course Generator
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Turn existing documents and content
                into structured training courses.
              </p>
            </div>

          </div>

          {generatedCourse && (
            <div className="flex flex-wrap gap-2">

              <button
                type="button"
                onClick={loadLocalDraft}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Upload size={16} />
                Load draft
              </button>

              <button
                type="button"
                onClick={saveLocalDraft}
                disabled={savingLocal}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
              >
                <Save size={16} />

                {savingLocal
                  ? "Saving..."
                  : "Save draft"}
              </button>

            </div>
          )}

        </div>

        {requestedSkillText && (
          <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 px-4 py-4">
            <div className="flex items-start gap-3">
              <Sparkles size={19} className="mt-0.5 shrink-0 text-teal-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Training requested from Skill-Gap Recommender
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  This course is being created to address: <span className="font-medium text-teal-700">{requestedSkillText}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            ORGANIZATION STATUS
        ===================================================== */}

        {organizationLoading && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
            Loading organization...
          </div>
        )}

        {!organizationLoading &&
          !organization &&
          organizationError && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">

              <AlertCircle
                size={19}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="font-medium">
                  Organization could not be loaded
                </p>

                <p className="mt-1">
                  {organizationError}
                </p>
              </div>

            </div>
          )}

        {/* =====================================================
            GENERATOR
        ===================================================== */}

        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">

          {/* SOURCE */}

          <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

            <div className="flex items-center gap-3 border-b border-gray-200 p-5">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-600">
                <FileText size={19} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Source content
                </h2>

                <p className="mt-0.5 text-sm text-gray-500">
                  Add the material you want the AI
                  to turn into a course.
                </p>
              </div>

            </div>

            <div className="space-y-5 p-6">

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Source title
                </label>

                <input
                  type="text"
                  value={sourceTitle}
                  onChange={(e) =>
                    setSourceTitle(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Content
                </label>

                <textarea
                  value={sourceContent}
                  onChange={(e) =>
                    setSourceContent(
                      e.target.value
                    )
                  }
                  rows={16}
                  className="w-full resize-y rounded-lg border border-gray-300 px-3 py-3 text-sm leading-7 text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />

                <p className="mt-2 text-xs text-gray-400">
                  The AI will use this content as
                  the basis for the course.
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500">
                  <Upload size={18} />
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">
                    File upload
                  </p>

                  <p className="text-xs text-gray-500">
                    PDF and document upload can be
                    connected to the source pipeline.
                  </p>
                </div>

              </div>

            </div>
          </div>

          {/* COURSE SETTINGS */}

          <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

            <div className="flex items-center gap-3 border-b border-gray-200 p-5">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-600">
                <BookOpen size={19} />
              </div>

              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Course details
                </h2>

                <p className="mt-0.5 text-sm text-gray-500">
                  Configure the generated course.
                </p>
              </div>

            </div>

            <div className="space-y-5 p-6">

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Course title
                </label>

                <input
                  type="text"
                  value={courseTitle}
                  onChange={(e) =>
                    setCourseTitle(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(
                      e.target.value
                    )
                  }
                  rows={4}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Difficulty
                </label>

                <select
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none"
                >
                  <option value="beginner">
                    Beginner
                  </option>

                  <option value="intermediate">
                    Intermediate
                  </option>

                  <option value="advanced">
                    Advanced
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Estimated duration
                </label>

                <div className="relative">

                  <Clock3
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="number"
                    min="1"
                    value={estimatedDuration}
                    onChange={(e) =>
                      setEstimatedDuration(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-20 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />

                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    minutes
                  </span>

                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">

                <div className="flex gap-3">

                  <BarChart3
                    size={18}
                    className="mt-0.5 shrink-0 text-gray-500"
                  />

                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      What will be generated?
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Course structure, modules,
                      lessons and assessments based
                      on your source material.
                    </p>
                  </div>

                </div>

              </div>

              <button
                type="button"
                onClick={generateCourse}
                disabled={
                  generating ||
                  organizationLoading
                }
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles size={17} />

                {generating
                  ? "Generating course..."
                  : "Generate course"}
              </button>

            </div>
          </div>
        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">

            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0"
            />

            <div>
              <p className="font-medium">
                Course generation failed
              </p>

              <p className="mt-1">
                {error}
              </p>
            </div>

          </div>
        )}

        {/* =====================================================
            SUCCESS
        ===================================================== */}

        {success && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-700">

            <CheckCircle2
              size={19}
              className="mt-0.5 shrink-0"
            />

            <div>
              <p className="font-medium">
                {success}
              </p>
            </div>

          </div>
        )}

        {/* =====================================================
            GENERATED COURSE
        ===================================================== */}

        {generatedCourse && (
          <div className="mt-8">

            {/* COURSE HEADER */}

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

              <div className="border-b border-gray-200 p-6">

                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                  <div className="min-w-0">

                    <div className="mb-3 flex flex-wrap items-center gap-2">

                      <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                        AI Generated
                      </span>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600">
                        {generatedCourse.difficulty ||
                          "Beginner"}
                      </span>

                      <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold capitalize text-yellow-700">
                        {generatedCourse.status ||
                          "draft"}
                      </span>

                    </div>

                    {editingCourse ? (
                      <input
                        value={
                          generatedCourse.title ||
                          ""
                        }
                        onChange={(e) =>
                          updateCourseField(
                            "title",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-2xl font-semibold text-gray-900 outline-none focus:border-teal-500"
                      />
                    ) : (
                      <h2 className="text-2xl font-semibold text-gray-900">
                        {generatedCourse.title ||
                          "Untitled course"}
                      </h2>
                    )}

                    {editingCourse ? (
                      <textarea
                        value={
                          generatedCourse.description ||
                          ""
                        }
                        onChange={(e) =>
                          updateCourseField(
                            "description",
                            e.target.value
                          )
                        }
                        rows={3}
                        className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 text-gray-700 outline-none focus:border-teal-500"
                      />
                    ) : (
                      <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-500">
                        {generatedCourse.description}
                      </p>
                    )}

                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        setEditingCourse(
                          (current) =>
                            !current
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {editingCourse ? (
                        <>
                          <Check size={16} />
                          Done
                        </>
                      ) : (
                        <>
                          <Edit3 size={16} />
                          Edit course
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={clearGeneratedCourse}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                      Clear
                    </button>

                  </div>

                </div>

              </div>

              {/* COURSE STATS */}

              <div className="grid grid-cols-2 gap-3 p-6 md:grid-cols-4">

                <StatCard
                  icon={
                    <Layers3 size={18} />
                  }
                  label="Modules"
                  value={courseStats.modules}
                />

                <StatCard
                  icon={
                    <BookOpen size={18} />
                  }
                  label="Lessons"
                  value={courseStats.lessons}
                />

                <StatCard
                  icon={
                    <Clock3 size={18} />
                  }
                  label="Duration"
                  value={`${generatedCourse.estimated_duration_minutes || 0} min`}
                />

                <StatCard
                  icon={
                    <CheckCircle2 size={18} />
                  }
                  label="Assessments"
                  value={
                    courseStats.assessments
                  }
                />

              </div>

            </div>

            {/* =================================================
                LEARNING OBJECTIVES
            ================================================= */}

            <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

              <div className="mb-5 flex items-center justify-between gap-4">

                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Learning objectives
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    What employees should be able to
                    understand after completing this course.
                  </p>
                </div>

                {editingCourse && (
                  <button
                    type="button"
                    onClick={() =>
                      updateCourseField(
                        "learning_objectives",
                        [
                          ...(generatedCourse.learning_objectives ||
                            []),
                          "New learning objective",
                        ]
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                )}

              </div>

              <div className="grid gap-3 md:grid-cols-2">

                {(
                  generatedCourse.learning_objectives ||
                  []
                ).map(
                  (objective, index) =>
                    editingCourse ? (
                      <div
                        key={index}
                        className="flex gap-2"
                      >
                        <input
                          value={objective}
                          onChange={(e) => {
                            const objectives = [
                              ...(
                                generatedCourse.learning_objectives ||
                                []
                              ),
                            ];

                            objectives[index] =
                              e.target.value;

                            updateCourseField(
                              "learning_objectives",
                              objectives
                            );
                          }}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                        />

                        <button
                          type="button"
                          onClick={() => {
                            const objectives = [
                              ...(
                                generatedCourse.learning_objectives ||
                                []
                              ),
                            ];

                            objectives.splice(
                              index,
                              1
                            );

                            updateCourseField(
                              "learning_objectives",
                              objectives
                            );
                          }}
                          className="rounded-lg border border-red-200 px-3 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <div
                        key={index}
                        className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-gray-600">
                          {index + 1}
                        </span>

                        <p className="text-sm leading-6 text-gray-700">
                          {objective}
                        </p>
                      </div>
                    )
                )}

              </div>

            </section>

            {/* =================================================
                MODULES
            ================================================= */}

            <section className="mt-6">

              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <Layers3 size={20} />
                    Course modules
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Manage modules, lessons and assessments.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addModule}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  <Plus size={16} />
                  Add module
                </button>

              </div>

              <div className="space-y-4">

                {(
                  generatedCourse.modules ||
                  []
                ).map((module, moduleIndex) => {

                  const moduleId =
                    module.id ||
                    `module-${moduleIndex}`;

                  const isOpen =
                    !!expandedModules[
                      moduleId
                    ];

                  const isEditing =
                    editingModule === moduleId;

                  return (
                    <div
                      key={moduleId}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                    >

                      {/* MODULE HEADER */}

                      <div className="flex items-start gap-3 border-b border-gray-200 bg-gray-50 p-5">

                        <button
                          type="button"
                          onClick={() =>
                            toggleModule(
                              moduleId
                            )
                          }
                          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-gray-100"
                        >
                          {isOpen ? (
                            <ChevronDown
                              size={18}
                            />
                          ) : (
                            <ChevronRight
                              size={18}
                            />
                          )}
                        </button>

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-semibold text-gray-600">
                          {moduleIndex + 1}
                        </div>

                        <div className="min-w-0 flex-1">

                          {isEditing ? (
                            <>
                              <input
                                value={
                                  module.title ||
                                  ""
                                }
                                onChange={(e) =>
                                  updateModuleField(
                                    moduleId,
                                    "title",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base font-semibold outline-none focus:border-teal-500"
                              />

                              <textarea
                                value={
                                  module.description ||
                                  ""
                                }
                                onChange={(e) =>
                                  updateModuleField(
                                    moduleId,
                                    "description",
                                    e.target.value
                                  )
                                }
                                rows={2}
                                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                              />
                            </>
                          ) : (
                            <>
                              <h4 className="text-base font-semibold text-gray-900">
                                {module.title ||
                                  "Untitled module"}
                              </h4>

                              <p className="mt-1 text-sm leading-6 text-gray-500">
                                {module.description}
                              </p>
                            </>
                          )}

                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                            <span>
                              {(module.lessons ||
                                []).length}{" "}
                              lessons
                            </span>

                            <span>
                              {module.estimated_duration_minutes ||
                                0}{" "}
                              min
                            </span>

                            <span>
                              {(module.assessments ||
                                []).length}{" "}
                              assessment
                              {(module.assessments ||
                                []).length !== 1
                                ? "s"
                                : ""}
                            </span>
                          </div>

                        </div>

                        <div className="flex shrink-0 gap-1">

                          <button
                            type="button"
                            onClick={() =>
                              setEditingModule(
                                isEditing
                                  ? null
                                  : moduleId
                              )
                            }
                            className="rounded-lg p-2 text-gray-500 hover:bg-white hover:text-gray-800"
                            title="Edit module"
                          >
                            {isEditing ? (
                              <Check size={17} />
                            ) : (
                              <Edit3 size={17} />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteModule(
                                moduleId
                              )
                            }
                            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete module"
                          >
                            <Trash2 size={17} />
                          </button>

                        </div>

                      </div>

                      {/* MODULE CONTENT */}

                      {isOpen && (
                        <div className="p-5">

                          {/* MODULE OBJECTIVES */}

                          <div className="mb-6">

                            <div className="mb-3 flex items-center justify-between">

                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Module objectives
                              </p>

                              {isEditing && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current =
                                      module.learning_objectives ||
                                      [];

                                    updateModuleField(
                                      moduleId,
                                      "learning_objectives",
                                      [
                                        ...current,
                                        "New module objective",
                                      ]
                                    );
                                  }}
                                  className="text-xs font-medium text-teal-600 hover:text-teal-700"
                                >
                                  + Add objective
                                </button>
                              )}

                            </div>

                            <div className="space-y-2">

                              {(
                                module.learning_objectives ||
                                []
                              ).map(
                                (
                                  objective,
                                  objectiveIndex
                                ) =>
                                  isEditing ? (
                                    <div
                                      key={
                                        objectiveIndex
                                      }
                                      className="flex gap-2"
                                    >
                                      <input
                                        value={
                                          objective
                                        }
                                        onChange={(e) => {
                                          const objectives =
                                            [
                                              ...(module.learning_objectives ||
                                                []),
                                            ];

                                          objectives[
                                            objectiveIndex
                                          ] =
                                            e.target.value;

                                          updateModuleField(
                                            moduleId,
                                            "learning_objectives",
                                            objectives
                                          );
                                        }}
                                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                                      />

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const objectives =
                                            [
                                              ...(module.learning_objectives ||
                                                []),
                                            ];

                                          objectives.splice(
                                            objectiveIndex,
                                            1
                                          );

                                          updateModuleField(
                                            moduleId,
                                            "learning_objectives",
                                            objectives
                                          );
                                        }}
                                        className="rounded-lg border border-red-200 px-3 text-red-600"
                                      >
                                        <Trash2
                                          size={15}
                                        />
                                      </button>
                                    </div>
                                  ) : (
                                    <div
                                      key={
                                        objectiveIndex
                                      }
                                      className="flex gap-2 text-sm text-gray-600"
                                    >
                                      <CheckCircle2
                                        size={16}
                                        className="mt-0.5 shrink-0 text-gray-400"
                                      />

                                      <span>
                                        {
                                          objective
                                        }
                                      </span>
                                    </div>
                                  )
                              )}

                            </div>
                          </div>

                          {/* LESSONS */}

                          <div>

                            <div className="mb-3 flex items-center justify-between">

                              <h5 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                <BookOpen
                                  size={17}
                                />
                                Lessons
                              </h5>

                              <button
                                type="button"
                                onClick={() =>
                                  addLesson(
                                    moduleId
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                <Plus size={14} />
                                Add lesson
                              </button>

                            </div>

                            <div className="space-y-3">

                              {(
                                module.lessons ||
                                []
                              ).map(
                                (
                                  lesson,
                                  lessonIndex
                                ) => {

                                  const lessonId =
                                    lesson.id ||
                                    `lesson-${moduleIndex}-${lessonIndex}`;

                                  const isLessonEditing =
                                    editingLesson ===
                                    lessonId;

                                  return (
                                    <div
                                      key={lessonId}
                                      className="rounded-xl border border-gray-200 p-4"
                                    >

                                      <div className="flex items-start gap-3">

                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-600">
                                          {lessonIndex +
                                            1}
                                        </div>

                                        <div className="min-w-0 flex-1">

                                          {isLessonEditing ? (
                                            <>
                                              <input
                                                value={
                                                  lesson.title ||
                                                  ""
                                                }
                                                onChange={(e) =>
                                                  updateLessonField(
                                                    moduleId,
                                                    lessonId,
                                                    "title",
                                                    e.target.value
                                                  )
                                                }
                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500"
                                              />

                                              <textarea
                                                value={
                                                  lesson.description ||
                                                  ""
                                                }
                                                onChange={(e) =>
                                                  updateLessonField(
                                                    moduleId,
                                                    lessonId,
                                                    "description",
                                                    e.target.value
                                                  )
                                                }
                                                rows={2}
                                                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                                              />

                                              <textarea
                                                value={
                                                  lesson.content ||
                                                  ""
                                                }
                                                onChange={(e) =>
                                                  updateLessonField(
                                                    moduleId,
                                                    lessonId,
                                                    "content",
                                                    e.target.value
                                                  )
                                                }
                                                rows={6}
                                                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 outline-none focus:border-teal-500"
                                              />

                                              <div className="mt-2 flex items-center gap-2">

                                                <Clock3
                                                  size={15}
                                                  className="text-gray-400"
                                                />

                                                <input
                                                  type="number"
                                                  min="1"
                                                  value={
                                                    lesson.estimated_duration_minutes ||
                                                    5
                                                  }
                                                  onChange={(e) =>
                                                    updateLessonField(
                                                      moduleId,
                                                      lessonId,
                                                      "estimated_duration_minutes",
                                                      Number(
                                                        e.target
                                                          .value
                                                      )
                                                    )
                                                  }
                                                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                                                />

                                                <span className="text-xs text-gray-400">
                                                  minutes
                                                </span>

                                              </div>
                                            </>
                                          ) : (
                                            <>
                                              <div className="flex flex-wrap items-start justify-between gap-3">

                                                <div>
                                                  <h6 className="text-sm font-semibold text-gray-900">
                                                    {lesson.title ||
                                                      "Untitled lesson"}
                                                  </h6>

                                                  <p className="mt-1 text-sm leading-6 text-gray-500">
                                                    {
                                                      lesson.description
                                                    }
                                                  </p>
                                                </div>

                                                <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
                                                  <Clock3
                                                    size={
                                                      13
                                                    }
                                                  />

                                                  {lesson.estimated_duration_minutes ||
                                                    0}{" "}
                                                  min
                                                </span>

                                              </div>

                                              {lesson.content && (
                                                <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm leading-6 text-gray-600">
                                                  {
                                                    lesson.content
                                                  }
                                                </div>
                                              )}

                                              {(
                                                lesson.learning_objectives ||
                                                []
                                              ).length >
                                                0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">

                                                  {(
                                                    lesson.learning_objectives ||
                                                    []
                                                  ).map(
                                                    (
                                                      objective,
                                                      index
                                                    ) => (
                                                      <span
                                                        key={
                                                          index
                                                        }
                                                        className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600"
                                                      >
                                                        {
                                                          objective
                                                        }
                                                      </span>
                                                    )
                                                  )}

                                                </div>
                                              )}
                                            </>
                                          )}

                                        </div>

                                        <div className="flex shrink-0 gap-1">

                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingLesson(
                                                isLessonEditing
                                                  ? null
                                                  : lessonId
                                              )
                                            }
                                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                            title="Edit lesson"
                                          >
                                            {isLessonEditing ? (
                                              <Check
                                                size={
                                                  16
                                                }
                                              />
                                            ) : (
                                              <Edit3
                                                size={
                                                  16
                                                }
                                              />
                                            )}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              deleteLesson(
                                                moduleId,
                                                lessonId
                                              )
                                            }
                                            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                            title="Delete lesson"
                                          >
                                            <Trash2
                                              size={
                                                16
                                              }
                                            />
                                          </button>

                                        </div>

                                      </div>

                                    </div>
                                  );
                                }
                              )}

                            </div>

                          </div>

                          {/* ASSESSMENTS */}

                          <div className="mt-6">

                            <div className="mb-3 flex items-center justify-between">

                              <h5 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                <CheckCircle2
                                  size={17}
                                />
                                Assessments
                              </h5>

                            </div>

                            <div className="space-y-3">

                              {(
                                module.assessments ||
                                []
                              ).map(
                                (
                                  assessment,
                                  assessmentIndex
                                ) => {

                                  const assessmentId =
                                    assessment.id ||
                                    `assessment-${moduleIndex}-${assessmentIndex}`;

                                  const isEditingAssessment =
                                    editingAssessment ===
                                    assessmentId;

                                  return (
                                    <div
                                      key={
                                        assessmentId
                                      }
                                      className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                                    >

                                      <div className="flex items-start gap-3">

                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500">
                                          <CheckCircle2
                                            size={16}
                                          />
                                        </div>

                                        <div className="min-w-0 flex-1">

                                          {isEditingAssessment ? (
                                            <>

                                              <input
                                                value={
                                                  assessment.title ||
                                                  ""
                                                }
                                                onChange={(e) =>
                                                  updateAssessmentField(
                                                    moduleId,
                                                    assessmentId,
                                                    "title",
                                                    e.target.value
                                                  )
                                                }
                                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500"
                                              />

                                              <textarea
                                                value={
                                                  assessment.description ||
                                                  ""
                                                }
                                                onChange={(e) =>
                                                  updateAssessmentField(
                                                    moduleId,
                                                    assessmentId,
                                                    "description",
                                                    e.target.value
                                                  )
                                                }
                                                rows={2}
                                                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                                              />

                                              <div className="mt-2 flex items-center gap-2">

                                                <label className="text-xs text-gray-500">
                                                  Passing score
                                                </label>

                                                <input
                                                  type="number"
                                                  min="0"
                                                  max="100"
                                                  value={
                                                    assessment.passing_score ||
                                                    70
                                                  }
                                                  onChange={(e) =>
                                                    updateAssessmentField(
                                                      moduleId,
                                                      assessmentId,
                                                      "passing_score",
                                                      Number(
                                                        e.target
                                                          .value
                                                      )
                                                    )
                                                  }
                                                  className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                                                />

                                                <span className="text-xs text-gray-400">
                                                  %
                                                </span>

                                              </div>

                                            </>
                                          ) : (
                                            <>
                                              <div className="flex flex-wrap items-center justify-between gap-2">

                                                <h6 className="text-sm font-semibold text-gray-900">
                                                  {assessment.title ||
                                                    "Assessment"}
                                                </h6>

                                                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-500">
                                                  Passing:{" "}
                                                  {assessment.passing_score ||
                                                    70}
                                                  %
                                                </span>

                                              </div>

                                              <p className="mt-1 text-sm leading-6 text-gray-500">
                                                {
                                                  assessment.description
                                                }
                                              </p>

                                              <div className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white p-3">

                                                <p className="text-xs font-medium text-gray-500">
                                                  Quiz assessment
                                                </p>

                                                <p className="mt-1 text-xs text-gray-400">
                                                  Assessment questions are stored by
                                                  the learning backend.
                                                </p>

                                              </div>
                                            </>
                                          )}

                                        </div>

                                        <div className="flex shrink-0 gap-1">

                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingAssessment(
                                                isEditingAssessment
                                                  ? null
                                                  : assessmentId
                                              )
                                            }
                                            className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-gray-700"
                                            title="Edit assessment"
                                          >
                                            {isEditingAssessment ? (
                                              <Check
                                                size={
                                                  16
                                                }
                                              />
                                            ) : (
                                              <Edit3
                                                size={
                                                  16
                                                }
                                              />
                                            )}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              deleteAssessment(
                                                moduleId,
                                                assessmentId
                                              )
                                            }
                                            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                            title="Delete assessment"
                                          >
                                            <Trash2
                                              size={
                                                16
                                              }
                                            />
                                          </button>

                                        </div>

                                      </div>

                                    </div>
                                  );
                                }
                              )}

                            </div>

                          </div>

                        </div>
                      )}

                    </div>
                  );
                })}

              </div>

            </section>

            {/* =================================================
                BOTTOM ACTION BAR
            ================================================= */}

            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <div>

                  <p className="text-sm font-semibold text-gray-900">
                    Course ready for review
                  </p>

                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    You can expand modules, edit course
                    information, modify lessons, add
                    modules and remove unwanted content.
                  </p>

                </div>

                <div className="flex flex-wrap gap-2">

                  <button
                    type="button"
                    onClick={() => {
                      setExpandedModules(
                        Object.fromEntries(
                          (
                            generatedCourse.modules ||
                            []
                          ).map(
                            (module) => [
                              module.id,
                              true,
                            ]
                          )
                        )
                      );
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Expand all
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedModules({})
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Collapse all
                  </button>

                  <button
                    type="button"
                    onClick={saveLocalDraft}
                    className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                  >
                    <Save size={16} />
                    Save draft
                  </button>

                </div>

              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}

/* =============================================================
   STAT CARD
============================================================= */

function StatCard({
  icon,
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">

      <div className="flex items-center gap-3">

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-500">
          {icon}
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400">
            {label}
          </p>

          <p className="mt-0.5 text-lg font-semibold text-gray-900">
            {value}
          </p>
        </div>

      </div>

    </div>
  );
}