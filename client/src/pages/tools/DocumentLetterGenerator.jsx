import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FileText,
  Loader2,
  User,
  Building2,
  CalendarDays,
  BriefcaseBusiness,
  MapPin,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Save,
  X,
  Palette,
  Type,
  Image,
  UserPen,
  Check,
  Search,
  Send,
} from "lucide-react";

import { Link } from "react-router-dom";

import { employeeService } from "../../services/employeeService";
import { documentService } from "../../services/documentService";
import api from "../../services/api";
import { documentTemplateService } from "../../services/documentTemplateService";

/* ============================================================
   DOCUMENT TYPES
============================================================ */

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

/* ============================================================
   DYNAMIC FIELDS
============================================================ */

const DYNAMIC_FIELDS = [
  {
    group: "Employee",
    fields: [
      ["{{employee_name}}", "Employee Name"],
      ["{{employee_code}}", "Employee Code"],
      ["{{employee_email}}", "Employee Email"],
      ["{{department}}", "Department"],
      ["{{job_title}}", "Job Title"],
      ["{{joining_date}}", "Joining Date"],
      [
        "{{last_working_date}}",
        "Last Working Date",
      ],
      [
        "{{employment_status}}",
        "Employment Status",
      ],
      [
        "{{employment_duration}}",
        "Employment Duration",
      ],
      [
        "{{employee_address}}",
        "Employee Address",
      ],
    ],
  },
  {
    group: "Organization",
    fields: [
      [
        "{{organization_name}}",
        "Organization Name",
      ],
      [
        "{{organization_industry}}",
        "Industry",
      ],
    ],
  },
  {
    group: "Document",
    fields: [
      ["{{letter_date}}", "Letter Date"],
    ],
  },
  {
    group: "Signatory",
    fields: [
      [
        "{{signatory_name}}",
        "Signatory Name",
      ],
      [
        "{{signatory_designation}}",
        "Signatory Designation",
      ],
    ],
  },
];

/* ============================================================
   DEFAULT DOCUMENT CONTENT
============================================================ */

const DEFAULT_CONTENTS = {
  offer_letter: `Date: {{letter_date}}

To,
{{employee_name}}
{{employee_address}}

Subject: Offer of Employment – {{job_title}}

Dear {{employee_name}},

We are pleased to offer you the position of {{job_title}} in the {{department}} department at {{organization_name}}.

Your proposed date of joining will be {{joining_date}}.

Your employee identification number is {{employee_code}}.

You will be expected to perform the responsibilities associated with your position and comply with the organization's policies, procedures, and code of conduct.

We look forward to welcoming you to {{organization_name}} and wish you success in your role.

Sincerely,

{{signatory_name}}
{{signatory_designation}}`,

  experience_letter: `Date: {{letter_date}}

To Whom It May Concern,

This is to certify that {{employee_name}}, employee code {{employee_code}}, was employed with {{organization_name}} as {{job_title}} in the {{department}} department.

{{employee_name}} joined the organization on {{joining_date}} and completed the employment period of {{employment_duration}}.

The employee's last working date was {{last_working_date}}.

We appreciate the contributions made during the period of employment and wish {{employee_name}} success in future endeavors.

Sincerely,

{{signatory_name}}
{{signatory_designation}}`,

  employment_verification: `Date: {{letter_date}}

To Whom It May Concern,

This letter confirms that {{employee_name}} is/was employed by {{organization_name}}.

Position: {{job_title}}

Department: {{department}}

Employee Code: {{employee_code}}

Employee Email: {{employee_email}}

Employment Status: {{employment_status}}

Date of Joining: {{joining_date}}

Last Working Date: {{last_working_date}}

This verification is issued based on the employment records maintained by the organization.

Sincerely,

{{signatory_name}}
{{signatory_designation}}`,

  address_proof: `Date: {{letter_date}}

To Whom It May Concern,

This is to certify that {{employee_name}}, employee code {{employee_code}}, is/was associated with {{organization_name}}.

Employee Address:

{{employee_address}}

Position: {{job_title}}

Department: {{department}}

Date of Joining: {{joining_date}}

This letter is issued upon the employee's request for address verification purposes.

Sincerely,

{{signatory_name}}
{{signatory_designation}}`,
};

/* ============================================================
   DEFAULT STYLING
============================================================ */

const DEFAULT_STYLING = {
  fontFamily: "Arial",
  fontSize: 11,
  primaryColor: "#155e5a",
  headerEnabled: true,
  footerEnabled: true,
  logoPosition: "center",
  showDivider: true,
};

/* ============================================================
   EMPTY TEMPLATE
============================================================ */

const EMPTY_TEMPLATE = {
  document_type: "offer_letter",
  template_name: "",
  description: "",
  content: DEFAULT_CONTENTS.offer_letter,
  styling: {
    ...DEFAULT_STYLING,
  },
  logo_url: "",
  signature_url: "",
  signatory_name: "",
  signatory_designation: "",
  status: "draft",
  is_default: false,
};

/* ============================================================
   SAFE DATE FORMATTER
============================================================ */

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
}

/* ============================================================
   COMPONENT
============================================================ */

