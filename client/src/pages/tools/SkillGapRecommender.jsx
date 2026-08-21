import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  BookOpen,
  Plus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  GraduationCap,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import axios from "axios";

import { supabase } from "../../lib/supabaseClient";

/* =========================================================
   API
========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api";

const api = axios.create({
  baseURL: API_URL,
});

/*
 * Attach the current Supabase access token.
 */
api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers = config.headers || {};

    config.headers.Authorization =
      `Bearer ${session.access_token}`;
  }

  return config;
});

/* =========================================================
   HELPERS
========================================================= */

function getEmployeeId(employee) {
  return (
    employee?.id ||
    employee?.employee_id ||
    null
  );
}

function getEmployeeName(employee) {
  return (
    employee?.full_name ||
    employee?.name ||
    `${employee?.first_name || ""} ${
      employee?.last_name || ""
    }`.trim() ||
    "Unnamed employee"
  );
}

function getEmployeeTitle(employee) {
  return (
    employee?.title ||
    employee?.designation ||
    employee?.job_title ||
    "Role not specified"
  );
}

function getEmployeeDepartment(employee) {
  return (
    employee?.department ||
    employee?.department_name ||
    "Department not specified"
  );
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s+#.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(
      (token) =>
        token.length >= 3
    );
}

/*
 * Small synonym map.

 * This does not replace the actual course data.
 * It simply improves matching when wording differs.
 */
const SKILL_SYNONYMS = {
  communication: [
    "communication",
    "communicating",
    "presentation",
    "presentations",
    "interpersonal",
  ],

  leadership: [
    "leadership",
    "leader",
    "management",
    "managing",
    "supervision",
  ],

  excel: [
    "excel",
    "spreadsheet",
    "spreadsheets",
    "vlookup",
    "pivot",
  ],

  analytics: [
    "analytics",
    "analysis",
    "analytical",
    "data",
    "reporting",
  ],

  sql: [
    "sql",
    "database",
    "query",
    "queries",
  ],

  python: [
    "python",
    "programming",
    "coding",
  ],

  safety: [
    "safety",
    "hazard",
    "emergency",
    "ppe",
  ],

  compliance: [
    "compliance",
    "policy",
    "policies",
    "regulation",
    "regulatory",
  ],

  teamwork: [
    "teamwork",
    "collaboration",
    "collaborative",
    "team",
  ],

  "time management": [
    "time",
    "prioritization",
    "priorities",
    "planning",
    "productivity",
  ],
};

/*
 * Expand a skill into related terms.
 */
function expandSkill(skill) {
  const normalized =
    normalizeText(skill);

  const terms = new Set(
    tokenize(normalized)
  );

  Object.entries(
    SKILL_SYNONYMS
  ).forEach(
    ([key, synonyms]) => {
      if (
        normalized.includes(key) ||
        synonyms.some(
          (synonym) =>
            normalized.includes(synonym)
        )
      ) {
        synonyms.forEach((term) =>
          terms.add(term)
        );
      }
    }
  );

  return Array.from(terms);
}

/*
 * Get all searchable course content.
 */
function getCourseSearchText(course) {
  const parts = [];

  function collect(value) {
    if (value == null) return;

    if (typeof value === "string" || typeof value === "number") {
      parts.push(String(value));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }

    if (typeof value === "object") {
      Object.entries(value).forEach(([key, val]) => {
        // IDs, timestamps and organization metadata do not help
        // identify whether a course teaches a skill.
        const ignoredKeys = new Set([
          "id",
          "organization_id",
          "course_id",
          "module_id",
          "assessment_id",
          "created_at",
          "updated_at",
          "published_at",
          "generated_by_user_id",
          "position",
          "passing_score",
        ]);

        if (!ignoredKeys.has(key)) {
          collect(val);
        }
      });
    }
  }

  collect(course);

  return normalizeText(parts.join(" "));
}

/*
 * Return a readable list of the course content that contributed
 * to a recommendation. This makes the recommender explainable
 * instead of simply returning a score.
 */
