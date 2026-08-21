import api from "../lib/api";

export async function getHeadcountPlans() {
  const response = await api.get("/headcount-planning");

  return response.data?.plans || [];
}

export async function createHeadcountPlan(payload) {
  const response = await api.post(
    "/headcount-planning",
    payload
  );

  return response.data?.plan;
}

export async function updateHeadcountPlan(id, payload) {
  const response = await api.patch(
    `/headcount-planning/${id}`,
    payload
  );

  return response.data?.plan;
}

export async function deleteHeadcountPlan(id) {
  const response = await api.delete(
    `/headcount-planning/${id}`
  );

  return response.data;
}