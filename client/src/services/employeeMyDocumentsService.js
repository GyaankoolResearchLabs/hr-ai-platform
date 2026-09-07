import api from "./api";

export const employeeMyDocumentsService = {
  /* =========================================================
     LIST MY DOCUMENTS
  ========================================================= */

  async list() {
    const { data } = await api.get("/employee/documents");

    return Array.isArray(data?.documents) ? data.documents : [];
  },

  /* =========================================================
     GET ONE DOCUMENT
  ========================================================= */

  async getById(id) {
    if (!id) {
      throw new Error("Document ID is required.");
    }

    const { data } = await api.get(`/employee/documents/${id}`);

    return data?.document || null;
  },

  /* =========================================================
     UPLOAD A DOCUMENT
  ========================================================= */

  async upload({ documentType, documentNumber = null, notes = null, file }) {
    if (!documentType) {
      throw new Error("Document type is required.");
    }

    if (!file) {
      throw new Error("A file is required.");
    }

    const formData = new FormData();

    formData.append("document_type", documentType);

    if (documentNumber) {
      formData.append("document_number", documentNumber);
    }

    if (notes) {
      formData.append("notes", notes);
    }

    formData.append("file", file, file.name);

    /*
     * IMPORTANT: the shared `api` instance sets a default
     * "Content-Type: application/json" header, which is not
     * overridden automatically just because the body is FormData
     * (see employeeReimbursementsService.js for the same fix) —
     * clear it here so the browser computes the correct
     * multipart/form-data boundary.
     */
    const { data } = await api.post("/employee/documents", formData, {
      headers: {
        "Content-Type": undefined,
      },
    });

    return data?.document || null;
  },
};

export default employeeMyDocumentsService;
