import api from "./api";

/**
 * aiService
 * -----------------------------------------------------------------------
 * Every AI-powered feature in the app (tools, assistant, future
 * copilots inside individual tool pages) should call through here rather
 * than hitting an AI provider directly. That keeps exactly one seam to
 * swap or extend AI integration — no page or component needs to change.
 *
 * `ask` calls POST /api/ai/assistant, which is backed by a real OpenAI
 * call on the server (server/src/services/aiService.js's `respond`).
 * It answers general HR questions (recruitment, onboarding, performance,
 * attendance, leave, payroll, compliance, etc.) — it is not grounded in
 * this organization's actual data unless a caller explicitly passes
 * `context.organization`, which this page currently does not.
 */
export const aiService = {
  /**
   * @param {string} prompt - the user's natural-language request
   * @param {object} [context] - optional structured context, e.g.
   *   { categoryId, toolId } to scope the assistant to a specific tool
   * @returns {Promise<{ reply: string, status: string }>}
   */
  async ask(prompt, context = {}) {
    const { data } = await api.post("/ai/assistant", { prompt, context });
    return data;
  },
};
