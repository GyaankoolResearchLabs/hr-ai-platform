import api from "./api";

export const employeeReimbursementsService = {
  /* =========================================================
     LIST MY CLAIMS
  ========================================================= */

  async list(status = null) {
    const params = {};

    if (status) {
      params.status = status;
    }

    const { data } = await api.get("/employee/reimbursements", { params });

    return Array.isArray(data?.claims) ? data.claims : [];
  },

  /* =========================================================
     GET ONE CLAIM
  ========================================================= */

  async getById(id) {
    if (!id) {
      throw new Error("Claim ID is required.");
    }

    const { data } = await api.get(`/employee/reimbursements/${id}`);

    return data?.claim || null;
  },

  /* =========================================================
     GET RECEIPT VIEW URL
  ========================================================= */

  async getReceiptUrl(claimId, receiptId) {
    if (!claimId || !receiptId) {
      throw new Error("Claim ID and receipt ID are required.");
    }

    const { data } = await api.get(
      `/employee/reimbursements/${claimId}/receipts/${receiptId}`
    );

    return data;
  },

  /* =========================================================
     SUBMIT A NEW CLAIM
  ========================================================= */

  async submitClaim({
    categoryId,
    amount,
    description,
    expenseDate,
    receiptFile = null,
  }) {
    if (!amount) {
      throw new Error("Amount is required.");
    }

    if (!description) {
      throw new Error("Description is required.");
    }

    if (!expenseDate) {
      throw new Error("Expense date is required.");
    }

    /*
     * IMPORTANT: Do NOT manually set Content-Type.
     * Axios/browser will automatically create the correct
     * multipart/form-data; boundary=... header.
     */
    const formData = new FormData();

    if (categoryId) {
      formData.append("category_id", categoryId);
    }

    formData.append("amount", amount);
    formData.append("description", description);
    formData.append("expense_date", expenseDate);

    if (receiptFile) {
      formData.append("receipt", receiptFile, receiptFile.name);
    }

    /*
     * The shared `api` axios instance sets a default
     * "Content-Type: application/json" header. Axios does not
     * override an explicitly-configured Content-Type just because
     * the body is FormData, so without this override the request
     * gets serialized as JSON (dropping the file entirely) instead
     * of the multipart/form-data the backend's multer middleware
     * expects. Clearing it here lets axios/the browser compute the
     * correct "multipart/form-data; boundary=..." header itself.
     */
    const { data } = await api.post(
      "/employee/reimbursements",
      formData,
      {
        headers: {
          "Content-Type": undefined,
        },
      },
    );

    return data;
  },
};

export default employeeReimbursementsService;
