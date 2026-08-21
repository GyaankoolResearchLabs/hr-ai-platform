import api from "./api";

export const documentTemplateService = {
  async list(filters = {}) {
    const params = {};

    if (filters.document_type) {
      params.document_type = filters.document_type;
    }

    if (filters.status) {
      params.status = filters.status;
    }

    const { data } = await api.get("/documents/templates", {
      params,
    });

    return data;
  },

  async getById(id) {
    const { data } = await api.get(
      `/documents/templates/${id}`
    );

    return data;
  },

  async create(template) {
    const { data } = await api.post(
      "/documents/templates",
      template
    );

    return data;
  },

  async update(id, template) {
    const { data } = await api.put(
      `/documents/templates/${id}`,
      template
    );

    return data;
  },

  async remove(id) {
    const { data } = await api.delete(
      `/documents/templates/${id}`
    );

    return data;
  },
};