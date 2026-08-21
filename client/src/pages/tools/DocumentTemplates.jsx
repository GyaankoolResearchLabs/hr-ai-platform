import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Edit3,
  FileText,
  Loader2,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const DOCUMENT_TYPES = [
  {
    value: "offer_letter",
    label: "Offer Letter",
  },
  {
    value: "experience_letter",
    label: "Experience Letter",
  },
  {
    value: "employment_verification",
    label: "Employment Verification",
  },
  {
    value: "address_proof",
    label: "Address Proof",
  },
];

const EMPTY_FORM = {
  document_type: "offer_letter",
  template_name: "",
  description: "",
  content: "",
  signatory_name: "",
  signatory_designation: "",
  logo_url: "",
  signature_url: "",
  is_default: false,
  styling: {
    font_family: "Arial",
    font_size: 14,
    line_height: 1.6,
    alignment: "left",
    primary_color: "#0f766e",
  },
};

const DEFAULT_CONTENT = {
  offer_letter: `Date: {{current_date}}

To,
{{full_name}}

Subject: Offer of Employment – {{title}}

Dear {{full_name}},

We are pleased to offer you the position of {{title}} in the {{department}} department at {{organization_name}}.

Your proposed date of joining will be {{joining_date}}.

Your employee identification number is {{employee_code}}.

You will be expected to perform the responsibilities associated with your position and comply with the organization's policies, procedures, and code of conduct.

We look forward to welcoming you to {{organization_name}} and wish you success in your role.

Sincerely,
{{signatory_name}}
{{signatory_designation}}`,

  experience_letter: `Date: {{current_date}}

To Whom It May Concern,

This is to certify that {{full_name}} was associated with {{organization_name}} as {{title}} in the {{department}} department.

Their period of employment was from {{joining_date}} to {{last_working_date}}.

During their tenure, they carried out the responsibilities associated with their position and contributed to the organization.

We wish {{full_name}} all the best in their future professional endeavors.

Sincerely,
{{signatory_name}}
{{signatory_designation}}`,

  employment_verification: `Date: {{current_date}}

To Whom It May Concern,

This letter confirms that {{full_name}} is/was employed by {{organization_name}}.

Employee Name: {{full_name}}
Employee Code: {{employee_code}}
Position: {{title}}
Department: {{department}}
Date of Joining: {{joining_date}}
Employment Status: {{employment_status}}

This verification is issued based on the employment records maintained by the organization.

Sincerely,
{{signatory_name}}
{{signatory_designation}}`,

  address_proof: `Date: {{current_date}}

To Whom It May Concern,

This document confirms that the following address is recorded in the employee records maintained by {{organization_name}}.

Employee Name: {{full_name}}
Employee Code: {{employee_code}}
Department: {{department}}
Designation: {{title}}

Address:
{{address}}

This document has been generated based on the information available in the organization's employee records.

Sincerely,
{{signatory_name}}
{{signatory_designation}}`,
};

function getDocumentTypeLabel(type) {
  const found = DOCUMENT_TYPES.find(
    (item) => item.value === type
  );

  return found ? found.label : type;
}

