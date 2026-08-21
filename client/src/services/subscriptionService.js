import api from "./api";

/**
 * subscriptionService
 * -----------------------------------------------------------------------
 * One active company subscription unlocks every HR tool — there are no
 * per-tool or per-category plans. This module is the single place that
 * knows how subscription state is fetched, so a real payment provider
 * (Stripe, Razorpay, etc.) can be dropped in later behind the same
 * `getStatus` / `isActive` contract without touching any page.
 */
export const subscriptionService = {
  /**
   * @returns {Promise<{ status: 'active'|'trialing'|'inactive', plan: string, renewsAt: string|null }>}
   */
  async getStatus() {
    const { data } = await api.get("/subscription/status");
    return data;
  },

  isActive(status) {
    return status === "active" || status === "trialing";
  },
};
