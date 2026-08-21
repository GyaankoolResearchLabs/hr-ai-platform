import api from "./api";

export const organizationService = {
  async create({ name, industry, size }) {
    const { data } = await api.post("/organizations", { name, industry, size });
    return data;
  },

  async getCurrent() {
    const { data } = await api.get("/organizations/me");
    return data;
  },
};
