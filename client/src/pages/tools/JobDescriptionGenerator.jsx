import React, { useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Copy,
  Download,
  Sparkles,
  Loader2,
  RefreshCw,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default function JobDescriptionGenerator() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    jobTitle: "",
    department: "",
    location: "",
    employmentType: "Full-time",
    experienceLevel: "",
    requiredSkills: "",
    preferredSkills: "",
    responsibilities: "",
    education: "",
    salaryRange: "",
    companyDescription: "",
  });

  const [generatedJD, setGeneratedJD] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function generateJobDescription() {
    if (!form.jobTitle.trim()) {
      toast.error("Please enter a job title.");
      return;
    }

    if (!form.department.trim()) {
      toast.error("Please enter a department.");
      return;
    }

    if (!form.requiredSkills.trim()) {
      toast.error("Please enter the required skills.");
      return;
    }

    setLoading(true);
    setCopied(false);

    try {
      const response = await api.post(
        "/ai/job-description",
        {
          ...form,
        }
      );

      const generated =
        response?.data?.jobDescription ||
        response?.data?.result ||
        response?.data?.reply ||
        "";

      if (!generated) {
        throw new Error(
          "The server did not return a generated job description."
        );
      }

      setGeneratedJD(generated);

      toast.success(
        "Job description generated successfully."
      );
    } catch (error) {
      console.error(
        "Job description generation error:",
        error
      );

      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Could not generate the job description.";

      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function copyJobDescription() {
    if (!generatedJD) {
      toast.error("Generate a job description first.");
      return;
    }

    try {
      await navigator.clipboard.writeText(
        generatedJD
      );

      setCopied(true);

      toast.success(
        "Job description copied."
      );

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        "Copy error:",
        error
      );

      toast.error(
        "Could not copy the job description."
      );
    }
  }

  function downloadJobDescription() {
    if (!generatedJD) {
      toast.error(
        "Generate a job description first."
      );
      return;
    }

    const blob = new Blob(
      [generatedJD],
      {
        type: "text/plain;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    const safeTitle =
      form.jobTitle
        .trim()
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "");

    link.download =
      `${safeTitle || "job_description"}.txt`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    toast.success(
      "Job description downloaded."
    );
  }

  function resetGenerator() {
    setForm({
      jobTitle: "",
      department: "",
      location: "",
      employmentType: "Full-time",
      experienceLevel: "",
      requiredSkills: "",
      preferredSkills: "",
      responsibilities: "",
      education: "",
      salaryRange: "",
      companyDescription: "",
    });

    setGeneratedJD("");
    setCopied(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              title="Go back"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <BriefcaseBusiness
                  size={20}
                  className="text-slate-700"
                />

                <h1 className="text-xl font-semibold text-slate-900">
                  Job Description Generator
                </h1>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Create consistent, role-accurate job
                descriptions in minutes.
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600 sm:flex">
            <Sparkles size={15} />
            AI-powered
          </div>
        </div>
      </div>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* =================================================
              LEFT — INPUT
          ================================================= */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Job details
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Provide the role information and AI will
                generate the job description.
              </p>
            </div>

            <div className="space-y-5">
              {/* Job title */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Job title *
                </label>

                <input
                  type="text"
                  name="jobTitle"
                  value={form.jobTitle}
                  onChange={handleChange}
                  placeholder="e.g. Software Engineer"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              {/* Department + location */}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Department *
                  </label>

                  <input
                    type="text"
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    placeholder="e.g. Engineering"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Location
                  </label>

                  <input
                    type="text"
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="e.g. Bengaluru / Remote"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </div>

              {/* Employment + experience */}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Employment type
                  </label>

                  <select
                    name="employmentType"
                    value={form.employmentType}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="Full-time">
                      Full-time
                    </option>

                    <option value="Part-time">
                      Part-time
                    </option>

                    <option value="Contract">
                      Contract
                    </option>

                    <option value="Internship">
                      Internship
                    </option>

                    <option value="Temporary">
                      Temporary
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Experience level
                  </label>

                  <input
                    type="text"
                    name="experienceLevel"
                    value={form.experienceLevel}
                    onChange={handleChange}
                    placeholder="e.g. 3–5 years"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </div>

              {/* Required skills */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Required skills *
                </label>

                <textarea
                  name="requiredSkills"
                  value={form.requiredSkills}
                  onChange={handleChange}
                  rows={3}
                  placeholder="e.g. React, JavaScript, Node.js, SQL"
                  className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />

                <p className="mt-1 text-xs text-slate-400">
                  Separate skills with commas.
                </p>
              </div>

              {/* Preferred skills */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Preferred skills
                </label>

                <textarea
                  name="preferredSkills"
                  value={form.preferredSkills}
                  onChange={handleChange}
                  rows={3}
                  placeholder="e.g. AWS, Docker, TypeScript"
                  className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              {/* Responsibilities */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Key responsibilities
                </label>

                <textarea
                  name="responsibilities"
                  value={form.responsibilities}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Describe the main responsibilities for this role."
                  className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              {/* Education + salary */}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Education
                  </label>

                  <input
                    type="text"
                    name="education"
                    value={form.education}
                    onChange={handleChange}
                    placeholder="e.g. B.Tech / BCA / MCA"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Salary range
                  </label>

                  <input
                    type="text"
                    name="salaryRange"
                    value={form.salaryRange}
                    onChange={handleChange}
                    placeholder="e.g. ₹8–12 LPA"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </div>

              {/* Company description */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Company / team description
                </label>

                <textarea
                  name="companyDescription"
                  value={form.companyDescription}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Briefly describe the company, team, product, or work environment."
                  className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              {/* Actions */}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={generateJobDescription}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />

                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={17} />

                      Generate job description
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={resetGenerator}
                  disabled={loading}
                  className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </div>
          </section>

          {/* =================================================
              RIGHT — RESULT
          ================================================= */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Generated job description
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your AI-generated job description will
                  appear here.
                </p>
              </div>

              {generatedJD && (
                <button
                  type="button"
                  onClick={generateJobDescription}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  title="Generate again"
                >
                  <RefreshCw size={15} />

                  Regenerate
                </button>
              )}
            </div>

            {!generatedJD && !loading && (
              <div className="flex min-h-[600px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-8 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                  <Sparkles
                    size={24}
                    className="text-slate-500"
                  />
                </div>

                <h3 className="text-base font-semibold text-slate-800">
                  Nothing generated yet
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Fill in the job details and click
                  Generate job description to create a
                  role-specific JD.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex min-h-[600px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                <Loader2
                  size={32}
                  className="animate-spin text-slate-700"
                />

                <p className="mt-4 text-sm font-medium text-slate-700">
                  Creating your job description...
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  The AI is analyzing the role requirements.
                </p>
              </div>
            )}

            {generatedJD && !loading && (
              <>
                <div className="min-h-[600px] whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm leading-7 text-slate-700">
                  {generatedJD}
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={copyJobDescription}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {copied ? (
                      <>
                        <Check size={17} />

                        Copied
                      </>
                    ) : (
                      <>
                        <Copy size={17} />

                        Copy
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={downloadJobDescription}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Download size={17} />

                    Download
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}