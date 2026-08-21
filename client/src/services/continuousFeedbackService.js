import api from "./api";

export async function getContinuousFeedback(
  params = {},
) {
  const response = await api.get(
    "/continuous-feedback",
    {
      params,
    },
  );

  return response.data;
}

export async function getContinuousFeedbackById(
  id,
) {
  const response = await api.get(
    `/continuous-feedback/${id}`,
  );

  return response.data;
}

export async function createContinuousFeedback(
  payload,
) {
  const response = await api.post(
    "/continuous-feedback",
    payload,
  );

  return response.data;
}

export async function updateContinuousFeedback(
  id,
  payload,
) {
  const response = await api.patch(
    `/continuous-feedback/${id}`,
    payload,
  );

  return response.data;
}

export async function archiveContinuousFeedback(
  id,
) {
  const response = await api.post(
    `/continuous-feedback/${id}/archive`,
  );

  return response.data;
}

export async function deleteContinuousFeedback(
  id,
) {
  const response = await api.delete(
    `/continuous-feedback/${id}`,
  );

  return response.data;
}