function getCourseContentMatches(skill, course) {
  const terms = expandSkill(skill);
  const matches = [];

  function inspect(label, value) {
    if (!value) return;

    const text = normalizeText(value);
    if (!text) return;

    const matchedTerms = terms.filter((term) => text.includes(term));
    if (matchedTerms.length) {
      matches.push({
        label,
        text: String(value),
        matchedTerms,
      });
    }
  }

  inspect("Course", course?.title);
  inspect("Course description", course?.description);

  if (Array.isArray(course?.learning_objectives)) {
    course.learning_objectives.forEach((item) =>
      inspect("Course objective", item)
    );
  }

  if (Array.isArray(course?.modules)) {
    course.modules.forEach((module) => {
      inspect("Module", module?.title);
      inspect("Module description", module?.description);

      if (Array.isArray(module?.learning_objectives)) {
        module.learning_objectives.forEach((item) =>
          inspect("Module objective", item)
        );
      }

      if (Array.isArray(module?.lessons)) {
        module.lessons.forEach((lesson) => {
          inspect("Lesson", lesson?.title);
          inspect("Lesson description", lesson?.description);
          inspect("Lesson content", lesson?.content);

          if (Array.isArray(lesson?.learning_objectives)) {
            lesson.learning_objectives.forEach((item) =>
              inspect("Lesson objective", item)
            );
          }
        });
      }

      if (Array.isArray(module?.assessments)) {
        module.assessments.forEach((assessment) => {
          inspect("Assessment", assessment?.title);
          inspect("Assessment description", assessment?.description);

          if (Array.isArray(assessment?.questions)) {
            assessment.questions.forEach((question) => {
              inspect("Assessment question", question?.question_text);
              inspect("Assessment question", question?.question);
              inspect("Assessment question", question?.text);
              inspect("Assessment explanation", question?.explanation);
            });
          }
        });
      }
    });
  }

  return matches;
}

/*
 * Match a single skill against a course.
 */
function matchSkillToCourse(skill, course) {
  const courseText = getCourseSearchText(course);

  if (!courseText) {
    return {
      matched: false,
      score: 0,
      terms: [],
      evidence: [],
    };
  }

  const normalizedSkill = normalizeText(skill);
  const terms = expandSkill(skill);
  const matchedTerms = terms.filter((term) =>
    courseText.includes(term)
  );

  const evidence = getCourseContentMatches(skill, course);

  if (!matchedTerms.length && !evidence.length) {
    return {
      matched: false,
      score: 0,
      terms: [],
      evidence: [],
    };
  }

  // Give a direct phrase match more weight than a related synonym.
  const directPhraseMatch =
    normalizedSkill.length >= 3 &&
    courseText.includes(normalizedSkill);

  const uniqueEvidenceTerms = new Set(
    evidence.flatMap((item) => item.matchedTerms)
  );

  const score = Math.min(
    100,
    (directPhraseMatch ? 55 : 35) +
      Math.min(30, uniqueEvidenceTerms.size * 10) +
      Math.min(15, evidence.length * 3)
  );

  return {
    matched: true,
    score,
    terms: Array.from(uniqueEvidenceTerms),
    evidence: evidence.slice(0, 6),
  };
}

/*
 * Build recommendation objects.
 */
function calculateRecommendations(
  courses,
  skillGaps
) {
  if (
    !Array.isArray(courses) ||
    !courses.length ||
    !skillGaps.length
  ) {
    return [];
  }

  const recommendations =
    courses.map((course) => {
      const skillMatches =
        skillGaps.map((skill) => {
          const result =
            matchSkillToCourse(
              skill,
              course
            );

          return {
            skill,
            ...result,
          };
        });

      const matchedSkills =
        skillMatches.filter(
          (item) => item.matched
        );

      if (!matchedSkills.length) {
        return null;
      }

      const totalScore =
        skillMatches.reduce(
          (total, item) =>
            total + item.score,
          0
        );

      const averageScore =
        totalScore /
        skillGaps.length;

      const coverage =
        matchedSkills.length /
        skillGaps.length;

      /*
       * Coverage is important:
       *
       * A course matching 3/3 gaps should
       * rank above one matching 1/1 with
       * weak wording.
       */
      const finalScore = Math.round(
        averageScore * 0.65 +
          coverage * 100 * 0.35
      );

      return {
        ...course,

        recommendationScore:
          Math.min(100, finalScore),

        matchedSkills,

        evidence: matchedSkills.flatMap((item) =>
          (item.evidence || []).map((evidenceItem) => ({
            skill: item.skill,
            ...evidenceItem,
          }))
        ),

        unmatchedSkills:
          skillMatches
            .filter(
              (item) =>
                !item.matched
            )
            .map(
              (item) =>
                item.skill
            ),
      };
    });

  return recommendations
    .filter(Boolean)
    .sort(
      (a, b) =>
        b.recommendationScore -
        a.recommendationScore
    );
}

