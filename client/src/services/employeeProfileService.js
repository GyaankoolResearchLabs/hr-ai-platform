import api from "./api";

export const employeeProfileService = {
  /* =========================================================
     GET MY PROFILE
  ========================================================= */

  async getMyProfile() {
    const { data } = await api.get("/employee/profile");

    return data;
  },
};

export default employeeProfileService;
