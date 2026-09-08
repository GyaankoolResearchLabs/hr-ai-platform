import supertest from "supertest";
import { BASE_URL } from "./loadContext.mjs";

/*
|--------------------------------------------------------------------------
| API CLIENT
|--------------------------------------------------------------------------
| Talks to the real running server over real HTTP (BASE_URL) — no
| Express app import, no mocked request/response objects. `as(token)`
| returns a supertest agent that attaches a real bearer token to every
| request, matching exactly how the real frontend calls the API.
|--------------------------------------------------------------------------
*/

export function api() {
  return supertest(BASE_URL);
}

export function as(token) {
  const agent = supertest(BASE_URL);

  return {
    get: (url) => agent.get(url).set("Authorization", `Bearer ${token}`),
    post: (url, body) =>
      agent.post(url).set("Authorization", `Bearer ${token}`).send(body),
    put: (url, body) =>
      agent.put(url).set("Authorization", `Bearer ${token}`).send(body),
    patch: (url, body) =>
      agent.patch(url).set("Authorization", `Bearer ${token}`).send(body),
    delete: (url) => agent.delete(url).set("Authorization", `Bearer ${token}`),
  };
}
