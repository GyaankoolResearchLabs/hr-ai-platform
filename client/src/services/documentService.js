import api from "./api";

const documentService = {
  /* =========================================================
     GENERATED DOCUMENTS
  ========================================================= */

  async generateOfferLetter(
    employeeId,
    templateId = null
  ) {
    return this.generateDocument(
      "offer_letter",
      employeeId,
      templateId
    );
  },

  async generateExperienceLetter(
    employeeId,
    templateId = null
  ) {
    return this.generateDocument(
      "experience_letter",
      employeeId,
      templateId
    );
  },

  async generateEmploymentVerification(
    employeeId,
    templateId = null
  ) {
    return this.generateDocument(
      "employment_verification",
      employeeId,
      templateId
    );
  },

  async generateAddressProof(
    employeeId,
    templateId = null
  ) {
    return this.generateDocument(
      "address_proof",
      employeeId,
      templateId
    );
  },

  async generateDocument(
    documentType,
    employeeId,
    templateId = null
  ) {
    if (!documentType) {
      throw new Error(
        "Document type is required."
      );
    }

    if (!employeeId) {
      throw new Error(
        "Employee is required."
      );
    }

    const payload = {
      employee_id:
        employeeId,

      document_type:
        documentType,
    };

    if (templateId) {
      payload.template_id =
        templateId;
    }

    const { data } =
      await api.post(
        "/documents/generate",
        payload
      );

    return data;
  },

  /* =========================================================
     GET GENERATED DOCUMENTS
  ========================================================= */

  async getGeneratedDocuments({
    employeeId = null,
    documentType = null,
  } = {}) {
    const params = {};

    if (employeeId) {
      params.employee_id =
        employeeId;
    }

    if (documentType) {
      params.document_type =
        documentType;
    }

    const { data } =
      await api.get(
        "/documents/generated",
        {
          params,
        }
      );

    return Array.isArray(data)
      ? data
      : [];
  },

  /* =========================================================
     GET ONE GENERATED DOCUMENT
  ========================================================= */

  async getGeneratedDocument(
    documentId
  ) {
    if (!documentId) {
      throw new Error(
        "Document ID is required."
      );
    }

    const { data } =
      await api.get(
        `/documents/generated/${documentId}`
      );

    return data;
  },

  /* =========================================================
     SAVE GENERATED DOCUMENT
  ========================================================= */

  async saveGeneratedDocument(
    document
  ) {
    if (!document) {
      throw new Error(
        "Document data is required."
      );
    }

    const { data } =
      await api.post(
        "/documents/generated",
        document
      );

    return data;
  },

  /* =========================================================
     SEND GENERATED DOCUMENT
  ========================================================= */

  async sendGeneratedDocument(
    documentId,
    employeeEmail = null
  ) {
    if (!documentId) {
      throw new Error(
        "Document ID is required."
      );
    }

    const payload = {};

    if (employeeEmail) {
      payload.employee_email =
        employeeEmail;
    }

    const { data } =
      await api.post(
        `/documents/generated/${documentId}/send`,
        payload
      );

    return data;
  },

  /* =========================================================
     EMPLOYEE DOCUMENTS
  ========================================================= */

  async getEmployeeDocuments({
    employeeId = null,
    documentType = null,
    status = null,
  } = {}) {
    const params = {};

    if (employeeId) {
      params.employee_id =
        employeeId;
    }

    if (documentType) {
      params.document_type =
        documentType;
    }

    if (status) {
      params.status =
        status;
    }

    const { data } =
      await api.get(
        "/documents/employee",
        {
          params,
        }
      );

    return Array.isArray(data)
      ? data
      : [];
  },

  /* =========================================================
     GET ONE EMPLOYEE DOCUMENT
  ========================================================= */

  async getEmployeeDocument(
    documentId
  ) {
    if (!documentId) {
      throw new Error(
        "Employee document ID is required."
      );
    }

    const { data } =
      await api.get(
        `/documents/employee/${documentId}`
      );

    return data;
  },

  /* =========================================================
     CREATE EMPLOYEE DOCUMENT

     Supports:

     - Aadhaar number
     - PAN number
     - Passport number
     - Bank account/reference number
     - Address proof number
     - Photo/PDF upload
     - Expiry date
     - HR notes

     The actual file is sent as multipart/form-data
     and stored by the backend in Supabase Storage.
  ========================================================= */

  async createEmployeeDocument({
    employeeId,
    documentType,
    documentNumber,
    expiryDate = null,
    notes = null,
    photo = null,
    status = "active",
  }) {
    /* ---------------------------------------------------------
       VALIDATE EMPLOYEE
    --------------------------------------------------------- */

    if (!employeeId) {
      throw new Error(
        "Employee is required."
      );
    }

    /* ---------------------------------------------------------
       VALIDATE DOCUMENT TYPE
    --------------------------------------------------------- */

    if (!documentType) {
      throw new Error(
        "Document type is required."
      );
    }

    /* ---------------------------------------------------------
       VALIDATE DOCUMENT NUMBER
    --------------------------------------------------------- */

    if (
      !documentNumber ||
      !documentNumber.trim()
    ) {
      throw new Error(
        `${documentType} number is required.`
      );
    }

    /* ---------------------------------------------------------
       VALIDATE FILE TYPE
    --------------------------------------------------------- */

    if (photo) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ];

      if (
        !allowedTypes.includes(
          photo.type
        )
      ) {
        throw new Error(
          "Only JPG, PNG, WEBP and PDF files are allowed."
        );
      }

      /* -------------------------------------------------------
         5 MB MAXIMUM
      ------------------------------------------------------- */

      const maxSize =
        5 * 1024 * 1024;

      if (
        photo.size >
        maxSize
      ) {
        throw new Error(
          "Document file must be 5 MB or smaller."
        );
      }
    }

    /* =========================================================
       ALWAYS USE FORMDATA

       This is important.

       Even when no photo is selected, we use FormData
       so the backend has one consistent request format.
    ========================================================= */

    const formData =
      new FormData();

    formData.append(
      "employee_id",
      employeeId
    );

    formData.append(
      "document_type",
      documentType
    );

    formData.append(
      "document_number",
      documentNumber.trim()
    );

    formData.append(
      "status",
      status
    );

    if (expiryDate) {
      formData.append(
        "expiry_date",
        expiryDate
      );
    }

    if (
      notes &&
      notes.trim()
    ) {
      formData.append(
        "notes",
        notes.trim()
      );
    }

    /* ---------------------------------------------------------
       ADD ACTUAL FILE
    --------------------------------------------------------- */

    if (photo) {
      formData.append(
        "photo",
        photo,
        photo.name
      );
    }

    /* =========================================================
       SEND TO BACKEND

       IMPORTANT:
       Do NOT manually set Content-Type.

       Axios/browser will automatically create:

       multipart/form-data;
       boundary=....
    ========================================================= */

    const { data } =
      await api.post(
        "/documents/employee",
        formData
      );

    return data;
  },

  /* =========================================================
     UPDATE EMPLOYEE DOCUMENT
  ========================================================= */

  async updateEmployeeDocument(
    documentId,
    {
      documentType,
      documentNumber,
      fileUrl,
      status,
      verificationStatus,
      expiryDate,
      notes,
    } = {}
  ) {
    if (!documentId) {
      throw new Error(
        "Employee document ID is required."
      );
    }

    const payload = {};

    if (
      documentType !==
      undefined
    ) {
      payload.document_type =
        documentType;
    }

    if (
      documentNumber !==
      undefined
    ) {
      payload.document_number =
        documentNumber;
    }

    if (
      fileUrl !==
      undefined
    ) {
      payload.file_url =
        fileUrl;
    }

    if (
      status !==
      undefined
    ) {
      payload.status =
        status;
    }

    if (
      verificationStatus !==
      undefined
    ) {
      payload.verification_status =
        verificationStatus;
    }

    if (
      expiryDate !==
      undefined
    ) {
      payload.expiry_date =
        expiryDate;
    }

    if (
      notes !==
      undefined
    ) {
      payload.notes =
        notes;
    }

    if (
      Object.keys(
        payload
      ).length === 0
    ) {
      throw new Error(
        "No document fields provided for update."
      );
    }

    const { data } =
      await api.put(
        `/documents/employee/${documentId}`,
        payload
      );

    return data;
  },

  /* =========================================================
     DELETE EMPLOYEE DOCUMENT
  ========================================================= */

  async deleteEmployeeDocument(
    documentId
  ) {
    if (!documentId) {
      throw new Error(
        "Employee document ID is required."
      );
    }

    const { data } =
      await api.delete(
        `/documents/employee/${documentId}`
      );

    return data;
  },

  /* =========================================================
     VIEW EMPLOYEE DOCUMENT

     The backend will generate a secure signed URL
     for the private Supabase Storage file.

     Expected backend endpoint:

     GET /api/documents/employee/:id/view
  ========================================================= */

  async getEmployeeDocumentView(
    documentId
  ) {
    if (!documentId) {
      throw new Error(
        "Employee document ID is required."
      );
    }

    const { data } =
      await api.get(
        `/documents/employee/${documentId}/view`
      );

    return data;
  },
};

/* =========================================================
   EXPORT
========================================================= */

export {
  documentService,
};

export default documentService;