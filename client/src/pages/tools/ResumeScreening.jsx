import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  BriefcaseBusiness,
  FileText,
  Upload,
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Target,
  GraduationCap,
  Clock3,
  BarChart3,
} from "lucide-react";

import api from "../../lib/api";

export default function ResumeScreening() {
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const STORAGE_KEY = "hr-ai-resume-screening-state-v1";

  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [preferredSkills, setPreferredSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [education, setEducation] = useState("");

  const [resumes, setResumes] = useState([]);

  const [screening, setScreening] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  /* =========================================================
     RESTORE / PERSIST SCREENING STATE
  ========================================================= */

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);

      if (!saved) return;

      const parsed = JSON.parse(saved);

      if (typeof parsed.jobTitle === "string") setJobTitle(parsed.jobTitle);
      if (typeof parsed.jobDescription === "string") setJobDescription(parsed.jobDescription);
      if (typeof parsed.requiredSkills === "string") setRequiredSkills(parsed.requiredSkills);
      if (typeof parsed.preferredSkills === "string") setPreferredSkills(parsed.preferredSkills);
      if (typeof parsed.experience === "string") setExperience(parsed.experience);
      if (typeof parsed.education === "string") setEducation(parsed.education);
      if (Array.isArray(parsed.results)) setResults(parsed.results);
    } catch (restoreError) {
      console.error("Failed to restore resume screening state:", restoreError);
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          jobTitle,
          jobDescription,
          requiredSkills,
          preferredSkills,
          experience,
          education,
          results,
        })
      );
    } catch (persistError) {
      console.error("Failed to persist resume screening state:", persistError);
    }
  }, [
    jobTitle,
    jobDescription,
    requiredSkills,
    preferredSkills,
    experience,
    education,
    results,
  ]);

  /* =========================================================
     FILE UPLOAD
  ========================================================= */

  function handleFiles(event) {
    const files = Array.from(event.target.files || []);

    if (!files.length) {
      return;
    }

    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const validExtensions = [
      ".pdf",
      ".doc",
      ".docx",
    ];

    const validFiles = files.filter((file) => {
      const extension =
        `.${file.name.split(".").pop().toLowerCase()}`;

      return (
        validTypes.includes(file.type) ||
        validExtensions.includes(extension)
      );
    });

    if (!validFiles.length) {
      setError(
        "Please upload a PDF, DOC, or DOCX resume."
      );

      event.target.value = "";
      return;
    }

    setError("");

    setResumes((current) => {
      const existingNames = new Set(
        current.map((file) => file.name)
      );

      const newFiles = validFiles.filter(
        (file) => !existingNames.has(file.name)
      );

      return [...current, ...newFiles];
    });

    event.target.value = "";
  }

  /* =========================================================
     REMOVE RESUME
  ========================================================= */

  function removeResume(fileName) {
    setResumes((current) =>
      current.filter(
        (file) => file.name !== fileName
      )
    );

    setResults((current) =>
      current.filter(
        (result) =>
          result?.candidate?.fileName !== fileName
      )
    );
  }

  /* =========================================================
     NORMALIZE ARRAY
  ========================================================= */

  function normalizeArray(value) {
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (
            item &&
            typeof item === "object"
          ) {
            return String(
              item.skill ||
                item.name ||
                item.value ||
                ""
            ).trim();
          }

          return String(item).trim();
        })
        .filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(/[,;\n]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  /* =========================================================
     SAFE STRING
  ========================================================= */

  function safeString(value, fallback = "") {
    if (
      value === null ||
      value === undefined
    ) {
      return fallback;
    }

    if (
      typeof value === "string" ||
      typeof value === "number"
    ) {
      return String(value);
    }

    return fallback;
  }

  /* =========================================================
     NORMALIZE SCREENING RESULT
  ========================================================= */

  function normalizeResult(data, file) {
    const analytics =
      data?.analytics ||
      data?.screening ||
      data?.analysis ||
      {};

    const candidate =
      data?.candidate || {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      };

    /*
     * Required skills can come from several backend
     * versions. Normalize all of them into one structure.
     */

    const required =
      analytics.requiredSkills ||
      analytics.skills?.required ||
      data?.requiredSkillsAnalysis ||
      data?.skills?.required ||
      {};

    const preferred =
      analytics.preferredSkills ||
      analytics.skills?.preferred ||
      data?.preferredSkillsAnalysis ||
      data?.skills?.preferred ||
      {};

    /*
     * Experience can also be returned under different
     * structures depending on the backend version.
     */

    const experienceAnalysis =
      analytics.experience ||
      data?.experienceAnalysis ||
      {};

    const educationAnalysis =
      analytics.education ||
      data?.educationAnalysis ||
      {};

    const requiredRequested =
      normalizeArray(
        required.requested ||
          required.skills ||
          required.required ||
          required.requiredSkills ||
          data?.requestedRequiredSkills ||
          requiredSkills
      );

    const requiredMatched =
      normalizeArray(
        required.matched ||
          required.matchedSkills ||
          data?.matchedRequiredSkills
      );

    const requiredMissing =
      normalizeArray(
        required.missing ||
          required.missingSkills ||
          data?.missingRequiredSkills
      );

    const preferredRequested =
      normalizeArray(
        preferred.requested ||
          preferred.skills ||
          preferred.preferred ||
          preferred.preferredSkills ||
          data?.requestedPreferredSkills ||
          preferredSkills
      );

    const preferredMatched =
      normalizeArray(
        preferred.matched ||
          preferred.matchedSkills ||
          data?.matchedPreferredSkills
      );

    const preferredMissing =
      normalizeArray(
        preferred.missing ||
          preferred.missingSkills ||
          data?.missingPreferredSkills
      );

    /*
     * If backend does not explicitly return missing
     * required skills, calculate them from requested
     * versus matched.
     */

    const calculatedRequiredMissing =
      requiredMissing.length > 0
        ? requiredMissing
        : requiredRequested.filter(
            (skill) =>
              !requiredMatched.some(
                (matchedSkill) =>
                  matchedSkill.toLowerCase() ===
                  skill.toLowerCase()
              )
          );

    /*
     * Same fallback for preferred skills.
     */

    const calculatedPreferredMissing =
      preferredMissing.length > 0
        ? preferredMissing
        : preferredRequested.filter(
            (skill) =>
              !preferredMatched.some(
                (matchedSkill) =>
                  matchedSkill.toLowerCase() ===
                  skill.toLowerCase()
              )
          );

    /*
     * Backend score.
     *
     * IMPORTANT:
     * Do not use a frontend-generated score here.
     * The backend is the source of truth.
     */

    let overallScore = Number(
      analytics.overallScore ??
        analytics.score ??
        data?.overallScore ??
        data?.score ??
        0
    );

    if (!Number.isFinite(overallScore)) {
      overallScore = 0;
    }

    overallScore = Math.max(
      0,
      Math.min(100, Math.round(overallScore))
    );

    /*
     * Experience normalization.
     */

    const requiredExperience =
      safeString(
        experienceAnalysis.required,
        experience || "Not specified"
      );

    const candidateExperience =
      safeString(
        experienceAnalysis.candidate ||
          experienceAnalysis.candidateExperience ||
          experienceAnalysis.detected ||
          experienceAnalysis.years,
        "Not detected"
      );

    const experienceMatched = Boolean(
      experienceAnalysis.matched === true ||
        experienceAnalysis.isMatch === true ||
        experienceAnalysis.met === true
    );

    const experienceExplanation =
      safeString(
        experienceAnalysis.explanation ||
          experienceAnalysis.reason ||
          experienceAnalysis.message,
        ""
      );

    /*
     * Education normalization.
     */

    const requiredEducation =
      safeString(
        educationAnalysis.required,
        education || "Not specified"
      );

    const candidateEducation =
      safeString(
        educationAnalysis.candidate ||
          educationAnalysis.candidateEducation ||
          educationAnalysis.detected ||
          educationAnalysis.matchedEducation,
        "Not detected"
      );

    const educationMatched = Boolean(
      educationAnalysis.matched === true ||
        educationAnalysis.isMatch === true ||
        educationAnalysis.met === true
    );

    const educationExplanation =
      safeString(
        educationAnalysis.explanation ||
          educationAnalysis.reason ||
          educationAnalysis.message,
        ""
      );

    /*
     * Resume text.
     */

    const resumeText =
      data?.resumeText ||
      data?.extractedText ||
      analytics?.resumeText ||
      data?.extraction?.resumeText ||
      "";

    return {
      ...data,

      candidate,

      analytics: {
        ...analytics,

        overallScore,

        verdict:
          analytics.verdict ||
          data?.verdict ||
          "Needs review",

        suitability:
          analytics.suitability ||
          data?.suitability ||
          "Review required",

        recommendation:
          analytics.recommendation ||
          data?.recommendation ||
          "Review the candidate against the hiring criteria.",

        summary:
          analytics.summary ||
          data?.summary ||
          "No detailed suitability summary was returned.",

        requiredSkills: {
          total: requiredRequested.length,

          matched: requiredMatched,

          missing: calculatedRequiredMissing,

          requested: requiredRequested,
        },

        preferredSkills: {
          total: preferredRequested.length,

          matched: preferredMatched,

          missing: calculatedPreferredMissing,

          requested: preferredRequested,
        },

        experience: {
          required: requiredExperience,

          candidate: candidateExperience,

          matched: experienceMatched,

          explanation: experienceExplanation,
        },

        education: {
          required: requiredEducation,

          candidate: candidateEducation,

          matched: educationMatched,

          explanation: educationExplanation,
        },

        resumeText,
      },
    };
  }

  /* =========================================================
     START SCREENING
  ========================================================= */

  async function handleStartScreening() {
    setError("");
    setResults([]);

    if (!jobTitle.trim()) {
      setError(
        "Please enter the job title."
      );
      return;
    }

    if (!jobDescription.trim()) {
      setError(
        "Please enter the job description."
      );
      return;
    }

    if (!requiredSkills.trim()) {
      setError(
        "Please enter at least one required skill."
      );
      return;
    }

    if (!resumes.length) {
      setError(
        "Please upload at least one resume."
      );
      return;
    }

    setScreening(true);

    try {
      const screeningResults = [];

      /*
       * Backend uses:
       *
       * resumeUpload.single("resume")
       *
       * Therefore every resume is sent in its own request.
       */

      for (const file of resumes) {
        const formData = new FormData();

        formData.append(
          "resume",
          file
        );

        formData.append(
          "jobTitle",
          jobTitle.trim()
        );

        formData.append(
          "jobDescription",
          jobDescription.trim()
        );

        formData.append(
          "requiredSkills",
          requiredSkills.trim()
        );

        formData.append(
          "preferredSkills",
          preferredSkills.trim()
        );

        formData.append(
          "experience",
          experience.trim()
        );

        formData.append(
          "education",
          education.trim()
        );

        console.log(
          "[RESUME SCREENING] Sending:",
          file.name
        );

        const response =
          await api.post(
            "/recruitment/screen",
            formData
          );

        console.log(
          "[RESUME SCREENING] Backend response:",
          response.data
        );

        const normalized =
          normalizeResult(
            response.data,
            file
          );

        screeningResults.push(
          normalized
        );
      }

      setResults(
        screeningResults
      );
    } catch (err) {
      console.error(
        "Resume screening failed:",
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Resume screening failed.";

      setError(message);
    } finally {
      setScreening(false);
    }
  }

  /* =========================================================
     SCORE DISPLAY
  ========================================================= */

  function getScoreLabel(score) {
    if (score >= 85) {
      return "Strong match";
    }

    if (score >= 70) {
      return "Good match";
    }

    if (score >= 50) {
      return "Moderate match";
    }

    return "Weak match";
  }

  function getVerdictClass(score) {
    if (score >= 85) {
      return "bg-emerald-50 text-emerald-700";
    }

    if (score >= 70) {
      return "bg-blue-50 text-blue-700";
    }

    if (score >= 50) {
      return "bg-amber-50 text-amber-700";
    }

    return "bg-red-50 text-red-700";
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-w-0">

      {/* =====================================================
          BACK BUTTON
      ===================================================== */}

      <div className="mb-4 flex items-center">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 hover:text-ink-950"
        >
          <span aria-hidden="true">←</span>
          Back
        </button>
      </div>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-6">

        <div className="mb-2 flex items-center gap-2 text-sm text-ink-400">
          <BriefcaseBusiness className="h-4 w-4" />

          <span>
            Sourcing & Screening
          </span>
        </div>

        <h1 className="font-display text-2xl font-semibold text-ink-950">
          AI Resume Screening Assistant
        </h1>

        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Screen candidates against your actual job
          requirements and receive a detailed
          suitability assessment.
        </p>

      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">

          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>

            <p className="font-medium">
              Screening error
            </p>

            <p className="mt-1">
              {error}
            </p>

          </div>

        </div>
      )}

      {/* =====================================================
          SCREENING CRITERIA
      ===================================================== */}

      <div className="card mb-6 p-5">

        <div className="mb-5">

          <h2 className="text-lg font-semibold text-ink-950">
            Screening criteria
          </h2>

          <p className="mt-1 text-sm text-ink-500">
            These criteria are sent to the backend and
            used to evaluate every uploaded resume.
          </p>

        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

          {/* JOB TITLE */}

          <div>

            <label className="mb-2 block text-sm font-medium text-ink-700">
              Job title
            </label>

            <input
              type="text"
              value={jobTitle}
              onChange={(event) =>
                setJobTitle(
                  event.target.value
                )
              }
              placeholder="e.g. Senior React Developer"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400"
            />

          </div>

          {/* EXPERIENCE */}

          <div>

            <label className="mb-2 block text-sm font-medium text-ink-700">
              Minimum experience
            </label>

            <input
              type="text"
              value={experience}
              onChange={(event) =>
                setExperience(
                  event.target.value
                )
              }
              placeholder="e.g. 4 years"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400"
            />

          </div>

          {/* JOB DESCRIPTION */}

          <div className="md:col-span-2">

            <label className="mb-2 block text-sm font-medium text-ink-700">
              Job description
            </label>

            <textarea
              rows={5}
              value={jobDescription}
              onChange={(event) =>
                setJobDescription(
                  event.target.value
                )
              }
              placeholder="Describe the role, responsibilities, and expectations..."
              className="w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400"
            />

          </div>

          {/* REQUIRED SKILLS */}

          <div>

            <label className="mb-2 block text-sm font-medium text-ink-700">
              Required skills
            </label>

            <textarea
              rows={4}
              value={requiredSkills}
              onChange={(event) =>
                setRequiredSkills(
                  event.target.value
                )
              }
              placeholder="e.g. React, JavaScript, Node.js, REST APIs"
              className="w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400"
            />

            <p className="mt-1 text-xs text-ink-400">
              Separate skills with commas.
            </p>

          </div>

          {/* PREFERRED SKILLS */}

          <div>

            <label className="mb-2 block text-sm font-medium text-ink-700">
              Preferred skills
            </label>

            <textarea
              rows={4}
              value={preferredSkills}
              onChange={(event) =>
                setPreferredSkills(
                  event.target.value
                )
              }
              placeholder="e.g. AWS, Docker, TypeScript"
              className="w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400"
            />

            <p className="mt-1 text-xs text-ink-400">
              Separate skills with commas.
            </p>

          </div>

          {/* EDUCATION */}

          <div className="md:col-span-2">

            <label className="mb-2 block text-sm font-medium text-ink-700">
              Education
            </label>

            <input
              type="text"
              value={education}
              onChange={(event) =>
                setEducation(
                  event.target.value
                )
              }
              placeholder="e.g. Bachelor's degree in Computer Science"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400"
            />

          </div>

        </div>

      </div>

      {/* =====================================================
          RESUME UPLOAD
      ===================================================== */}

      <div className="card mb-6 p-5">

        <div className="mb-5">

          <h2 className="text-lg font-semibold text-ink-950">
            Candidate resumes
          </h2>

          <p className="mt-1 text-sm text-ink-500">
            Upload the resumes you want the assistant
            to analyze.
          </p>

        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          onChange={handleFiles}
          className="hidden"
        />

        <button
          type="button"
          onClick={() =>
            fileInputRef.current?.click()
          }
          className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-ink-300 bg-ink-50/50 px-6 py-10 text-center transition hover:border-ink-400 hover:bg-ink-50"
        >

          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">

            <Upload className="h-5 w-5 text-ink-500" />

          </div>

          <p className="mt-3 text-sm font-medium text-ink-800">
            Upload candidate resumes
          </p>

          <p className="mt-1 text-xs text-ink-500">
            PDF, DOC, or DOCX files
          </p>

        </button>

        {resumes.length > 0 && (
          <div className="mt-5 space-y-2">

            <div className="flex items-center justify-between">

              <p className="text-sm font-medium text-ink-700">
                Uploaded resumes
              </p>

              <span className="text-xs text-ink-400">
                {resumes.length} file
                {resumes.length === 1
                  ? ""
                  : "s"}
              </span>

            </div>

            {resumes.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 bg-white px-3 py-3"
              >

                <div className="flex min-w-0 items-center gap-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-50">

                    <FileText className="h-4 w-4 text-ink-500" />

                  </div>

                  <div className="min-w-0">

                    <p className="truncate text-sm font-medium text-ink-800">
                      {file.name}
                    </p>

                    <p className="text-xs text-ink-400">
                      {(
                        file.size /
                        1024 /
                        1024
                      ).toFixed(2)}{" "}
                      MB
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    removeResume(
                      file.name
                    )
                  }
                  className="shrink-0 rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>

              </div>
            ))}

          </div>
        )}

      </div>

      {/* =====================================================
          START SCREENING
      ===================================================== */}

      <div className="mb-8 flex justify-end">

        <button
          type="button"
          onClick={
            handleStartScreening
          }
          disabled={
            screening ||
            !jobTitle.trim() ||
            !jobDescription.trim() ||
            !requiredSkills.trim() ||
            resumes.length === 0
          }
          className="flex items-center justify-center gap-2 rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
        >

          <Sparkles className="h-4 w-4" />

          {screening
            ? "Analyzing resumes..."
            : "Start AI screening"}

        </button>

      </div>

      {/* =====================================================
          SCREENING RESULTS
      ===================================================== */}

      {results.length > 0 && (
        <div className="mt-10">

          <div className="mb-5">

            <h2 className="text-xl font-semibold text-ink-950">
              Screening results
            </h2>

            <p className="mt-1 text-sm text-ink-500">
              Candidate suitability based on the actual
              job requirements you provided.
            </p>

          </div>

          <div className="space-y-6">

            {results.map(
              (result, index) => {
                const analytics =
                  result?.analytics || {};

                const required =
                  analytics.requiredSkills ||
                  {};

                const preferred =
                  analytics.preferredSkills ||
                  {};

                const experienceResult =
                  analytics.experience ||
                  {};

                const educationResult =
                  analytics.education ||
                  {};

                const requiredRequested =
                  Array.isArray(
                    required.requested
                  )
                    ? required.requested
                    : [];

                const requiredMatched =
                  Array.isArray(
                    required.matched
                  )
                    ? required.matched
                    : [];

                const requiredMissing =
                  Array.isArray(
                    required.missing
                  )
                    ? required.missing
                    : [];

                const preferredRequested =
                  Array.isArray(
                    preferred.requested
                  )
                    ? preferred.requested
                    : [];

                const preferredMatched =
                  Array.isArray(
                    preferred.matched
                  )
                    ? preferred.matched
                    : [];

                const preferredMissing =
                  Array.isArray(
                    preferred.missing
                  )
                    ? preferred.missing
                    : [];

                const rawScore =
                  Number(
                    analytics.overallScore
                  );

                const score = Number.isFinite(
                  rawScore
                )
                  ? Math.max(
                      0,
                      Math.min(
                        100,
                        Math.round(
                          rawScore
                        )
                      )
                    )
                  : 0;

                return (
                  <div
                    key={
                      result?.candidate
                        ?.fileName ||
                      index
                    }
                    className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-sm"
                  >

                    {/* =================================================
                        RESULT HEADER
                    ================================================= */}

                    <div className="flex flex-col gap-4 border-b border-ink-100 p-5 md:flex-row md:items-center md:justify-between">

                      <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-50">

                          <FileText className="h-5 w-5 text-ink-500" />

                        </div>

                        <div className="min-w-0">

                          <p className="truncate text-sm font-semibold text-ink-900">
                            {
                              result
                                ?.candidate
                                ?.fileName
                            }
                          </p>

                          <p className="mt-1 text-xs text-ink-400">
                            Resume analyzed against{" "}
                            {jobTitle}
                          </p>

                        </div>

                      </div>

                      <div
                        className={`rounded-lg px-5 py-3 text-center ${getVerdictClass(
                          score
                        )}`}
                      >

                        <p className="text-xs font-medium">
                          Overall suitability
                        </p>

                        <p className="mt-1 text-2xl font-semibold">
                          {score}%
                        </p>

                        <p className="text-xs">
                          {getScoreLabel(
                            score
                          )}
                        </p>

                      </div>

                    </div>

                    {/* =================================================
                        SCORE CARDS
                    ================================================= */}

                    <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-4">

                      <div className="rounded-lg bg-ink-50 p-4">

                        <div className="flex items-center gap-2 text-xs text-ink-500">

                          <BarChart3 className="h-4 w-4" />

                          Overall score

                        </div>

                        <p className="mt-2 text-2xl font-semibold text-ink-950">
                          {score}%
                        </p>

                      </div>

                      <div className="rounded-lg bg-ink-50 p-4">

                        <div className="flex items-center gap-2 text-xs text-ink-500">

                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />

                          Required skills

                        </div>

                        <p className="mt-2 text-2xl font-semibold text-ink-950">

                          {
                            requiredMatched.length
                          }

                          /

                          {
                            requiredRequested.length
                          }

                        </p>

                      </div>

                      <div className="rounded-lg bg-ink-50 p-4">

                        <div className="flex items-center gap-2 text-xs text-ink-500">

                          <Target className="h-4 w-4 text-blue-600" />

                          Preferred skills

                        </div>

                        <p className="mt-2 text-2xl font-semibold text-ink-950">

                          {
                            preferredMatched.length
                          }

                          /

                          {
                            preferredRequested.length
                          }

                        </p>

                      </div>

                      <div className="rounded-lg bg-ink-50 p-4">

                        <div className="flex items-center gap-2 text-xs text-ink-500">

                          <XCircle className="h-4 w-4 text-red-500" />

                          Missing required

                        </div>

                        <p className="mt-2 text-2xl font-semibold text-ink-950">
                          {
                            requiredMissing.length
                          }
                        </p>

                      </div>

                    </div>

                    {/* =================================================
                        REQUIRED SKILLS ANALYSIS
                    ================================================= */}

                    <div className="border-t border-ink-100 p-5">

                      <div className="mb-4 flex items-center gap-2">

                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />

                        <div>

                          <h3 className="font-semibold text-ink-950">
                            Required skills analysis
                          </h3>

                          <p className="text-xs text-ink-500">
                            Skills explicitly required for
                            this position.
                          </p>

                        </div>

                      </div>

                      {/* REQUESTED */}

                      <div className="mb-4">

                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                          Required skills
                        </p>

                        <div className="flex flex-wrap gap-2">

                          {requiredRequested.length >
                          0 ? (
                            requiredRequested.map(
                              (skill) => {

                                const matched =
                                  requiredMatched.some(
                                    (item) =>
                                      String(
                                        item
                                      ).toLowerCase() ===
                                      String(
                                        skill
                                      ).toLowerCase()
                                  );

                                return (
                                  <span
                                    key={skill}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                                      matched
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-red-200 bg-red-50 text-red-700"
                                    }`}
                                  >
                                    {matched
                                      ? "✓ "
                                      : "✕ "}
                                    {skill}
                                  </span>
                                );
                              }
                            )
                          ) : (
                            <p className="text-sm text-ink-400">
                              No required skills returned.
                            </p>
                          )}

                        </div>

                      </div>

                      {/* MATCHED */}

                      <div className="mb-4">

                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                          Found in resume
                        </p>

                        {requiredMatched.length >
                        0 ? (
                          <div className="flex flex-wrap gap-2">

                            {requiredMatched.map(
                              (skill) => (
                                <span
                                  key={skill}
                                  className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                                >
                                  {skill}
                                </span>
                              )
                            )}

                          </div>
                        ) : (
                          <p className="text-sm text-red-600">
                            None of the required skills
                            were detected.
                          </p>
                        )}

                      </div>

                      {/* MISSING */}

                      <div>

                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                          Missing from resume
                        </p>

                        {requiredMissing.length >
                        0 ? (
                          <div className="flex flex-wrap gap-2">

                            {requiredMissing.map(
                              (skill) => (
                                <span
                                  key={skill}
                                  className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700"
                                >
                                  {skill}
                                </span>
                              )
                            )}

                          </div>
                        ) : (
                          <p className="text-sm text-emerald-600">
                            All required skills were
                            detected in the resume.
                          </p>
                        )}

                      </div>

                    </div>

                    {/* =================================================
                        PREFERRED SKILLS
                    ================================================= */}

                    <div className="border-t border-ink-100 p-5">

                      <div className="mb-4 flex items-center gap-2">

                        <Target className="h-5 w-5 text-blue-600" />

                        <div>

                          <h3 className="font-semibold text-ink-950">
                            Preferred skills analysis
                          </h3>

                          <p className="text-xs text-ink-500">
                            Additional skills that improve
                            candidate suitability.
                          </p>

                        </div>

                      </div>

                      <div className="mb-4">

                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                          Preferred skills
                        </p>

                        <div className="flex flex-wrap gap-2">

                          {preferredRequested.length >
                          0 ? (
                            preferredRequested.map(
                              (skill) => {

                                const matched =
                                  preferredMatched.some(
                                    (item) =>
                                      String(
                                        item
                                      ).toLowerCase() ===
                                      String(
                                        skill
                                      ).toLowerCase()
                                  );

                                return (
                                  <span
                                    key={skill}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                                      matched
                                        ? "border-blue-200 bg-blue-50 text-blue-700"
                                        : "border-ink-200 bg-ink-50 text-ink-500"
                                    }`}
                                  >
                                    {matched
                                      ? "✓ "
                                      : ""}
                                    {skill}
                                  </span>
                                );
                              }
                            )
                          ) : (
                            <p className="text-sm text-ink-400">
                              No preferred skills specified.
                            </p>
                          )}

                        </div>

                      </div>

                      {preferredMissing.length >
                        0 && (
                        <div>

                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                            Preferred skills not found
                          </p>

                          <div className="flex flex-wrap gap-2">

                            {preferredMissing.map(
                              (skill) => (
                                <span
                                  key={skill}
                                  className="rounded-full bg-ink-50 px-3 py-1.5 text-xs text-ink-500"
                                >
                                  {skill}
                                </span>
                              )
                            )}

                          </div>

                        </div>
                      )}

                    </div>

                    {/* =================================================
                        EXPERIENCE
                    ================================================= */}

                    <div className="border-t border-ink-100 p-5">

                      <div className="mb-4 flex items-center gap-2">

                        <Clock3 className="h-5 w-5 text-ink-500" />

                        <h3 className="font-semibold text-ink-950">
                          Experience analysis
                        </h3>

                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                        <div className="rounded-lg border border-ink-100 p-4">

                          <p className="text-xs text-ink-400">
                            Required experience
                          </p>

                          <p className="mt-1 font-medium text-ink-900">
                            {
                              experienceResult.required ||
                              "Not specified"
                            }
                          </p>

                        </div>

                        <div className="rounded-lg border border-ink-100 p-4">

                          <p className="text-xs text-ink-400">
                            Candidate experience
                          </p>

                          <p className="mt-1 font-medium text-ink-900">
                            {
                              experienceResult.candidate ||
                              "Not detected"
                            }
                          </p>

                        </div>

                      </div>

                      {experienceResult.explanation && (
                        <p className="mt-3 text-sm text-ink-500">
                          {
                            experienceResult.explanation
                          }
                        </p>
                      )}

                    </div>

                    {/* =================================================
                        EDUCATION
                    ================================================= */}

                    <div className="border-t border-ink-100 p-5">

                      <div className="mb-4 flex items-center gap-2">

                        <GraduationCap className="h-5 w-5 text-ink-500" />

                        <h3 className="font-semibold text-ink-950">
                          Education analysis
                        </h3>

                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                        <div className="rounded-lg border border-ink-100 p-4">

                          <p className="text-xs text-ink-400">
                            Required education
                          </p>

                          <p className="mt-1 font-medium text-ink-900">
                            {
                              educationResult.required ||
                              "Not specified"
                            }
                          </p>

                        </div>

                        <div className="rounded-lg border border-ink-100 p-4">

                          <p className="text-xs text-ink-400">
                            Candidate education
                          </p>

                          <p className="mt-1 font-medium text-ink-900">
                            {
                              educationResult.candidate ||
                              "Not detected"
                            }
                          </p>

                        </div>

                      </div>

                      {educationResult.explanation && (
                        <p className="mt-3 text-sm text-ink-500">
                          {
                            educationResult.explanation
                          }
                        </p>
                      )}

                    </div>

                    {/* =================================================
                        FINAL VERDICT
                    ================================================= */}

                    <div className="border-t border-ink-100 p-5">

                      <div className="rounded-lg border border-ink-200 bg-ink-50 p-5">

                        <div className="flex items-start gap-3">

                          <Sparkles className="mt-0.5 h-5 w-5 text-ink-600" />

                          <div className="min-w-0">

                            <h3 className="font-semibold text-ink-950">
                              Final AI verdict
                            </h3>

                            <p className="mt-2 text-sm font-medium text-ink-800">
                              {
                                analytics.verdict
                              }
                            </p>

                            <p className="mt-2 text-sm leading-6 text-ink-600">
                              {
                                analytics.recommendation
                              }
                            </p>

                          </div>

                        </div>

                      </div>

                      {/* SUITABILITY SUMMARY */}

                      <div className="mt-4 rounded-lg bg-ink-50 p-5">

                        <h3 className="font-semibold text-ink-950">
                          Suitability summary
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-ink-600">
                          {
                            analytics.summary
                          }
                        </p>

                      </div>

                    </div>

                    {/* =================================================
                        EXTRACTED RESUME
                    ================================================= */}

                    {analytics.resumeText && (
                      <details className="border-t border-ink-100">

                        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-ink-700">
                          View extracted resume content
                        </summary>

                        <div className="mx-5 mb-5 max-h-96 overflow-y-auto rounded-lg border border-ink-100 bg-ink-50 p-4">

                          <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-ink-700">
                            {
                              analytics.resumeText
                            }
                          </pre>

                        </div>

                      </details>
                    )}

                  </div>
                );
              }
            )}

          </div>

        </div>
      )}

    </div>
  );
}