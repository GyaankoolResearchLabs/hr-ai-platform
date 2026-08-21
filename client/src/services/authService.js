import { supabase } from "../lib/supabaseClient";

/**
 * Centralized Supabase authentication service.
 *
 * Important:
 * - Always try to refresh the session before returning it.
 * - This prevents the frontend from sending an expired access token
 *   to the backend.
 */
export const authService = {
  async signUp({ email, password, fullName }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async signIn({ email, password }) {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      throw error;
    }

    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  },

  /**
   * Restore the current session.
   *
   * We explicitly refresh here so the backend receives
   * a current access token instead of an expired one.
   */
  async getSession() {
    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const currentSession = sessionData?.session;

    /*
     * No logged-in user.
     */
    if (!currentSession) {
      return null;
    }

    /*
     * Explicitly refresh the session.
     *
     * Supabase will return a valid session if the refresh
     * token is still usable.
     */
    const {
      data: refreshData,
      error: refreshError,
    } = await supabase.auth.refreshSession();

    if (refreshError) {
      console.error(
        "[AUTH SERVICE] Session refresh failed:",
        refreshError
      );

      /*
       * If the refresh token itself is invalid/expired,
       * the session cannot be trusted anymore.
       */
      await supabase.auth.signOut();

      return null;
    }

    return refreshData?.session || null;
  },

  /**
   * Get the latest access token.
   *
   * Useful for API requests that require:
   * Authorization: Bearer <token>
   */
  async getAccessToken() {
    const session = await this.getSession();

    return session?.access_token || null;
  },

  /**
   * Listen for Supabase authentication changes.
   */
  onAuthStateChange(callback) {
    const {
      data,
      error,
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        callback(session || null);
      }
    );

    if (error) {
      console.error(
        "[AUTH SERVICE] Auth state listener error:",
        error
      );
    }

    return data?.subscription;
  },
};