export default function DocumentLetterGenerator() {
  /* ==========================================================
     EMPLOYEE STATE
  ========================================================== */

  const [employees, setEmployees] =
    useState([]);

  const [
    selectedEmployeeId,
    setSelectedEmployeeId,
  ] = useState("");

  const [
    employeeSearch,
    setEmployeeSearch,
  ] = useState("");

  const [
    loadingEmployees,
    setLoadingEmployees,
  ] = useState(true);

  /* ==========================================================
     DOCUMENT STATE
  ========================================================== */

  const [
    documentType,
    setDocumentType,
  ] = useState("offer_letter");

  const [
    document,
    setDocument,
  ] = useState(null);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    savingDocument,
    setSavingDocument,
  ] = useState(false);

  const [
    documentSaved,
    setDocumentSaved,
  ] = useState(false);

  const [
    savedDocumentId,
    setSavedDocumentId,
  ] = useState("");

  const [
    sendingDocument,
    setSendingDocument,
  ] = useState(false);

  const [
    sendSuccess,
    setSendSuccess,
  ] = useState("");

  const [
    sendError,
    setSendError,
  ] = useState("");

  const [
    saveError,
    setSaveError,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  /* ==========================================================
     RESTORE STATE
  ========================================================== */

  const restoringDocumentRef =
    useRef(false);

  const restoredDocumentRef =
    useRef(false);

  /* ==========================================================
     TEMPLATE STATE
  ========================================================== */

  const [
    templates,
    setTemplates,
  ] = useState([]);

  const [
    loadingTemplates,
    setLoadingTemplates,
  ] = useState(true);

  const [
    selectedTemplateId,
    setSelectedTemplateId,
  ] = useState("");

  const [
    showTemplateManager,
    setShowTemplateManager,
  ] = useState(false);

  const [
    editingTemplateId,
    setEditingTemplateId,
  ] = useState(null);

  const [
    templateForm,
    setTemplateForm,
  ] = useState({
    ...EMPTY_TEMPLATE,
    styling: {
      ...DEFAULT_STYLING,
    },
  });

  const [
    savingTemplate,
    setSavingTemplate,
  ] = useState(false);

  const [
    templateError,
    setTemplateError,
  ] = useState("");

  const [
    templateSuccess,
    setTemplateSuccess,
  ] = useState("");

  /* ==========================================================
     LOAD EMPLOYEES
  ========================================================== */

  async function loadEmployees() {
    setLoadingEmployees(true);
    setError("");

    try {
      const data =
        await employeeService.list();

      setEmployees(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (err) {
      console.error(
        "Could not load employees:",
        err
      );

      setError(
        "Couldn't load employees. Make sure the backend is running."
      );
    } finally {
      setLoadingEmployees(false);
    }
  }

  /* ==========================================================
     LOAD TEMPLATES
  ========================================================== */

  async function loadTemplates() {
    setLoadingTemplates(true);
    setTemplateError("");

    try {
      const data =
        await documentTemplateService.list();

      const safeTemplates =
        Array.isArray(data)
          ? data
          : [];

      setTemplates(
        safeTemplates
      );
    } catch (err) {
      console.error(
        "Could not load document templates:",
        err
      );

      setTemplateError(
        "Couldn't load your organization's document templates."
      );
    } finally {
      setLoadingTemplates(false);
    }
  }

  /* ==========================================================
     LOAD LAST SAVED DOCUMENT
  ========================================================== */

  async function loadLastSavedDocument() {
    if (restoredDocumentRef.current) {
      return;
    }

    restoringDocumentRef.current = true;

    try {
      let savedDocuments = [];

      /*
        The generated-document service may expose the
        list method under one of these names depending
        on the backend/service version.

        We check the available method instead of assuming
        one exact implementation.
      */
      const listMethod =
        documentService.getGeneratedDocuments ||
        documentService.listGeneratedDocuments ||
        documentService.getSavedDocuments ||
        documentService.listSavedDocuments;

      if (typeof listMethod === "function") {
        const response =
          await listMethod.call(
            documentService
          );

        if (Array.isArray(response)) {
          savedDocuments = response;
        } else if (
          Array.isArray(response?.documents)
        ) {
          savedDocuments =
            response.documents;
        } else if (
          Array.isArray(response?.data)
        ) {
          savedDocuments =
            response.data;
        }
      }

      /*
        Fallback for the current session/browser.
        This ensures a document remains visible even
        if the generated-document list method has not
        yet been exposed by the service layer.
      */
      if (savedDocuments.length === 0) {
        try {
          const localSaved =
            localStorage.getItem(
              "skillos:last-generated-document"
            );

          if (localSaved) {
            const parsed =
              JSON.parse(localSaved);

            if (parsed?.document) {
              savedDocuments = [parsed];
            }
          }
        } catch (storageError) {
          console.warn(
            "Could not restore local saved document:",
            storageError
          );
        }
      }

      if (savedDocuments.length === 0) {
        return;
      }

      /*
        The newest record should be first. If the backend
        returns oldest-first, reverse the array before
        selecting the most recent record.
      */
      const savedRecord =
        savedDocuments[0];

      const savedData =
        savedRecord?.document_data ||
        savedRecord?.document ||
        savedRecord?.generated_document ||
        savedRecord?.data ||
        (savedRecord?.content
          ? savedRecord
          : null);

      if (!savedData) {
        return;
      }

      const restoredType =
        savedRecord?.document_type ||
        savedData?.type ||
        savedData?.document_type;

      const restoredEmployeeId =
        savedRecord?.employee_id ||
        savedData?.employee_id ||
        savedData?.employee?.id ||
        savedData?.employee?.employee_id ||
        "";

      const restoredTemplateId =
        savedRecord?.template_id ||
        savedData?.template_id ||
        savedData?.template?.id ||
        "";

      if (restoredType) {
        const validType =
          DOCUMENT_TYPES.some(
            (type) =>
              type.value === restoredType
          );

        if (validType) {
          /*
            Tell the document-type effect that this
            change is restoration, not a user change.
          */
          previousDocumentTypeRef.current =
            restoredType;

          setDocumentType(
            restoredType
          );
        }
      }

      if (restoredEmployeeId) {
        setSelectedEmployeeId(
          restoredEmployeeId
        );

        const restoredEmployee =
          employees.find(
            (employee) =>
              employee.id ===
              restoredEmployeeId
          );

        if (restoredEmployee) {
          setEmployeeSearch(
            `${restoredEmployee.full_name}${
              restoredEmployee.employee_code
                ? ` — ${restoredEmployee.employee_code}`
                : ""
            }`
          );
        }
      }

      if (restoredTemplateId) {
        setSelectedTemplateId(
          restoredTemplateId
        );
      }

      setDocument(savedData);
      setSavedDocumentId(savedRecord?.id || savedData?.id || "");
      setDocumentSaved(true);
      setSaveError("");
      setError("");
      restoredDocumentRef.current =
        true;
    } catch (err) {
      console.error(
        "Could not restore saved document:",
        err
      );

      /*
        Restoration must never prevent the generator
        itself from opening.
      */
    } finally {
      restoringDocumentRef.current =
        false;
    }
  }

  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(() => {
    loadEmployees();
    loadTemplates();
    loadLastSavedDocument();
  }, []);

  /* ==========================================================
     SELECTED EMPLOYEE
  ========================================================== */

  const selectedEmployee =
    useMemo(() => {
      return (
        employees.find(
          (employee) =>
            employee.id ===
            selectedEmployeeId
        ) || null
      );
    }, [
      employees,
      selectedEmployeeId,
    ]);

  /* ==========================================================
     SEARCHED EMPLOYEES
  ========================================================== */

  const filteredEmployees =
    useMemo(() => {
      const search =
        employeeSearch
          .trim()
          .toLowerCase();

      if (!search) {
        return employees;
      }

      return employees.filter(
        (employee) => {
          const name =
            employee.full_name ||
            "";

          const code =
            employee.employee_code ||
            "";

          const email =
            employee.email ||
            "";

          return (
            name
              .toLowerCase()
              .includes(search) ||
            code
              .toLowerCase()
              .includes(search) ||
            email
              .toLowerCase()
              .includes(search)
          );
        }
      );
    }, [
      employees,
      employeeSearch,
    ]);

  /* ==========================================================
     ACTIVE TEMPLATES
  ========================================================== */

  const activeTemplates =
    useMemo(() => {
      return templates.filter(
        (template) =>
          template.status ===
            "active" &&
          template.document_type ===
            documentType
      );
    }, [
      templates,
      documentType,
    ]);

  /* ==========================================================
     SELECTED TEMPLATE
  ========================================================== */

  const selectedTemplate =
    useMemo(() => {
      return (
        activeTemplates.find(
          (template) =>
            template.id ===
            selectedTemplateId
        ) || null
      );
    }, [
      activeTemplates,
      selectedTemplateId,
    ]);

  /* ==========================================================
     DOCUMENT TYPE CHANGE
  ========================================================== */

  const previousDocumentTypeRef =
    useRef(documentType);

  useEffect(() => {
    const typeActuallyChanged =
      previousDocumentTypeRef.current !==
      documentType;

    const defaultTemplate =
      activeTemplates.find(
        (template) =>
          template.is_default
      );

    /*
      When templates finish loading, select the
      organization's default template only if
      nothing has already been restored/selected.
    */
    if (
      !selectedTemplateId &&
      defaultTemplate?.id
    ) {
      setSelectedTemplateId(
        defaultTemplate.id
      );
    }

    /*
      Only clear the generated document when the
      user actually changes document type.
      Previously this effect also ran when templates
      loaded, which wiped the restored document.
    */
    if (typeActuallyChanged) {
      setDocument(null);
      setDocumentSaved(false);
      setSavedDocumentId("");
      setSendSuccess("");
      setSendError("");
      setSaveError("");
      setError("");
      setSelectedTemplateId(
        defaultTemplate?.id || ""
      );
      restoredDocumentRef.current =
        false;
    }

    previousDocumentTypeRef.current =
      documentType;
  }, [
    documentType,
    activeTemplates,
    selectedTemplateId,
  ]);

  /* ==========================================================
     GENERATE DOCUMENT
  ========================================================== */

  async function handleGenerate() {
    if (!selectedEmployeeId) {
      setError(
        "Please select an employee first."
      );

      return;
    }

    setGenerating(true);
    setError("");
    setSaveError("");
    setSendSuccess("");
    setSendError("");
    setSavedDocumentId("");
    setDocumentSaved(false);
    setDocument(null);

    try {
      const data =
        await documentService.generateDocument(
          documentType,
          selectedEmployeeId,
          selectedTemplateId ||
            null
        );

      setDocument(data);
    } catch (err) {
      console.error(
        "Document generation error:",
        err
      );

      setError(
        err?.response?.data
          ?.message ||
          `Couldn't generate the ${documentTypeLabel(
            documentType
          ).toLowerCase()}. Please try again.`
      );
    } finally {
      setGenerating(false);
    }
  }

  /* ==========================================================
     SAVE GENERATED DOCUMENT
  ========================================================== */

  async function handleSaveDocument() {
    if (!document) {
      setSaveError(
        "Generate a document before saving it."
      );

      return;
    }

    setSavingDocument(true);
    setSaveError("");

    try {
      const response =
        await documentService.saveGeneratedDocument(
          document
        );

      console.log(
        "Generated document saved:",
        response
      );

      const generatedId =
        response?.id ||
        response?.data?.id ||
        response?.document?.id ||
        "";

      setSavedDocumentId(generatedId);

      /*
        Keep the saved document available when the user
        navigates away and returns to this page.
        The backend remains the source of truth; this is
        only a frontend restoration fallback.
      */
      try {
        localStorage.setItem(
          "skillos:last-generated-document",
          JSON.stringify({
            saved_at:
              new Date().toISOString(),
            id: generatedId,
            document,
          })
        );
      } catch (storageError) {
        console.warn(
          "Could not cache saved document locally:",
          storageError
        );
      }

      restoredDocumentRef.current =
        true;

      setDocumentSaved(true);
    } catch (err) {
      console.error(
        "Document save error:",
        err
      );

      setSaveError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Couldn't save the document. Please try again."
      );
    } finally {
      setSavingDocument(false);
    }
  }

  /* ==========================================================
     SEND DOCUMENT TO EMPLOYEE
  ========================================================== */

  async function handleSendDocument() {
    if (!document) {
      setSendError("Generate a document before sending it.");
      return;
    }

    if (!documentSaved) {
      setSendError("Please save the document before sending it.");
      return;
    }

    const employeeEmail =
      document?.employee?.email ||
      selectedEmployee?.email ||
      "";

    if (!employeeEmail) {
      setSendError("This employee does not have an email address.");
      return;
    }

    if (!savedDocumentId) {
      setSendError(
        "The saved document ID is missing. Please save the document again."
      );
      return;
    }

    const confirmed = window.confirm(
      `Send this ${documentTypeLabel(
        documentType
      ).toLowerCase()} to ${employeeEmail}?`
    );

    if (!confirmed) {
      return;
    }

    setSendingDocument(true);
    setSendError("");
    setSendSuccess("");

    try {
      const { data } = await api.post(
        `/documents/generated/${savedDocumentId}/send`,
        {
          employee_email: employeeEmail,
        }
      );

      setSendSuccess(
        data?.message ||
          `Document sent successfully to ${employeeEmail}.`
      );
    } catch (err) {
      console.error(
        "Document send error:",
        err
      );

      setSendError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not send the document. Please try again."
      );
    } finally {
      setSendingDocument(false);
    }
  }

  /* ==========================================================
     TEMPLATE FORM HELPERS
  ========================================================== */

  function updateTemplateField(
    field,
    value
  ) {
    setTemplateForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function updateStyling(
    field,
    value
  ) {
    setTemplateForm(
      (current) => ({
        ...current,
        styling: {
          ...current.styling,
          [field]: value,
        },
      })
    );
  }

  /* ==========================================================
     RESET TEMPLATE FORM
  ========================================================== */

  function resetTemplateForm() {
    setEditingTemplateId(null);

    setTemplateForm({
      ...EMPTY_TEMPLATE,
      document_type:
        documentType,
      content:
        DEFAULT_CONTENTS[
          documentType
        ],
      styling: {
        ...DEFAULT_STYLING,
      },
    });

    setTemplateError("");
    setTemplateSuccess("");
  }

  /* ==========================================================
     CREATE TEMPLATE
  ========================================================== */

  function startCreateTemplate() {
    resetTemplateForm();

    setShowTemplateManager(
      true
    );

    setTemplateSuccess("");
  }

  /* ==========================================================
     EDIT TEMPLATE
  ========================================================== */

  function startEditTemplate(
    template
  ) {
    setEditingTemplateId(
      template.id
    );

    setTemplateForm({
      document_type:
        template.document_type ||
        documentType,

      template_name:
        template.template_name ||
        "",

      description:
        template.description ||
        "",

      content:
        template.content ||
        DEFAULT_CONTENTS[
          template.document_type ||
            documentType
        ],

      styling: {
        ...DEFAULT_STYLING,
        ...(template.styling ||
          {}),
      },

      logo_url:
        template.logo_url ||
        "",

      signature_url:
        template.signature_url ||
        "",

      signatory_name:
        template.signatory_name ||
        "",

      signatory_designation:
        template.signatory_designation ||
        "",

      status:
        template.status ||
        "draft",

      is_default:
        Boolean(
          template.is_default
        ),
    });

    setShowTemplateManager(
      true
    );

    setTemplateError("");
    setTemplateSuccess("");
  }

  /* ==========================================================
     DUPLICATE TEMPLATE
  ========================================================== */

  async function handleDuplicateTemplate(
    template
  ) {
    setTemplateError("");
    setTemplateSuccess("");

    try {
      const duplicate = {
        document_type:
          template.document_type,

        template_name:
          `${template.template_name} Copy`,

        description:
          template.description ||
          "",

        content:
          template.content ||
          DEFAULT_CONTENTS[
            template.document_type
          ],

        styling: {
          ...DEFAULT_STYLING,
          ...(template.styling ||
            {}),
        },

        logo_url:
          template.logo_url ||
          "",

        signature_url:
          template.signature_url ||
          "",

        signatory_name:
          template.signatory_name ||
          "",

        signatory_designation:
          template.signatory_designation ||
          "",

        status: "draft",

        is_default: false,
      };

      const created =
        await documentTemplateService.create(
          duplicate
        );

      await loadTemplates();

      if (created?.id) {
        setSelectedTemplateId(
          created.id
        );

        startEditTemplate(
          created
        );
      }

      setTemplateSuccess(
        "Template duplicated successfully."
      );
    } catch (err) {
      console.error(
        "Template duplication error:",
        err
      );

      setTemplateError(
        err?.response?.data
          ?.message ||
          "Couldn't duplicate the template."
      );
    }
  }

  /* ==========================================================
     DELETE TEMPLATE
  ========================================================== */

  async function handleDeleteTemplate(
    template
  ) {
    const confirmed =
      window.confirm(
        `Delete "${template.template_name}"? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setTemplateError("");
    setTemplateSuccess("");

    try {
      await documentTemplateService.remove(
        template.id
      );

      if (
        selectedTemplateId ===
        template.id
      ) {
        setSelectedTemplateId("");
      }

      if (
        editingTemplateId ===
        template.id
      ) {
        resetTemplateForm();
      }

      await loadTemplates();

      setTemplateSuccess(
        "Template deleted successfully."
      );
    } catch (err) {
      console.error(
        "Template deletion error:",
        err
      );

      setTemplateError(
        err?.response?.data
          ?.message ||
          "Couldn't delete the template."
      );
    }
  }

  /* ==========================================================
     SAVE TEMPLATE
  ========================================================== */

  async function handleSaveTemplate(
    event
  ) {
    event.preventDefault();

    setSavingTemplate(true);
    setTemplateError("");
    setTemplateSuccess("");

    try {
      if (
        !templateForm.template_name.trim()
      ) {
        throw new Error(
          "Template name is required."
        );
      }

      if (
        !templateForm.content.trim()
      ) {
        throw new Error(
          "Template content is required."
        );
      }

      const payload = {
        ...templateForm,

        document_type:
          templateForm.document_type ||
          documentType,

        styling: {
          ...DEFAULT_STYLING,
          ...(templateForm.styling ||
            {}),
        },
      };

      let savedTemplate;

      if (editingTemplateId) {
        savedTemplate =
          await documentTemplateService.update(
            editingTemplateId,
            payload
          );
      } else {
        savedTemplate =
          await documentTemplateService.create(
            payload
          );
      }

      await loadTemplates();

      if (savedTemplate?.id) {
        setSelectedTemplateId(
          savedTemplate.id
        );

        setEditingTemplateId(
          savedTemplate.id
        );
      }

      setTemplateSuccess(
        "Template saved successfully."
      );
    } catch (err) {
      console.error(
        "Template save error:",
        err
      );

      setTemplateError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Couldn't save the template."
      );
    } finally {
      setSavingTemplate(false);
    }
  }

  /* ==========================================================
     INSERT DYNAMIC FIELD
  ========================================================== */

  function insertField(field) {
    setTemplateForm(
      (current) => ({
        ...current,
        content:
          `${current.content}${
            current.content.endsWith(
              "\n"
            )
              ? ""
              : "\n"
          }${field}`,
      })
    );
  }

  /* ==========================================================
     FORMATTERS
  ========================================================== */

  function formatGeneratedDate(
    value
  ) {
    if (!value) {
      return "—";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );
  }

  function documentTypeLabel(
    type
  ) {
    return (
      DOCUMENT_TYPES.find(
        (item) =>
          item.value === type
      )?.label || type
    );
  }

  /* ==========================================================
     RENDER TEMPLATE CONTENT
  ========================================================== */

  function renderTemplatePreview(
    content
  ) {
    if (!content) {
      return "";
    }

    const employee =
      selectedEmployee || {};

    const replacements = {
      employee_name:
        employee.full_name ||
        "Karan Mehta",

      employee_code:
        employee.employee_code ||
        "EMP007",

      employee_email:
        employee.email ||
        "employee@example.com",

      department:
        employee.department ||
        "Human Resources",

      job_title:
        employee.title ||
        "Employee",

      joining_date:
        formatDate(
          employee.joining_date
        ) ||
        "01 September 2026",

      last_working_date:
        formatDate(
          employee.last_working_date
        ) ||
        "—",

      employment_status:
        employee.employment_status ||
        "Active",

      employment_duration:
        employee.employment_duration ||
        "—",

      employee_address:
        employee.address ||
        "Employee Address",

      organization_name:
        "Your Organization",

      organization_industry:
        "Technology",

      letter_date:
        formatDate(
          new Date()
        ),

      signatory_name:
        templateForm.signatory_name ||
        "Authorized Signatory",

      signatory_designation:
        templateForm.signatory_designation ||
        "Human Resources",
    };

    return content.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (match, key) =>
        replacements[key] !==
        undefined
          ? replacements[key]
          : match
    );
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="min-w-0">

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="mb-6">
        <Link
          to="/app/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">

            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <FileText
                className="h-6 w-6"
                strokeWidth={1.75}
              />
            </span>

            <div>
              <h1 className="font-display text-2xl font-semibold text-ink-950">
                Document & Letter Generator
              </h1>

              <p className="mt-1 text-sm text-ink-500">
                Generate professional HR
                documents using employee
                information and your
                organization's own document
                formats.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (
                showTemplateManager
              ) {
                resetTemplateForm();
              }

              setShowTemplateManager(
                (current) =>
                  !current
              );
            }}
            className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            {showTemplateManager ? (
              <>
                <X className="h-4 w-4" />
                Close template manager
              </>
            ) : (
              <>
                <Palette className="h-4 w-4" />
                Customize templates
              </>
            )}
          </button>
        </div>
      </div>

      {/* ======================================================
          TEMPLATE MANAGER
      ====================================================== */}

      {showTemplateManager && (
        <div className="mb-6 space-y-6">

          <div className="card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h2 className="text-base font-semibold text-ink-900">
                  Organization document templates
                </h2>

                <p className="mt-1 text-sm text-ink-500">
                  Create customized formats
                  for each HR document type.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  startCreateTemplate
                }
                className="flex items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
              >
                <Plus className="h-4 w-4" />
                Create template
              </button>

            </div>
          </div>

          {(editingTemplateId ||
            templateForm.template_name) && (
            <form
              onSubmit={
                handleSaveTemplate
              }
              className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]"
            >

              {/* =================================================
                  TEMPLATE EDITOR
              ================================================= */}

              <div className="card min-w-0 overflow-hidden">

                <div className="border-b border-ink-100 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">

                    <div>
                      <h3 className="text-base font-semibold text-ink-900">
                        {editingTemplateId
                          ? "Edit template"
                          : "Create template"}
                      </h3>

                      <p className="mt-1 text-xs text-ink-400">
                        Customize content,
                        branding, formatting,
                        and signatory details.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        resetTemplateForm
                      }
                      className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                    >
                      <X className="h-4 w-4" />
                    </button>

                  </div>
                </div>

                <div className="space-y-6 p-5">

                  {/* BASIC INFORMATION */}

                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-brand-700" />

                      <h4 className="text-sm font-semibold text-ink-900">
                        Basic information
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-ink-700">
                          Template name
                        </label>

                        <input
                          value={
                            templateForm.template_name
                          }
                          onChange={(e) =>
                            updateTemplateField(
                              "template_name",
                              e.target.value
                            )
                          }
                          placeholder="Acme Standard Experience Letter"
                          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-ink-700">
                          Document type
                        </label>

                        <select
                          value={
                            templateForm.document_type
                          }
                          onChange={(e) =>
                            setTemplateForm(
                              (current) => ({
                                ...current,
                                document_type:
                                  e.target.value,
                                content:
                                  DEFAULT_CONTENTS[
                                    e.target.value
                                  ],
                              })
                            )
                          }
                          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                        >
                          {DOCUMENT_TYPES.map(
                            (type) => (
                              <option
                                key={
                                  type.value
                                }
                                value={
                                  type.value
                                }
                              >
                                {type.label}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-ink-700">
                          Description
                        </label>

                        <input
                          value={
                            templateForm.description
                          }
                          onChange={(e) =>
                            updateTemplateField(
                              "description",
                              e.target.value
                            )
                          }
                          placeholder="Describe when this format should be used"
                          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                        />
                      </div>

                    </div>
                  </section>

                  {/* BRANDING */}

                  <section className="border-t border-ink-100 pt-6">

                    <div className="mb-4 flex items-center gap-2">
                      <Image className="h-4 w-4 text-brand-700" />

                      <h4 className="text-sm font-semibold text-ink-900">
                        Organization branding
                      </h4>
                    </div>

                    <div className="space-y-4">

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-ink-700">
                          Logo URL
                        </label>

                        <input
                          value={
                            templateForm.logo_url
                          }
                          onChange={(e) =>
                            updateTemplateField(
                              "logo_url",
                              e.target.value
                            )
                          }
                          placeholder="https://..."
                          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-ink-700">
                            Logo position
                          </label>

                          <select
                            value={
                              templateForm
                                .styling
                                .logoPosition
                            }
                            onChange={(e) =>
                              updateStyling(
                                "logoPosition",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
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
                                templateForm
                                  .styling
                                  .primaryColor
                              }
                              onChange={(e) =>
                                updateStyling(
                                  "primaryColor",
                                  e.target.value
                                )
                              }
                              className="h-10 w-12 cursor-pointer rounded-lg border border-ink-200"
                            />

                            <input
                              value={
                                templateForm
                                  .styling
                                  .primaryColor
                              }
                              onChange={(e) =>
                                updateStyling(
                                  "primaryColor",
                                  e.target.value
                                )
                              }
                              className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
                            />

                          </div>
                        </div>

                      </div>

                    </div>
                  </section>

                  {/* FORMATTING */}

                  <section className="border-t border-ink-100 pt-6">

                    <div className="mb-4 flex items-center gap-2">
                      <Type className="h-4 w-4 text-brand-700" />

                      <h4 className="text-sm font-semibold text-ink-900">
                        Document formatting
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-ink-700">
                          Font
                        </label>

                        <select
                          value={
                            templateForm
                              .styling
                              .fontFamily
                          }
                          onChange={(e) =>
                            updateStyling(
                              "fontFamily",
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
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
                          <option value="Verdana">
                            Verdana
                          </option>
                          <option value="Inter">
                            Inter
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-ink-700">
                          Font size
                        </label>

                        <select
                          value={
                            templateForm
                              .styling
                              .fontSize
                          }
                          onChange={(e) =>
                            updateStyling(
                              "fontSize",
                              Number(
                                e.target.value
                              )
                            )
                          }
                          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                        >
                          {[10, 11, 12, 13, 14].map(
                            (size) => (
                              <option
                                key={size}
                                value={size}
                              >
                                {size}px
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <label className="flex items-center gap-3 rounded-lg border border-ink-100 p-3">
                        <input
                          type="checkbox"
                          checked={
                            templateForm
                              .styling
                              .headerEnabled
                          }
                          onChange={(e) =>
                            updateStyling(
                              "headerEnabled",
                              e.target.checked
                            )
                          }
                        />

                        <span className="text-sm font-medium text-ink-800">
                          Show header
                        </span>
                      </label>

                      <label className="flex items-center gap-3 rounded-lg border border-ink-100 p-3">
                        <input
                          type="checkbox"
                          checked={
                            templateForm
                              .styling
                              .footerEnabled
                          }
                          onChange={(e) =>
                            updateStyling(
                              "footerEnabled",
                              e.target.checked
                            )
                          }
                        />

                        <span className="text-sm font-medium text-ink-800">
                          Show footer
                        </span>
                      </label>

                      <label className="flex items-center gap-3 rounded-lg border border-ink-100 p-3 sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={
                            templateForm
                              .styling
                              .showDivider
                          }
                          onChange={(e) =>
                            updateStyling(
                              "showDivider",
                              e.target.checked
                            )
                          }
                        />

                        <span className="text-sm font-medium text-ink-800">
                          Show header divider
                        </span>
                      </label>

                    </div>
                  </section>

                  {/* CONTENT */}

                  <section className="border-t border-ink-100 pt-6">

                    <div className="mb-4 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-brand-700" />

                      <h4 className="text-sm font-semibold text-ink-900">
                        Letter content
                      </h4>
                    </div>

                    <textarea
                      value={
                        templateForm.content
                      }
                      onChange={(e) =>
                        updateTemplateField(
                          "content",
                          e.target.value
                        )
                      }
                      rows={18}
                      className="w-full resize-y rounded-lg border border-ink-200 px-3 py-3 font-mono text-sm leading-6 text-ink-800 outline-none focus:border-brand-500"
                    />

                    <div className="mt-4 space-y-3">

                      {DYNAMIC_FIELDS.map(
                        (group) => (
                          <div
                            key={
                              group.group
                            }
                            className="rounded-lg border border-ink-100 bg-canvas p-3"
                          >

                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                              {group.group}
                            </p>

                            <div className="flex flex-wrap gap-2">

                              {group.fields.map(
                                ([
                                  field,
                                  label,
                                ]) => (
                                  <button
                                    key={
                                      field
                                    }
                                    type="button"
                                    onClick={() =>
                                      insertField(
                                        field
                                      )
                                    }
                                    className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-300 hover:bg-brand-50"
                                  >
                                    {label}
                                  </button>
                                )
                              )}

                            </div>
                          </div>
                        )
                      )}

                    </div>
                  </section>

                  {/* SIGNATORY */}

                  <section className="border-t border-ink-100 pt-6">

                    <div className="mb-4 flex items-center gap-2">
                      <UserPen className="h-4 w-4 text-brand-700" />

                      <h4 className="text-sm font-semibold text-ink-900">
                        Authorized signatory
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-ink-700">
                          Signatory name
                        </label>

                        <input
                          value={
                            templateForm
                              .signatory_name
                          }
                          onChange={(e) =>
                            updateTemplateField(
                              "signatory_name",
                              e.target.value
                            )
                          }
                          placeholder="Head of Human Resources"
                          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-ink-700">
                          Designation
                        </label>

                        <input
                          value={
                            templateForm
                              .signatory_designation
                          }
                          onChange={(e) =>
                            updateTemplateField(
                              "signatory_designation",
                              e.target.value
                            )
                          }
                          placeholder="Human Resources"
                          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-ink-700">
                          Signature image URL
                        </label>

                        <input
                          value={
                            templateForm
                              .signature_url
                          }
                          onChange={(e) =>
                            updateTemplateField(
                              "signature_url",
                              e.target.value
                            )
                          }
                          placeholder="https://..."
                          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                        />
                      </div>

                    </div>
                  </section>

                  {/* PUBLISHING */}

                  <section className="border-t border-ink-100 pt-6">

                    <div className="mb-4 flex items-center gap-2">
                      <Check className="h-4 w-4 text-brand-700" />

                      <h4 className="text-sm font-semibold text-ink-900">
                        Publishing
                      </h4>
                    </div>

                    <div className="space-y-4">

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-ink-700">
                          Status
                        </label>

                        <select
                          value={
                            templateForm.status
                          }
                          onChange={(e) =>
                            updateTemplateField(
                              "status",
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="draft">
                            Draft
                          </option>
                          <option value="active">
                            Active
                          </option>
                          <option value="archived">
                            Archived
                          </option>
                        </select>
                      </div>

                      <label className="flex items-start gap-3 rounded-lg border border-ink-100 p-3">

                        <input
                          type="checkbox"
                          checked={
                            templateForm.is_default
                          }
                          disabled={
                            templateForm.status !==
                            "active"
                          }
                          onChange={(e) =>
                            updateTemplateField(
                              "is_default",
                              e.target.checked
                            )
                          }
                        />

                        <span className="text-sm font-medium text-ink-800">
                          Set as default template
                        </span>

                      </label>

                    </div>
                  </section>

                  {/* TEMPLATE ERROR */}

                  {templateError && (
                    <div className="rounded-lg bg-amber-soft px-3 py-2 text-sm text-ink-800">
                      {templateError}
                    </div>
                  )}

                  {templateSuccess && (
                    <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
                      {templateSuccess}
                    </div>
                  )}

                  {/* TEMPLATE SAVE */}

                  <div className="flex flex-col gap-3 border-t border-ink-100 pt-5 sm:flex-row sm:justify-end">

                    <button
                      type="button"
                      onClick={
                        resetTemplateForm
                      }
                      className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={
                        savingTemplate
                      }
                      className="flex items-center justify-center gap-2 rounded-lg bg-brand-800 px-5 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
                    >
                      {savingTemplate ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save template
                        </>
                      )}
                    </button>

                  </div>

                </div>
              </div>

              {/* =================================================
                  TEMPLATE LIVE PREVIEW
              ================================================= */}

              <div className="card min-w-0 overflow-hidden">

                <div className="border-b border-ink-100 px-5 py-4">

                  <h3 className="text-base font-semibold text-ink-900">
                    Template preview
                  </h3>

                  <p className="mt-1 text-xs text-ink-400">
                    Preview the organization
                    format before saving.
                  </p>

                </div>

                <div className="overflow-auto bg-canvas p-4">

                  <div
                    className="mx-auto min-h-[650px] w-full max-w-2xl bg-white p-6 shadow-sm sm:p-8"
                    style={{
                      fontFamily:
                        templateForm
                          .styling
                          .fontFamily,

                      fontSize:
                        `${templateForm.styling.fontSize}px`,
                    }}
                  >

                    {templateForm
                      .styling
                      .headerEnabled && (
                      <div
                        className={`pb-5 ${
                          templateForm
                            .styling
                            .logoPosition ===
                          "left"
                            ? "text-left"
                            : templateForm
                                .styling
                                .logoPosition ===
                              "right"
                              ? "text-right"
                              : "text-center"
                        }`}
                        style={{
                          borderBottom:
                            templateForm
                              .styling
                              .showDivider
                              ? `2px solid ${templateForm.styling.primaryColor}`
                              : "none",
                        }}
                      >

                        {templateForm.logo_url && (
                          <img
                            src={
                              templateForm.logo_url
                            }
                            alt="Organization logo"
                            className="mx-auto mb-3 max-h-14 max-w-[180px] object-contain"
                          />
                        )}

                        <h4
                          className="font-semibold"
                          style={{
                            color:
                              templateForm
                                .styling
                                .primaryColor,
                          }}
                        >
                          Your Organization
                        </h4>

                      </div>
                    )}

                    <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-ink-700">
                      {renderTemplatePreview(
                        templateForm.content
                      )}
                    </div>

                    {templateForm.signature_url && (
                      <img
                        src={
                          templateForm.signature_url
                        }
                        alt="Signature"
                        className="mt-8 max-h-16 max-w-[180px] object-contain"
                      />
                    )}

                    {templateForm
                      .styling
                      .footerEnabled && (
                      <div
                        className="mt-10 border-t pt-4 text-center text-xs"
                        style={{
                          borderColor:
                            templateForm
                              .styling
                              .primaryColor,

                          color:
                            templateForm
                              .styling
                              .primaryColor,
                        }}
                      >
                        Confidential HR Document
                      </div>
                    )}

                  </div>
                </div>
              </div>

            </form>
          )}

          {/* ====================================================
              EXISTING TEMPLATES
          ==================================================== */}

          <div className="card overflow-hidden">

            <div className="border-b border-ink-100 px-5 py-4">

              <div className="flex items-center justify-between">

                <div>
                  <h3 className="text-base font-semibold text-ink-900">
                    Your templates
                  </h3>

                  <p className="mt-1 text-xs text-ink-400">
                    Manage the formats your
                    organization uses.
                  </p>
                </div>

                {loadingTemplates && (
                  <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
                )}

              </div>
            </div>

            {!loadingTemplates &&
            templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-14 text-center">

                <FileText className="h-8 w-8 text-ink-300" />

                <p className="mt-3 text-sm font-medium text-ink-700">
                  No templates yet
                </p>

                <button
                  type="button"
                  onClick={
                    startCreateTemplate
                  }
                  className="mt-4 flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white"
                >
                  <Plus className="h-4 w-4" />
                  Create template
                </button>

              </div>
            ) : (
              <div className="divide-y divide-ink-100">

                {templates.map(
                  (template) => (
                    <div
                      key={
                        template.id
                      }
                      className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                    >

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <h4 className="text-sm font-semibold text-ink-900">
                            {
                              template.template_name
                            }
                          </h4>

                          <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-500">
                            {documentTypeLabel(
                              template.document_type
                            )}
                          </span>

                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                            {
                              template.status
                            }
                          </span>

                          {template.is_default && (
                            <span className="rounded-full bg-brand-800 px-2 py-0.5 text-xs text-white">
                              Default
                            </span>
                          )}

                        </div>

                        {template.description && (
                          <p className="mt-1 text-sm text-ink-500">
                            {
                              template.description
                            }
                          </p>
                        )}

                      </div>

                      <div className="flex flex-wrap gap-2">

                        <button
                          type="button"
                          onClick={() =>
                            startEditTemplate(
                              template
                            )
                          }
                          className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDuplicateTemplate(
                              template
                            )
                          }
                          className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Duplicate
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteTemplate(
                              template
                            )
                          }
                          className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
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

            {templateError &&
              !editingTemplateId && (
                <div className="border-t border-ink-100 bg-amber-soft px-5 py-3 text-sm text-ink-800">
                  {templateError}
                </div>
              )}

            {templateSuccess &&
              !editingTemplateId && (
                <div className="border-t border-ink-100 bg-brand-50 px-5 py-3 text-sm text-brand-800">
                  {templateSuccess}
                </div>
              )}

          </div>
        </div>
      )}

      {/* ======================================================
          GENERATOR
      ====================================================== */}

      <div className="card mb-6 p-5">

        <div className="mb-5">

          <h2 className="text-base font-semibold text-ink-900">
            Generate document
          </h2>

          <p className="mt-1 text-sm text-ink-500">
            Select the document type,
            employee, and organization
            format.
          </p>

        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">

          {/* DOCUMENT TYPE */}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">
              Document type
            </label>

            <select
              value={documentType}
              onChange={(e) =>
                setDocumentType(
                  e.target.value
                )
              }
              className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-brand-500"
            >
              {DOCUMENT_TYPES.map(
                (type) => (
                  <option
                    key={
                      type.value
                    }
                    value={
                      type.value
                    }
                  >
                    {type.label}
                  </option>
                )
              )}
            </select>
          </div>

          {/* EMPLOYEE SEARCH */}

          <div>

            <label className="mb-1.5 block text-sm font-medium text-ink-700">
              Employee
            </label>

            <div className="relative">

              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

              <input
                value={
                  employeeSearch
                }
                onChange={(e) => {
                  setEmployeeSearch(
                    e.target.value
                  );
                  setSelectedEmployeeId(
                    ""
                  );
                  setDocument(null);
                  setDocumentSaved(
                    false
                  );
                }}
                placeholder="Search name or employee ID..."
                className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-500"
              />

            </div>

            {employeeSearch && (
              <div className="relative">

                <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-ink-200 bg-white shadow-lg">

                  {filteredEmployees.length ===
                  0 ? (
                    <div className="px-3 py-3 text-sm text-ink-500">
                      No employee found.
                    </div>
                  ) : (
                    filteredEmployees.map(
                      (employee) => (
                        <button
                          key={
                            employee.id
                          }
                          type="button"
                          onClick={() => {
                            setSelectedEmployeeId(
                              employee.id
                            );

                            setEmployeeSearch(
                              `${employee.full_name}${
                                employee.employee_code
                                  ? ` — ${employee.employee_code}`
                                  : ""
                              }`
                            );

                            setDocument(
                              null
                            );

                            setDocumentSaved(
                              false
                            );

                            setError("");
                          }}
                          className="block w-full px-3 py-2 text-left hover:bg-brand-50"
                        >

                          <p className="text-sm font-medium text-ink-900">
                            {
                              employee.full_name
                            }
                          </p>

                          <p className="text-xs text-ink-500">
                            {
                              employee.employee_code ||
                              "No employee ID"
                            }

                            {employee.department
                              ? ` · ${employee.department}`
                              : ""}
                          </p>

                        </button>
                      )
                    )
                  )}

                </div>
              </div>
            )}

            {selectedEmployee && (
              <div className="mt-2 flex items-center gap-2 text-xs text-brand-700">
                <Check className="h-3.5 w-3.5" />

                <span>
                  Selected:{" "}
                  <strong>
                    {
                      selectedEmployee.full_name
                    }
                  </strong>
                </span>
              </div>
            )}

          </div>

          {/* TEMPLATE */}

          <div>

            <label className="mb-1.5 block text-sm font-medium text-ink-700">
              Organization template
            </label>

            <select
              value={
                selectedTemplateId
              }
              onChange={(e) => {
                setSelectedTemplateId(
                  e.target.value
                );

                setDocument(
                  null
                );

                setDocumentSaved(
                  false
                );
              }}
              className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-brand-500"
            >

              <option value="">
                Default system format
              </option>

              {activeTemplates.map(
                (template) => (
                  <option
                    key={
                      template.id
                    }
                    value={
                      template.id
                    }
                  >
                    {
                      template.template_name
                    }
                    {template.is_default
                      ? " — Default"
                      : ""}
                  </option>
                )
              )}

            </select>

          </div>

          {/* GENERATE */}

          <button
            type="button"
            onClick={
              handleGenerate
            }
            disabled={
              generating ||
              loadingEmployees ||
              !selectedEmployeeId
            }
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-800 px-5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
          >

            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Generate document
              </>
            )}

          </button>

        </div>

        {selectedTemplate && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">

            <Check className="mt-0.5 h-4 w-4 shrink-0" />

            <span>
              Using organization
              template:{" "}
              <strong>
                {
                  selectedTemplate.template_name
                }
              </strong>
            </span>

          </div>
        )}

        {!loadingTemplates &&
          activeTemplates.length ===
            0 && (
            <div className="mt-4 rounded-lg bg-amber-soft px-3 py-2 text-sm text-ink-700">
              No active organization
              template exists for{" "}
              <strong>
                {documentTypeLabel(
                  documentType
                )}
              </strong>
              . The system format
              will be used.
            </div>
          )}

        {error && (
          <div className="mt-4 rounded-lg bg-amber-soft px-3 py-2 text-sm text-ink-800">
            {error}
          </div>
        )}

      </div>

      {/* ======================================================
          SELECTED EMPLOYEE SUMMARY
      ====================================================== */}

      {selectedEmployee && (
        <div className="card mb-6 overflow-hidden">

          <div className="border-b border-ink-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-ink-900">
              Selected employee
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 bg-canvas p-5 sm:grid-cols-2 lg:grid-cols-4">

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Employee
              </p>

              <p className="mt-1 text-sm font-medium text-ink-900">
                {
                  selectedEmployee.full_name
                }
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Employee ID
              </p>

              <p className="mt-1 text-sm font-medium text-ink-900">
                {
                  selectedEmployee.employee_code ||
                  "—"
                }
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Department
              </p>

              <p className="mt-1 text-sm font-medium text-ink-900">
                {
                  selectedEmployee.department ||
                  "—"
                }
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Position
              </p>

              <p className="mt-1 text-sm font-medium text-ink-900">
                {
                  selectedEmployee.title ||
                  "—"
                }
              </p>
            </div>

          </div>

        </div>
      )}

      {/* ======================================================
          DOCUMENT PREVIEW
      ====================================================== */}

      {document && (
        <div className="card overflow-hidden">

          {/* ==================================================
              PREVIEW HEADER
          ================================================== */}

          <div className="flex flex-col gap-4 border-b border-ink-100 p-5 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <div className="flex items-center gap-2">

                <FileText className="h-5 w-5 text-brand-700" />

                <h2 className="text-base font-semibold text-ink-900">
                  {documentTypeLabel(
                    document.type ||
                      documentType
                  )}{" "}
                  Preview
                </h2>

              </div>

              <p className="mt-1 text-xs text-ink-400">
                Generated{" "}
                {formatGeneratedDate(
                  document.generated_at
                )}
              </p>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              <span className="inline-flex w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                {document.source ===
                "organization_template"
                  ? "Organization template"
                  : "System format"}
              </span>

              {/* ==================================================
                  SAVE BUTTON
              ================================================== */}

              <button
                type="button"
                onClick={
                  handleSaveDocument
                }
                disabled={
                  savingDocument ||
                  documentSaved
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
              >

                {savingDocument ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : documentSaved ? (
                  <>
                    <Check className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save document
                  </>
                )}

              </button>

              {/* ==================================================
                  SEND TO EMPLOYEE
              ================================================== */}

              <button
                type="button"
                onClick={handleSendDocument}
                disabled={
                  sendingDocument ||
                  !documentSaved
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingDocument ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send to Employee
                  </>
                )}
              </button>

            </div>
          </div>

          {sendError && (
            <div className="border-b border-ink-100 bg-amber-soft px-5 py-3 text-sm text-ink-800">
              {sendError}
            </div>
          )}

          {sendSuccess && (
            <div className="border-b border-ink-100 bg-brand-50 px-5 py-3 text-sm text-brand-800">
              {sendSuccess}
            </div>
          )}

          {/* ==================================================
              SAVE STATUS
          ================================================== */}

          {saveError && (
            <div className="border-b border-ink-100 bg-amber-soft px-5 py-3 text-sm text-ink-800">
              {saveError}
            </div>
          )}

          {documentSaved && (
            <div className="border-b border-ink-100 bg-brand-50 px-5 py-3 text-sm text-brand-800">
              Document saved successfully.
              It is now stored in your
              organization's generated
              document records.
            </div>
          )}

          {/* ==================================================
              EMPLOYEE SUMMARY
          ================================================== */}

          <div className="grid grid-cols-1 gap-4 border-b border-ink-100 bg-canvas p-5 sm:grid-cols-2 lg:grid-cols-4">

            <div className="flex items-start gap-3">

              <User className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />

              <div className="min-w-0">

                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  Employee
                </p>

                <p className="mt-1 truncate text-sm font-medium text-ink-900">
                  {
                    document.employee
                      ?.full_name ||
                    "—"
                  }
                </p>

              </div>
            </div>

            <div className="flex items-start gap-3">

              <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />

              <div className="min-w-0">

                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  Position
                </p>

                <p className="mt-1 truncate text-sm font-medium text-ink-900">
                  {
                    document.employee
                      ?.title ||
                    "—"
                  }
                </p>

              </div>
            </div>

            <div className="flex items-start gap-3">

              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />

              <div className="min-w-0">

                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  Department
                </p>

                <p className="mt-1 truncate text-sm font-medium text-ink-900">
                  {
                    document.employee
                      ?.department ||
                    "—"
                  }
                </p>

              </div>
            </div>

            <div className="flex items-start gap-3">

              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />

              <div className="min-w-0">

                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  Joining date
                </p>

                <p className="mt-1 truncate text-sm font-medium text-ink-900">
                  {
                    document.employee
                      ?.joining_date_formatted ||
                    "—"
                  }
                </p>

              </div>
            </div>

          </div>

          {/* ==================================================
              ACTUAL DOCUMENT
          ================================================== */}

          <div className="p-4 sm:p-8">

            <article className="mx-auto max-w-3xl rounded-lg border border-ink-100 bg-white p-6 shadow-sm sm:p-10">

              {/* ORGANIZATION HEADER */}

              {document.template
                ?.styling
                ?.headerEnabled !==
                false && (
                <div
                  className={`pb-6 ${
                    document.template
                      ?.styling
                      ?.logoPosition ===
                    "left"
                      ? "text-left"
                      : document.template
                          ?.styling
                          ?.logoPosition ===
                        "right"
                        ? "text-right"
                        : "text-center"
                  }`}
                  style={{
                    borderBottom:
                      document.template
                        ?.styling
                        ?.showDivider !==
                      false
                        ? `2px solid ${
                            document
                              .template
                              ?.styling
                              ?.primaryColor ||
                            "#155e5a"
                          }`
                        : "none",
                  }}
                >

                  {document.template
                    ?.logo_url && (
                    <img
                      src={
                        document
                          .template
                          .logo_url
                      }
                      alt="Organization logo"
                      className="mx-auto mb-3 max-h-16 max-w-[200px] object-contain"
                    />
                  )}

                  <h3
                    className="font-display text-xl font-semibold"
                    style={{
                      color:
                        document
                          .template
                          ?.styling
                          ?.primaryColor ||
                        "#155e5a",
                    }}
                  >
                    {
                      document.organization
                        ?.name
                    }
                  </h3>

                  {document.organization
                    ?.industry && (
                    <p className="mt-1 text-sm text-ink-500">
                      {
                        document
                          .organization
                          .industry
                      }
                    </p>
                  )}

                </div>
              )}

              {/* DATE */}

              {document.content
                ?.date && (
                <div className="mt-8">
                  <p className="text-sm text-ink-700">
                    Date:{" "}
                    <span className="font-medium">
                      {
                        document
                          .content
                          .date
                      }
                    </span>
                  </p>
                </div>
              )}

              {/* RECIPIENT */}

              <div className="mt-8">

                {document.content
                  ?.greeting && (
                  <p className="text-sm font-medium text-ink-900">
                    {
                      document
                        .content
                        .greeting
                    }
                  </p>
                )}

                {!document.content
                  ?.greeting &&
                  document.content
                    ?.recipient_name && (
                    <p className="text-sm font-semibold text-ink-900">
                      {
                        document
                          .content
                          .recipient_name
                      }
                    </p>
                  )}

                {document.content
                  ?.recipient_address && (
                  <div className="mt-2 flex items-start gap-1.5 text-sm text-ink-600">

                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                    <span>
                      {
                        document
                          .content
                          .recipient_address
                      }
                    </span>

                  </div>
                )}

              </div>

              {/* SUBJECT */}

              {document.content
                ?.subject && (
                <div className="mt-8">

                  <p className="text-sm font-semibold text-ink-900">
                    Subject:{" "}
                    {
                      document
                        .content
                        .subject
                    }
                  </p>

                </div>
              )}

              {/* BODY */}

              <div className="mt-8 space-y-5 text-sm leading-7 text-ink-700">

                {document.content
                  ?.rendered_content ? (
                  <div className="whitespace-pre-wrap">
                    {
                      document
                        .content
                        .rendered_content
                    }
                  </div>
                ) : (
                  <>
                    {document.content
                      ?.introduction && (
                      <p>
                        {
                          document
                            .content
                            .introduction
                        }
                      </p>
                    )}

                    {document.content
                      ?.joining_statement && (
                      <p>
                        {
                          document
                            .content
                            .joining_statement
                        }
                      </p>
                    )}

                    {document.content
                      ?.employment_period && (
                      <p>
                        {
                          document
                            .content
                            .employment_period
                        }
                      </p>
                    )}

                    {document.content
                      ?.duration && (
                      <p>
                        {
                          document
                            .content
                            .duration
                        }
                      </p>
                    )}

                    {document.content
                      ?.verification_statement && (
                      <p>
                        {
                          document
                            .content
                            .verification_statement
                        }
                      </p>
                    )}

                    {document.content
                      ?.position_statement && (
                      <p>
                        {
                          document
                            .content
                            .position_statement
                        }
                      </p>
                    )}

                    {document.content
                      ?.employment_status_statement && (
                      <p>
                        {
                          document
                            .content
                            .employment_status_statement
                        }
                      </p>
                    )}

                    {document.content
                      ?.last_working_statement && (
                      <p>
                        {
                          document
                            .content
                            .last_working_statement
                        }
                      </p>
                    )}

                    {document.content
                      ?.employee_statement && (
                      <p>
                        {
                          document
                            .content
                            .employee_statement
                        }
                      </p>
                    )}

                    {document.content
                      ?.employment_statement && (
                      <p>
                        {
                          document
                            .content
                            .employment_statement
                        }
                      </p>
                    )}

                    {document.content
                      ?.address_statement && (
                      <p>
                        {
                          document
                            .content
                            .address_statement
                        }
                      </p>
                    )}

                    {document.content
                      ?.employee_identification && (
                      <p>
                        {
                          document
                            .content
                            .employee_identification
                        }
                      </p>
                    )}

                    {document.content
                      ?.responsibilities && (
                      <p>
                        {
                          document
                            .content
                            .responsibilities
                        }
                      </p>
                    )}

                    {document.content
                      ?.conduct && (
                      <p>
                        {
                          document
                            .content
                            .conduct
                        }
                      </p>
                    )}

                    {document.content
                      ?.closing && (
                      <p>
                        {
                          document
                            .content
                            .closing
                        }
                      </p>
                    )}

                    {document.content
                      ?.body && (
                      <div className="whitespace-pre-wrap">
                        {
                          document
                            .content
                            .body
                        }
                      </div>
                    )}
                  </>
                )}

              </div>

              {/* SIGNATURE */}

              <div className="mt-12">

                <p className="text-sm text-ink-700">
                  Sincerely,
                </p>

                {document.template
                  ?.signature_url && (
                  <img
                    src={
                      document
                        .template
                        .signature_url
                    }
                    alt="Authorized signature"
                    className="mt-5 max-h-16 max-w-[180px] object-contain"
                  />
                )}

                <div className="mt-4">

                  {!document.template
                    ?.signature_url && (
                    <div className="h-px w-40 bg-ink-300" />
                  )}

                  <p className="mt-2 text-sm font-semibold text-ink-900">
                    {
                      document
                        .content
                        ?.signatory_name ||
                      document
                        .template
                        ?.signatory_name ||
                      "Authorized Signatory"
                    }
                  </p>

                  <p className="mt-0.5 text-sm text-ink-500">
                    {
                      document
                        .content
                        ?.signatory_designation ||
                      document
                        .template
                        ?.signatory_designation ||
                      document
                        .organization
                        ?.name
                    }
                  </p>

                </div>
              </div>

              {/* FOOTER */}

              {document.template
                ?.styling
                ?.footerEnabled !==
                false && (
                <div
                  className="mt-10 border-t pt-4 text-center text-xs"
                  style={{
                    borderColor:
                      document
                        .template
                        ?.styling
                        ?.primaryColor ||
                      "#155e5a",

                    color:
                      document
                        .template
                        ?.styling
                        ?.primaryColor ||
                      "#155e5a",
                  }}
                >
                  Confidential HR Document
                </div>
              )}

            </article>

          </div>
        </div>
      )}
    </div>
  );
}