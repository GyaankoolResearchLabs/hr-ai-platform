import api from "./api";

/* =========================================================
   GET ALL STRATEGIC ROADMAP ITEMS
========================================================= */

export async function getStrategicRoadmapItems() {
  const response = await api.get(
    "/strategic-hr-roadmap"
  );

  return response.data?.items || [];
}

/* =========================================================
   GET SINGLE STRATEGIC ROADMAP ITEM
========================================================= */

export async function getStrategicRoadmapItem(id) {
  const response = await api.get(
    `/strategic-hr-roadmap/${id}`
  );

  return response.data?.item;
}

/* =========================================================
   CREATE STRATEGIC ROADMAP ITEM
========================================================= */

export async function createStrategicRoadmapItem(
  payload
) {
  const response = await api.post(
    "/strategic-hr-roadmap",
    payload
  );

  return response.data?.item;
}

/* =========================================================
   UPDATE STRATEGIC ROADMAP ITEM
========================================================= */

export async function updateStrategicRoadmapItem(
  id,
  payload
) {
  const response = await api.patch(
    `/strategic-hr-roadmap/${id}`,
    payload
  );

  return response.data?.item;
}

/* =========================================================
   DELETE STRATEGIC ROADMAP ITEM
========================================================= */

export async function deleteStrategicRoadmapItem(
  id
) {
  const response = await api.delete(
    `/strategic-hr-roadmap/${id}`
  );

  return response.data;
}