export default function DocumentTemplates() {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(
    EMPTY_FORM
  );

  async function loadTemplates() {
    setLoading(true);
    setError("");

    try {
      const { data } = await api.get(
        "/documents/templates"
      );

      setTemplates(data || []);
    } catch (err) {
      console.error(
        "Could not load templates:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Could not load document templates."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      styling: {
        ...EMPTY_FORM.styling,
      },
    });

    setEditingId(null);
    setShowForm(false);
  }

  function openCreateForm() {
    setSuccess("");
    setError("");

    setForm({
      ...EMPTY_FORM,
      content:
        DEFAULT_CONTENT.offer_letter,
      styling: {
        ...EMPTY_FORM.styling,
      },
    });

    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(template) {
    setSuccess("");
    setError("");

    setForm({
      document_type:
        template.document_type ||
        "offer_letter",

      template_name:
        template.template_name || "",

      description:
        template.description || "",

      content:
        template.content || "",

      signatory_name:
        template.signatory_name || "",

      signatory_designation:
        template.signatory_designation ||
        "",

      logo_url:
        template.logo_url || "",

      signature_url:
        template.signature_url || "",

      is_default:
        Boolean(template.is_default),

      styling: {
        ...EMPTY_FORM.styling,
        ...(template.styling || {}),
      },
    });

    setEditingId(template.id);
    setShowForm(true);
  }

  function handleDocumentTypeChange(value) {
    setForm((current) => ({
      ...current,
      document_type: value,
      content:
        current.content.trim() === "" ||
        Object.values(DEFAULT_CONTENT).includes(
          current.content
        )
          ? DEFAULT_CONTENT[value]
          : current.content,
    }));
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateStyling(field, value) {
    setForm((current) => ({
      ...current,
      styling: {
        ...current.styling,
        [field]: value,
      },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        document_type:
          form.document_type,

        template_name:
          form.template_name.trim(),

        description:
          form.description.trim() || null,

        content:
          form.content.trim(),

        styling: form.styling,

        logo_url:
          form.logo_url.trim() || null,

        signature_url:
          form.signature_url.trim() ||
          null,

        signatory_name:
          form.signatory_name.trim() ||
          null,

        signatory_designation:
          form.signatory_designation.trim() ||
          null,

        is_default:
          Boolean(form.is_default),
      };

      if (editingId) {
        await api.put(
          `/documents/templates/${editingId}`,
          payload
        );

        setSuccess(
          "Template updated successfully."
        );
      } else {
        await api.post(
          "/documents/templates",
          payload
        );

        setSuccess(
          "Template created successfully."
        );
      }

      await loadTemplates();
      resetForm();
    } catch (err) {
      console.error(
        "Template save error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Could not save template."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(template) {
    const confirmed = window.confirm(
      `Delete "${template.template_name}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await api.delete(
        `/documents/templates/${template.id}`
      );

      setSuccess(
        "Template deleted successfully."
      );

      await loadTemplates();
    } catch (err) {
      console.error(
        "Template delete error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Could not delete template."
      );
    }
  }

  async function handleSetDefault(template) {
    setError("");
    setSuccess("");

    try {
      await api.post(
        `/documents/templates/${template.id}/default`
      );

      setSuccess(
        `"${template.template_name}" is now the default template.`
      );

      await loadTemplates();
    } catch (err) {
      console.error(
        "Set default template error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Could not set default template."
      );
    }
  }

  return (
    <div className="min-w-0">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() =>
              navigate(
                "/app/tools/document-letter-generator"
              )
            }
            className="mb-4 flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to document generator
          </button>

          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-lg bg-brand-50 p-2 text-brand-700">
              <FileText className="h-5 w-5" />
            </div>

            <div>
              <h1 className="font-display text-2xl font-semibold text-ink-950">
                Document Templates
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-ink-500">
                Create organization-specific formats
                for your HR letters and documents.
              </p>
            </div>
          </div>
        </div>

        {!showForm && (
          <button
            type="button"
            onClick={openCreateForm}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900"
          >
            <Plus className="h-4 w-4" />
            Create template
          </button>
        )}
      </div>

      {/* =====================================================
          ALERTS
      ===================================================== */}

      {error && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-soft px-4 py-3 text-sm text-ink-800">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* =====================================================
          TEMPLATE FORM
      ===================================================== */}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card mb-8 overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink-950">
                {editingId
                  ? "Edit template"
                  : "Create template"}
              </h2>

              <p className="mt-1 text-sm text-ink-500">
                Customize the document format used
                by your organization.
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
            {/* =================================================
                BASIC INFORMATION
            ================================================= */}

            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">
                  Document type
                </label>

                <select
                  value={form.document_type}
                  onChange={(event) =>
                    handleDocumentTypeChange(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                >
                  {DOCUMENT_TYPES.map(
                    (type) => (
                      <option
                        key={type.value}
                        value={type.value}
                      >
                        {type.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">
                  Template name
                </label>

                <input
                  required
                  value={
                    form.template_name
                  }
                  onChange={(event) =>
                    updateForm(
                      "template_name",
                      event.target.value
                    )
                  }
                  placeholder="Acme Standard Offer Letter"
                  className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">
                  Description
                </label>

                <textarea
                  rows={3}
                  value={
                    form.description
                  }
                  onChange={(event) =>
                    updateForm(
                      "description",
                      event.target.value
                    )
                  }
                  placeholder="Standard offer letter used by the HR department."
                  className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>

              {/* =================================================
                  SIGNATORY
              ================================================= */}

              <div className="border-t border-ink-100 pt-5">
                <h3 className="mb-4 text-sm font-semibold text-ink-900">
                  Signatory
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink-700">
                      Signatory name
                    </label>

                    <input
                      value={
                        form.signatory_name
                      }
                      onChange={(event) =>
                        updateForm(
                          "signatory_name",
                          event.target.value
                        )
                      }
                      placeholder="Priya Sharma"
                      className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink-700">
                      Designation
                    </label>

                    <input
                      value={
                        form.signatory_designation
                      }
                      onChange={(event) =>
                        updateForm(
                          "signatory_designation",
                          event.target.value
                        )
                      }
                      placeholder="Head of Human Resources"
                      className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>

              {/* =================================================
                  BRANDING
              ================================================= */}

              <div className="border-t border-ink-100 pt-5">
                <h3 className="mb-4 text-sm font-semibold text-ink-900">
                  Branding
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink-700">
                      Logo URL
                    </label>

                    <input
                      type="url"
                      value={
                        form.logo_url
                      }
                      onChange={(event) =>
                        updateForm(
                          "logo_url",
                          event.target.value
                        )
                      }
                      placeholder="https://example.com/logo.png"
                      className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink-700">
                      Signature URL
                    </label>

                    <input
                      type="url"
                      value={
                        form.signature_url
                      }
                      onChange={(event) =>
                        updateForm(
                          "signature_url",
                          event.target.value
                        )
                      }
                      placeholder="https://example.com/signature.png"
                      className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>

              {/* =================================================
                  STYLING
              ================================================= */}

              <div className="border-t border-ink-100 pt-5">
                <h3 className="mb-4 text-sm font-semibold text-ink-900">
                  Document styling
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink-700">
                      Font
                    </label>

                    <select
                      value={
                        form.styling
                          .font_family
                      }
                      onChange={(event) =>
                        updateStyling(
                          "font_family",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    >
                      <option value="Arial">
                        Arial
                      </option>

                      <option value="Georgia">
                        Georgia
                      </option>

                      <option value="Times New Roman">
                        Times New Roman
                      </option>

                      <option value="Calibri">
                        Calibri
                      </option>

                      <option value="Verdana">
                        Verdana
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink-700">
                      Font size
                    </label>

                    <select
                      value={
                        form.styling
                          .font_size
                      }
                      onChange={(event) =>
                        updateStyling(
                          "font_size",
                          Number(
                            event.target.value
                          )
                        )
                      }
                      className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    >
                      <option value={12}>
                        12px
                      </option>

                      <option value={13}>
                        13px
                      </option>

                      <option value={14}>
                        14px
                      </option>

                      <option value={15}>
                        15px
                      </option>

                      <option value={16}>
                        16px
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink-700">
                      Alignment
                    </label>

                    <select
                      value={
                        form.styling
                          .alignment
                      }
                      onChange={(event) =>
                        updateStyling(
                          "alignment",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    >
                      <option value="left">
                        Left
                      </option>

                      <option value="center">
                        Center
                      </option>

                      <option value="right">
                        Right
                      </option>

                      <option value="justify">
                        Justified
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink-700">
                      Brand color
                    </label>

                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={
                          form.styling
                            .primary_color
                        }
                        onChange={(event) =>
                          updateStyling(
                            "primary_color",
                            event.target.value
                          )
                        }
                        className="h-10 w-12 cursor-pointer rounded border border-ink-200"
                      />

                      <input
                        value={
                          form.styling
                            .primary_color
                        }
                        onChange={(event) =>
                          updateStyling(
                            "primary_color",
                            event.target.value
                          )
                        }
                        className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* =================================================
                  DEFAULT
              ================================================= */}

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-100 bg-ink-50 p-4">
                <input
                  type="checkbox"
                  checked={
                    form.is_default
                  }
                  onChange={(event) =>
                    updateForm(
                      "is_default",
                      event.target.checked
                    )
                  }
                  className="mt-0.5 h-4 w-4 rounded border-ink-300"
                />

                <span>
                  <span className="block text-sm font-medium text-ink-900">
                    Make this the default template
                  </span>

                  <span className="mt-0.5 block text-xs text-ink-500">
                    New documents of this type will
                    automatically use this template.
                  </span>
                </span>
              </label>
            </div>

            {/* =================================================
                CONTENT EDITOR
            ================================================= */}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-ink-700">
                    Document content
                  </label>

                  <p className="mt-1 text-xs text-ink-500">
                    Use placeholders to automatically
                    insert employee information.
                  </p>
                </div>
              </div>

              <textarea
                required
                value={form.content}
                onChange={(event) =>
                  updateForm(
                    "content",
                    event.target.value
                  )
                }
                className="min-h-[620px] w-full resize-y rounded-lg border border-ink-200 bg-white px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-brand-500"
              />

              {/* =================================================
                  PLACEHOLDERS
              ================================================= */}

              <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-ink-900">
                  Available placeholders
                </h3>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {[
                    "{{organization_name}}",
                    "{{organization_industry}}",
                    "{{full_name}}",
                    "{{email}}",
                    "{{employee_code}}",
                    "{{department}}",
                    "{{title}}",
                    "{{joining_date}}",
                    "{{last_working_date}}",
                    "{{employment_status}}",
                    "{{address}}",
                    "{{current_date}}",
                  ].map(
                    (placeholder) => (
                      <button
                        key={placeholder}
                        type="button"
                        onClick={() =>
                          updateForm(
                            "content",
                            `${form.content}${form.content.endsWith("\n") ? "" : "\n"}${placeholder}`
                          )
                        }
                        className="rounded bg-white px-2 py-1.5 text-left font-mono text-xs text-brand-800 hover:bg-brand-100"
                      >
                        {placeholder}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================
              FORM ACTIONS
          ===================================================== */}

          <div className="flex flex-col-reverse gap-3 border-t border-ink-100 bg-ink-50 px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                !form.template_name.trim() ||
                !form.content.trim()
              }
              className="flex items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              {editingId
                ? "Update template"
                : "Save template"}
            </button>
          </div>
        </form>
      )}

      {/* =====================================================
          TEMPLATE LIST
      ===================================================== */}

      {!showForm && (
        <div>
          {loading ? (
            <div className="card flex items-center justify-center gap-2 py-16 text-sm text-ink-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 rounded-full bg-brand-50 p-4 text-brand-700">
                <FileText className="h-7 w-7" />
              </div>

              <h2 className="font-display text-lg font-semibold text-ink-950">
                No organization templates yet
              </h2>

              <p className="mt-2 max-w-md text-sm text-ink-500">
                Create your first document template
                to define how your organization's
                HR letters should look.
              </p>

              <button
                type="button"
                onClick={openCreateForm}
                className="mt-5 flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900"
              >
                <Plus className="h-4 w-4" />
                Create your first template
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {DOCUMENT_TYPES.map(
                (documentType) => {
                  const typeTemplates =
                    templates.filter(
                      (template) =>
                        template.document_type ===
                        documentType.value
                    );

                  return (
                    <section
                      key={
                        documentType.value
                      }
                    >
                      <div className="mb-3">
                        <h2 className="font-display text-lg font-semibold text-ink-950">
                          {
                            documentType.label
                          }
                        </h2>

                        <p className="mt-0.5 text-sm text-ink-500">
                          Organization formats for{" "}
                          {
                            documentType.label.toLowerCase()
                          }.
                        </p>
                      </div>

                      {typeTemplates.length ===
                      0 ? (
                        <div className="rounded-lg border border-dashed border-ink-200 bg-white px-5 py-6 text-sm text-ink-400">
                          No custom template created
                          yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                          {typeTemplates.map(
                            (template) => (
                              <div
                                key={
                                  template.id
                                }
                                className="card overflow-hidden"
                              >
                                <div className="p-5">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex min-w-0 items-start gap-3">
                                      <div className="rounded-lg bg-brand-50 p-2 text-brand-700">
                                        <FileText className="h-5 w-5" />
                                      </div>

                                      <div className="min-w-0">
                                        <h3 className="truncate font-semibold text-ink-950">
                                          {
                                            template.template_name
                                          }
                                        </h3>

                                        {template.description && (
                                          <p className="mt-1 text-sm text-ink-500">
                                            {
                                              template.description
                                            }
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    {template.is_default && (
                                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
                                        <Star className="h-3 w-3 fill-current" />
                                        Default
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-500">
                                    <span className="rounded-full bg-ink-50 px-2.5 py-1">
                                      {
                                        getDocumentTypeLabel(
                                          template.document_type
                                        )
                                      }
                                    </span>

                                    {template.status && (
                                      <span className="rounded-full bg-ink-50 px-2.5 py-1">
                                        {template.status}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2 border-t border-ink-100 bg-ink-50 px-5 py-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditForm(
                                        template
                                      )
                                    }
                                    className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                    Edit
                                  </button>

                                  {!template.is_default && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetDefault(
                                          template
                                        )
                                      }
                                      className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
                                    >
                                      <Star className="h-3.5 w-3.5" />
                                      Set default
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDelete(
                                        template
                                      )
                                    }
                                    className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </section>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}   