/* =========================================================
   UI HELPERS
========================================================= */

function scoreClass(score) {
  if (score >= 80) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (score >= 60) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (score >= 40) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-gray-50 text-gray-600 border-gray-200";
}

function formatDifficulty(value) {
  if (!value) {
    return "Not specified";
  }

  return (
    String(value)
      .charAt(0)
      .toUpperCase() +
    String(value).slice(1)
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function SkillGapRecommender() {
  const navigate =
    useNavigate();

  /* -------------------------------------------------------
     DATA
  ------------------------------------------------------- */

  const [employees, setEmployees] =
    useState([]);

  const [courses, setCourses] =
    useState([]);

  /* -------------------------------------------------------
     SELECTION
  ------------------------------------------------------- */

  const [selectedEmployeeId, setSelectedEmployeeId] =
    useState("");

  const [skillInput, setSkillInput] =
    useState("");

  const [skillGaps, setSkillGaps] =
    useState([]);

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */

  const [employeeSearch, setEmployeeSearch] =
    useState("");

  const [courseSearch, setCourseSearch] =
    useState("");

  const [expandedCourseId, setExpandedCourseId] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =========================================================
     LOAD DATA
  ========================================================= */

  async function loadData(
    showRefresh = false
  ) {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      /*
       * Employees are loaded through the
       * existing protected API.
       */
      const employeesResponse =
        await api.get(
          "/employees"
        );

      /*
       * The employee API normally returns the array directly.
       * Some existing endpoints in the platform wrap it in
       * { employees: [...] } or { data: [...] }, so normalize
       * all supported response shapes here.
       */
      function extractEmployeeArray(payload) {
        if (Array.isArray(payload)) {
          return payload;
        }

        if (Array.isArray(payload?.employees)) {
          return payload.employees;
        }

        if (Array.isArray(payload?.data)) {
          return payload.data;
        }

        if (Array.isArray(payload?.data?.employees)) {
          return payload.data.employees;
        }

        if (Array.isArray(payload?.data?.data)) {
          return payload.data.data;
        }

        if (Array.isArray(payload?.result)) {
          return payload.result;
        }

        return [];
      }

      let employeeData =
        extractEmployeeArray(
          employeesResponse?.data
        );

      /*
       * If the protected employee endpoint responds successfully
       * but gives an empty array, use the already authenticated
       * Supabase client as a fallback. The current platform already
       * uses this client for learning data, so this does not create
       * another authentication flow. RLS remains responsible for
       * limiting the rows visible to the signed-in user.
       */
      if (employeeData.length === 0) {
        const {
          data: supabaseEmployees,
          error: supabaseEmployeeError,
        } = await supabase
          .from("employees")
          .select("*")
          .order("created_at", {
            ascending: false,
          });

        if (!supabaseEmployeeError && Array.isArray(supabaseEmployees)) {
          employeeData = supabaseEmployees;
        } else if (supabaseEmployeeError) {
          console.warn(
            "[SkillGapRecommender] Supabase employee fallback failed:",
            supabaseEmployeeError
          );
        }
      }

      /*
       * Courses are loaded from the
       * existing learning endpoint.
       *
       * IMPORTANT:
       *
       * We do NOT query "courses".
       *
       * The HR AI Platform uses:
       *
       * learning_courses
       */
      let courseData = [];

      try {
        const coursesResponse =
          await api.get(
            "/learning/courses"
          );

        courseData =
          Array.isArray(coursesResponse?.data)
            ? coursesResponse.data
            : coursesResponse?.data?.courses || [];
      } catch (courseApiError) {
        console.warn(
          "[SkillGapRecommender] API course loading failed. Falling back to Supabase.",
          courseApiError
        );
      }

      /*
       * The learning API may return fully nested course data, but a
       * direct learning_courses query only contains the course row.
       * The recommender must inspect the real teaching material, so
       * enrich every course with its modules, lessons, assessments
       * and assessment questions.
       */
      if (!courseData.length) {
        const [
          coursesResult,
          modulesResult,
          lessonsResult,
          assessmentsResult,
          questionsResult,
        ] = await Promise.all([
          supabase
            .from("learning_courses")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("learning_course_modules")
            .select("*")
            .order("position", { ascending: true }),
          supabase
            .from("learning_course_lessons")
            .select("*")
            .order("position", { ascending: true }),
          supabase
            .from("learning_course_assessments")
            .select("*")
            .order("position", { ascending: true }),
          supabase
            .from("learning_assessment_questions")
            .select("*"),
        ]);

        const firstError =
          coursesResult.error ||
          modulesResult.error ||
          lessonsResult.error ||
          assessmentsResult.error ||
          questionsResult.error;

        if (firstError) {
          throw firstError;
        }

        const rawCourses = coursesResult.data || [];
        const modules = modulesResult.data || [];
        const lessons = lessonsResult.data || [];
        const assessments = assessmentsResult.data || [];
        const questions = questionsResult.data || [];

        courseData = rawCourses.map((course) => {
          const courseModules = modules
            .filter((module) => module.course_id === course.id)
            .map((module) => ({
              ...module,
              lessons: lessons.filter(
                (lesson) => lesson.module_id === module.id
              ),
              assessments: assessments
                .filter(
                  (assessment) =>
                    assessment.module_id === module.id
                )
                .map((assessment) => ({
                  ...assessment,
                  questions: questions.filter(
                    (question) =>
                      question.assessment_id === assessment.id
                  ),
                })),
            }));

          return {
            ...course,
            modules: courseModules,
          };
        });
      } else {
        /*
         * API response can contain nested modules already. If it does
         * not, enrich it from Supabase rather than silently matching
         * against title/description only.
         */
        const needsEnrichment = courseData.some(
          (course) => !Array.isArray(course?.modules)
        );

        if (needsEnrichment) {
          const [modulesResult, lessonsResult, assessmentsResult, questionsResult] =
            await Promise.all([
              supabase.from("learning_course_modules").select("*"),
              supabase.from("learning_course_lessons").select("*"),
              supabase.from("learning_course_assessments").select("*"),
              supabase.from("learning_assessment_questions").select("*"),
            ]);

          if (!modulesResult.error && !lessonsResult.error && !assessmentsResult.error && !questionsResult.error) {
            const modules = modulesResult.data || [];
            const lessons = lessonsResult.data || [];
            const assessments = assessmentsResult.data || [];
            const questions = questionsResult.data || [];

            courseData = courseData.map((course) => ({
              ...course,
              modules: modules
                .filter((module) => module.course_id === course.id)
                .map((module) => ({
                  ...module,
                  lessons: lessons.filter(
                    (lesson) => lesson.module_id === module.id
                  ),
                  assessments: assessments
                    .filter(
                      (assessment) => assessment.module_id === module.id
                    )
                    .map((assessment) => ({
                      ...assessment,
                      questions: questions.filter(
                        (question) => question.assessment_id === assessment.id
                      ),
                    })),
                })),
            }));
          }
        }
      }

      setEmployees(
        Array.isArray(employeeData)
          ? employeeData
          : []
      );

      setCourses(
        Array.isArray(courseData)
          ? courseData
          : []
      );
    } catch (err) {
      console.error(
        "[SkillGapRecommender] Failed to load data:",
        err
      );

      const message =
        err?.response?.data
          ?.message ||
        err?.message ||
        "Could not load employee and learning data.";

      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /* =========================================================
     SELECTED EMPLOYEE
  ========================================================= */

  const selectedEmployee =
    useMemo(
      () =>
        employees.find(
          (employee) =>
            String(
              getEmployeeId(
                employee
              )
            ) ===
            String(
              selectedEmployeeId
            )
        ) || null,
      [
        employees,
        selectedEmployeeId,
      ]
    );

  /* =========================================================
     FILTER EMPLOYEES
  ========================================================= */

  const filteredEmployees =
    useMemo(() => {
      const query =
        normalizeText(
          employeeSearch
        );

      if (!query) {
        return employees;
      }

      return employees.filter(
        (employee) => {
          const searchable =
            normalizeText(
              [
                getEmployeeName(
                  employee
                ),
                getEmployeeTitle(
                  employee
                ),
                getEmployeeDepartment(
                  employee
                ),
                employee?.email,
                employee?.employee_code,
              ]
                .filter(Boolean)
                .join(" ")
            );

          return searchable.includes(
            query
          );
        }
      );
    }, [
      employees,
      employeeSearch,
    ]);

  /* =========================================================
     SKILL INPUT
  ========================================================= */

  function addSkillGap() {
    const cleaned =
      skillInput.trim();

    if (!cleaned) {
      return;
    }

    /*
     * Avoid duplicates.
     */
    const exists =
      skillGaps.some(
        (skill) =>
          normalizeText(skill) ===
          normalizeText(cleaned)
      );

    if (exists) {
      setSkillInput("");
      return;
    }

    setSkillGaps(
      (current) => [
        ...current,
        cleaned,
      ]
    );

    setSkillInput("");
  }

  function removeSkillGap(
    skillToRemove
  ) {
    setSkillGaps(
      (current) =>
        current.filter(
          (skill) =>
            skill !==
            skillToRemove
        )
    );
  }

  function handleSkillKeyDown(
    event
  ) {
    if (
      event.key === "Enter" ||
      event.key === ","
    ) {
      event.preventDefault();
      addSkillGap();
    }
  }

  /* =========================================================
     RECOMMENDATIONS
  ========================================================= */

  const recommendations =
    useMemo(
      () =>
        calculateRecommendations(
          courses,
          skillGaps
        ),
      [
        courses,
        skillGaps,
      ]
    );

  const filteredRecommendations =
    useMemo(() => {
      const query =
        normalizeText(
          courseSearch
        );

      if (!query) {
        return recommendations;
      }

      return recommendations.filter(
        (course) => {
          const searchable =
            getCourseSearchText(
              course
            );

          return searchable.includes(
            query
          );
        }
      );
    }, [
      recommendations,
      courseSearch,
    ]);

  /* =========================================================
     SUMMARY
  ========================================================= */

  const summary =
    useMemo(() => {
      const total =
        recommendations.length;

      const strong =
        recommendations.filter(
          (course) =>
            course.recommendationScore >=
            80
        ).length;

      const coveredSkills =
        new Set();

      recommendations.forEach(
        (course) => {
          course.matchedSkills.forEach(
            (match) =>
              coveredSkills.add(
                normalizeText(
                  match.skill
                )
              )
          );
        }
      );

      return {
        total,
        strong,
        covered:
          coveredSkills.size,
      };
    }, [recommendations]);

  /* =========================================================
     UNCOVERED SKILL GAPS

     These are the employee's identified gaps for which no
     available organization course currently provides a match.
     They are actionable: each gap can be sent directly to the
     AI Course Generator to create the missing training.
  ========================================================= */

  const uncoveredSkillGaps = useMemo(() => {
    if (!skillGaps.length) {
      return [];
    }

    const covered = new Set();

    recommendations.forEach((course) => {
      (course.matchedSkills || []).forEach((match) => {
        covered.add(normalizeText(match.skill));
      });
    });

    return skillGaps.filter(
      (skill) => !covered.has(normalizeText(skill))
    );
  }, [skillGaps, recommendations]);

  function createCourseForSkill(skill) {
    navigate(
      "/app/tools/ai-course-generator",
      {
        state: {
          skillGap: skill,
          skillGaps: [skill],
          sourceTitle: `${skill} Skill Development`,
          courseTitle: `${skill} Development Training`,
          courseDescription: `Training designed to close the identified ${skill} skill gap for an employee.`,
        },
      }
    );
  }

  function createCourseForAllUncoveredGaps() {
    if (!uncoveredSkillGaps.length) {
      return;
    }

    navigate(
      "/app/tools/ai-course-generator",
      {
        state: {
          skillGaps: uncoveredSkillGaps,
          skillGap: uncoveredSkillGaps.join(", "),
          sourceTitle: "Employee Skill Gap Development Plan",
          courseTitle: "Skill Gap Development Training",
          courseDescription: `Training designed to close these identified skill gaps: ${uncoveredSkillGaps.join(", ")}.`,
        },
      }
    );
  }

  /* =========================================================
     RESET
  ========================================================= */

  function resetRecommendations() {
    setSelectedEmployeeId("");
    setSkillInput("");
    setSkillGaps([]);
    setCourseSearch("");
    setEmployeeSearch("");
    setExpandedCourseId(null);
    setError("");
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-w-0">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="mb-8">
          <button
            type="button"
            onClick={() =>
              navigate(-1)
            }
            className="mb-5 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <GraduationCap
                  size={21}
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                    Skill-Gap Based Learning Recommender
                  </h1>

                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                    L&D
                  </span>
                </div>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                  Match employees' real skill gaps
                  with relevant training available
                  in your organization.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                loadData(true)
              }
              disabled={
                refreshing ||
                loading
              }
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>
          </div>
        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* =====================================================
            LOADING
        ===================================================== */}

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <RefreshCw
              size={24}
              className="mx-auto animate-spin text-teal-600"
            />

            <p className="mt-3 text-sm text-gray-500">
              Loading employees and learning courses...
            </p>
          </div>
        ) : (
          <>
            {/* =================================================
                CONFIGURATION
            ================================================= */}

            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">

              {/* -------------------------------------------------
                  EMPLOYEE
              ------------------------------------------------- */}

              <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
                    <UserRound
                      size={18}
                    />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      Select employee
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Choose the employee whose
                      learning needs you want to
                      analyze.
                    </p>
                  </div>
                </div>

                <div className="relative mb-3">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="text"
                    value={
                      employeeSearch
                    }
                    onChange={(event) =>
                      setEmployeeSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search employees..."
                    className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <select
                  value={
                    selectedEmployeeId
                  }
                  onChange={(event) =>
                    setSelectedEmployeeId(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="">
                    Select an employee
                  </option>

                  {filteredEmployees.map(
                    (employee) => {
                      const id =
                        getEmployeeId(
                          employee
                        );

                      return (
                        <option
                          key={id}
                          value={id}
                        >
                          {getEmployeeName(
                            employee
                          )}{" "}
                          —{" "}
                          {getEmployeeTitle(
                            employee
                          )}
                        </option>
                      );
                    }
                  )}
                </select>

                {selectedEmployee && (
                  <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-teal-700 shadow-sm">
                        {getEmployeeName(
                          selectedEmployee
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">
                          {getEmployeeName(
                            selectedEmployee
                          )}
                        </p>

                        <p className="mt-0.5 text-sm text-gray-500">
                          {getEmployeeTitle(
                            selectedEmployee
                          )}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          {getEmployeeDepartment(
                            selectedEmployee
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!employees.length && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                    No employees are available
                    for this organization.
                  </div>
                )}
              </section>

              {/* -------------------------------------------------
                  SKILL GAPS
              ------------------------------------------------- */}

              <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
                    <Target
                      size={18}
                    />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      Identify skill gaps
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Add the skills this employee
                      needs to improve for their role.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(event) =>
                      setSkillInput(
                        event.target.value
                      )
                    }
                    onKeyDown={
                      handleSkillKeyDown
                    }
                    placeholder="e.g. Excel, leadership, communication"
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />

                  <button
                    type="button"
                    onClick={
                      addSkillGap
                    }
                    disabled={
                      !skillInput.trim()
                    }
                    className="rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>

                <p className="mt-2 text-xs text-gray-400">
                  Press Enter or comma to add a
                  skill.
                </p>

                <div className="mt-5">
                  {skillGaps.length ? (
                    <div className="flex flex-wrap gap-2">
                      {skillGaps.map(
                        (skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700"
                          >
                            {skill}

                            <button
                              type="button"
                              onClick={() =>
                                removeSkillGap(
                                  skill
                                )
                              }
                              className="rounded-full p-0.5 hover:bg-teal-100"
                              aria-label={`Remove ${skill}`}
                            >
                              <X
                                size={14}
                              />
                            </button>
                          </span>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center">
                      <Target
                        size={20}
                        className="mx-auto text-gray-300"
                      />

                      <p className="mt-2 text-sm font-medium text-gray-600">
                        No skill gaps added
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Add at least one skill to
                        generate recommendations.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSkillGaps(
                        (current) => [
                          ...current,
                          ...[
                            "Communication",
                            "Leadership",
                            "Excel",
                          ].filter(
                            (skill) =>
                              !current.some(
                                (existing) =>
                                  normalizeText(
                                    existing
                                  ) ===
                                  normalizeText(
                                    skill
                                  )
                              )
                          ),
                        ]
                      )
                    }
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Add common gaps
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSkillGaps([])
                    }
                    disabled={
                      !skillGaps.length
                    }
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear gaps
                  </button>
                </div>
              </section>
            </div>

            {/* =================================================
                SUMMARY
            ================================================= */}

            <div className="mt-6 grid gap-4 sm:grid-cols-3">

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                  <BookOpen size={15} />
                  Matching courses
                </div>

                <p className="mt-2 text-2xl font-semibold text-gray-900">
                  {summary.total}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Courses matching at least one
                  identified gap
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                  <Sparkles size={15} />
                  Strong matches
                </div>

                <p className="mt-2 text-2xl font-semibold text-gray-900">
                  {summary.strong}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Recommendations scoring 80% or
                  higher
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                  <CheckCircle2
                    size={15}
                  />
                  Gaps covered
                </div>

                <p className="mt-2 text-2xl font-semibold text-gray-900">
                  {summary.covered}
                  <span className="ml-1 text-sm font-normal text-gray-400">
                    / {skillGaps.length}
                  </span>
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Skills found across available
                  training
                </p>
              </div>
            </div>

            {/* =================================================
                TRAINING NEEDED
            ================================================= */}

            {uncoveredSkillGaps.length > 0 && (
              <section className="mb-6 rounded-2xl border border-amber-200 bg-white shadow-sm">
                <div className="border-b border-amber-100 bg-amber-50/60 p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Target size={19} className="text-amber-600" />
                        <h2 className="text-base font-semibold text-gray-900">
                          Training needed
                        </h2>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        These identified skill gaps are not covered by the organization's current learning catalog.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={createCourseForAllUncoveredGaps}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                    >
                      <Plus size={15} />
                      Create training
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 p-5 md:grid-cols-2">
                  {uncoveredSkillGaps.map((skill) => (
                    <div
                      key={skill}
                      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Missing skill
                        </p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {skill}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">
                          No existing organizational course matches this gap.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => createCourseForSkill(skill)}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
                      >
                        <Plus size={15} />
                        Create course
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* =================================================
                RECOMMENDATIONS
            ================================================= */}

            <section className="mt-8 min-w-0 rounded-2xl border border-gray-200 bg-white shadow-sm">

              <div className="border-b border-gray-100 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <GraduationCap
                        size={19}
                        className="text-teal-600"
                      />

                      <h2 className="text-base font-semibold text-gray-900">
                        Recommended learning
                      </h2>
                    </div>

                    <p className="mt-1 text-sm text-gray-500">
                      Ranked using course, module, lesson and assessment content against the employee's identified skill gaps.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        value={
                          courseSearch
                        }
                        onChange={(event) =>
                          setCourseSearch(
                            event.target.value
                          )
                        }
                        placeholder="Filter courses..."
                        className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 sm:w-56"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={
                        resetRecommendations
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------
                  EMPTY STATE
              ------------------------------------------------- */}

              {!selectedEmployeeId ||
              !skillGaps.length ? (
                <div className="p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
                    <Sparkles
                      size={21}
                    />
                  </div>

                  <h3 className="mt-4 text-sm font-semibold text-gray-800">
                    Ready to recommend training
                  </h3>

                  <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-gray-500">
                    Select an employee and add
                    one or more skill gaps. Matching
                    courses will appear here
                    automatically.
                  </p>
                </div>
              ) : !filteredRecommendations.length ? (
                <div className="p-6 sm:p-8">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-amber-600">
                          <Target size={19} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">
                            No existing training matches these gaps
                          </h3>
                          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
                            The organization does not currently have a course that covers the selected skill gaps. Create the required training directly from here.
                          </p>
                        </div>
                      </div>

                      {uncoveredSkillGaps.length > 1 && (
                        <button
                          type="button"
                          onClick={createCourseForAllUncoveredGaps}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                        >
                          <Plus size={15} />
                          Create training for all gaps
                        </button>
                      )}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {uncoveredSkillGaps.map((skill) => (
                        <div
                          key={skill}
                          className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                              Training required
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {skill}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              No existing course currently covers this gap.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => createCourseForSkill(skill)}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
                          >
                            <Plus size={15} />
                            Create course
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">

                  {filteredRecommendations.map(
                    (
                      course,
                      index
                    ) => {
                      const courseId =
                        course?.id ||
                        `course-${index}`;

                      const expanded =
                        expandedCourseId ===
                        courseId;

                      return (
                        <div
                          key={courseId}
                          className="p-6"
                        >
                          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                            <div className="min-w-0 flex-1">

                              <div className="flex items-start gap-3">

                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-sm font-semibold text-teal-700">
                                  {index +
                                    1}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-semibold text-gray-900">
                                      {course?.title ||
                                        "Untitled course"}
                                    </h3>

                                    <span
                                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${scoreClass(
                                        course.recommendationScore
                                      )}`}
                                    >
                                      {
                                        course.recommendationScore
                                      }
                                      % match
                                    </span>
                                  </div>

                                  {course?.description && (
                                    <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
                                      {
                                        course.description
                                      }
                                    </p>
                                  )}

                                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                                    {course?.difficulty && (
                                      <span className="inline-flex items-center gap-1">
                                        <GraduationCap
                                          size={13}
                                        />
                                        {formatDifficulty(
                                          course.difficulty
                                        )}
                                      </span>
                                    )}

                                    {course?.estimated_duration_minutes !=
                                      null && (
                                      <span className="inline-flex items-center gap-1">
                                        <Clock3
                                          size={13}
                                        />
                                        {
                                          course.estimated_duration_minutes
                                        }{" "}
                                        min
                                      </span>
                                    )}

                                    <span className="inline-flex items-center gap-1">
                                      <Users
                                        size={13}
                                      />
                                      Organization
                                      course
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* MATCHED SKILLS */}

                              <div className="mt-4">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                  Skills this course
                                  addresses
                                </p>

                                <div className="flex flex-wrap gap-2">
                                  {course.matchedSkills.map(
                                    (
                                      match
                                    ) => (
                                      <span
                                        key={
                                          match.skill
                                        }
                                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                                      >
                                        <CheckCircle2
                                          size={13}
                                        />

                                        {
                                          match.skill
                                        }
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2 lg:flex-col lg:items-stretch">

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedCourseId(
                                    expanded
                                      ? null
                                      : courseId
                                  )
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                {expanded ? (
                                  <>
                                    Hide details
                                    <ChevronUp
                                      size={15}
                                    />
                                  </>
                                ) : (
                                  <>
                                    Why this match
                                    <ChevronDown
                                      size={15}
                                    />
                                  </>
                                )}
                              </button>

                              {course?.id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/app/tools/ai-course-generator?courseId=${course.id}`
                                    )
                                  }
                                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                                >
                                  <BookOpen
                                    size={15}
                                  />
                                  View course
                                </button>
                              )}
                            </div>
                          </div>

                          {/* DETAILS */}

                          {expanded && (
                            <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-5">

                              <div className="grid gap-5 lg:grid-cols-2">

                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                    Why it was
                                    recommended
                                  </p>

                                  <div className="mt-3 space-y-3">
                                    {course.matchedSkills.map(
                                      (
                                        match
                                      ) => (
                                        <div
                                          key={
                                            match.skill
                                          }
                                          className="rounded-lg border border-emerald-100 bg-white p-3"
                                        >
                                          <p className="text-sm font-medium text-gray-800">
                                            {
                                              match.skill
                                            }
                                          </p>

                                          <p className="mt-1 text-xs leading-5 text-gray-500">
                                            Course
                                            content
                                            matches
                                            this
                                            skill
                                            through:
                                          </p>

                                          <div className="mt-2 flex flex-wrap gap-1.5">
                                            {match.terms
                                              .slice(
                                                0,
                                                8
                                              )
                                              .map(
                                                (
                                                  term
                                                ) => (
                                                  <span
                                                    key={
                                                      term
                                                    }
                                                    className="rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-600"
                                                  >
                                                    {
                                                      term
                                                    }
                                                  </span>
                                                )
                                              )}
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                    Remaining gaps
                                  </p>

                                  {course.unmatchedSkills
                                    ?.length ? (
                                    <div className="mt-3 space-y-2">
                                      {course.unmatchedSkills.map(
                                        (
                                          skill
                                        ) => (
                                          <div
                                            key={
                                              skill
                                            }
                                            className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-700"
                                          >
                                            {
                                              skill
                                            }
                                          </div>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                                      <div className="flex items-start gap-2">
                                        <CheckCircle2
                                          size={17}
                                          className="mt-0.5 text-emerald-600"
                                        />

                                        <div>
                                          <p className="text-sm font-medium text-emerald-800">
                                            Full gap
                                            coverage
                                          </p>

                                          <p className="mt-1 text-xs leading-5 text-emerald-700">
                                            This course
                                            matches all
                                            identified
                                            skill gaps.
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {Array.isArray(
                                    course.learning_objectives
                                  ) &&
                                    course
                                      .learning_objectives
                                      .length >
                                      0 && (
                                      <div className="mt-5">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                          Course
                                          objectives
                                        </p>

                                        <ul className="mt-3 space-y-2">
                                          {course.learning_objectives
                                            .slice(
                                              0,
                                              5
                                            )
                                            .map(
                                              (
                                                objective
                                              ) => (
                                                <li
                                                  key={
                                                    objective
                                                  }
                                                  className="flex items-start gap-2 text-sm text-gray-600"
                                                >
                                                  <CheckCircle2
                                                    size={
                                                      15
                                                    }
                                                    className="mt-0.5 shrink-0 text-teal-500"
                                                  />

                                                  <span>
                                                    {
                                                      objective
                                                    }
                                                  </span>
                                                </li>
                                              )
                                            )}
                                        </ul>
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}