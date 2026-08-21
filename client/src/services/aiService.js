import api from "./api";

/**
 * aiService
 * -----------------------------------------------------------------------
 * Every AI-powered feature in the app (tools, assistant, future
 * copilots inside individual tool pages) should call through here rather
 * than hitting an AI provider directly. That keeps exactly one seam to
 * swap or extend when real AI integration is added — no page or component
 * needs to change.
 *
 * Today this only talks to a placeholder backend route that returns a
 * canned response, so the contract below (`ask`) is what the real
 * implementation should preserve.
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
