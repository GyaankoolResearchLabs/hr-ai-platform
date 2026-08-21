import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";

import { authService } from "../services/authService";
import { organizationService } from "../services/organizationService";
import { subscriptionService } from "../services/subscriptionService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  /*
   * =========================================================
   * SESSION
   *
   * undefined = restoring
   * null      = signed out
   * object    = authenticated
   * =========================================================
   */
  const [session, setSession] = useState(undefined);

  /*
   * =========================================================
   * ORGANIZATION
   *
   * undefined = not loaded yet
   * null      = no organization
   * object    = organization loaded
   * =========================================================
   */
  const [organization, setOrganization] =
    useState(undefined);

  const [subscription, setSubscription] =
    useState(null);

  const [loadingOrg, setLoadingOrg] =
    useState(false);

  const [organizationError, setOrganizationError] =
    useState(null);

  /*
   * Prevent multiple organization requests from running
   * simultaneously.
   */
  const organizationRequestRef = useRef(false);

  /*
   * =========================================================
   * LOAD ORGANIZATION
   * =========================================================
   */
  const refreshOrganization = useCallback(async () => {
    /*
     * Authentication is still being restored.
     */
    if (session === undefined) {
      console.log(
        "[ORG] Session still loading. Skipping organization request."
      );

      return;
    }

    /*
     * User is signed out.
     */
    if (session === null) {
      console.log(
        "[ORG] No authenticated session. Clearing organization."
      );

      setOrganization(null);
      setSubscription(null);
      setOrganizationError(null);
      setLoadingOrg(false);

      return;
    }

    /*
     * Prevent duplicate calls.
     */
    if (organizationRequestRef.current) {
      console.log(
        "[ORG] Organization request already running. Skipping duplicate."
      );

      return;
    }

    organizationRequestRef.current = true;

    setLoadingOrg(true);
    setOrganizationError(null);

    try {
      console.log(
        "[ORG] Authenticated user:",
        session?.user?.id
      );

      console.log(
        "[ORG] Access token available:",
        !!session?.access_token
      );

      /*
       * Make sure the session we are using is current.
       *
       * This is important because the page can remain open
       * long enough for an access token to expire.
       */
      const freshSession =
        await authService.getSession();

      /*
       * Session became invalid while refreshing.
       */
      if (!freshSession) {
        console.warn(
          "[ORG] Session could not be refreshed."
        );

        setSession(null);
        setOrganization(null);
        setSubscription(null);

        setOrganizationError(
          "Your session has expired. Please sign in again."
        );

        return;
      }

      /*
       * Keep AuthContext synchronized with the refreshed
       * Supabase session.
       */
      setSession(freshSession);

      console.log(
        "[ORG] Fresh access token available:",
        !!freshSession.access_token
      );

      console.log(
        "[ORG] Loading current organization..."
      );

      /*
       * organizationService should use the current
       * authenticated token.
       */
      const org =
        await organizationService.getCurrent();

      console.log(
        "[ORG] Current organization response:",
        org
      );

      /*
       * No organization.
       */
      if (!org) {
        console.log(
          "[ORG] No organization found."
        );

        setOrganization(null);
        setSubscription(null);

        return;
      }

      /*
       * Organization successfully loaded.
       */
      console.log(
        "[ORG] Organization loaded successfully:",
        org
      );

      setOrganization(org);

      /*
       * Load subscription after organization.
       */
      try {
        console.log(
          "[SUBSCRIPTION] Loading subscription..."
        );

        const sub =
          await subscriptionService.getStatus();

        console.log(
          "[SUBSCRIPTION] Response:",
          sub
        );

        setSubscription(sub || null);
      } catch (subscriptionError) {
        console.error(
          "[SUBSCRIPTION] Failed to load subscription:",
          subscriptionError
        );

        /*
         * Subscription failure should never remove
         * the successfully loaded organization.
         */
        setSubscription(null);
      }
    } catch (error) {
      console.error(
        "[ORG] Failed to load organization:",
        error
      );

      console.error(
        "[ORG] Status:",
        error?.response?.status
      );

      console.error(
        "[ORG] Response:",
        error?.response?.data
      );

      const status =
        error?.response?.status;

      /*
       * =====================================================
       * AUTHENTICATION FAILURE
       * =====================================================
       *
       * Backend rejected the token.
       */
      if (status === 401) {
        console.warn(
          "[ORG] Backend rejected the session. Attempting one session refresh..."
        );

        try {
          const refreshedSession =
            await authService.getSession();

          if (!refreshedSession) {
            throw new Error(
              "Session refresh failed."
            );
          }

          setSession(refreshedSession);

          console.log(
            "[ORG] Session refreshed successfully."
          );

          /*
           * Do not immediately make another request here.
           *
           * Updating session will trigger this function
           * again through the session effect.
           */
          return;
        } catch (refreshError) {
          console.error(
            "[ORG] Session refresh failed:",
            refreshError
          );

          await authService.signOut();

          setSession(null);
          setOrganization(null);
          setSubscription(null);

          setOrganizationError(
            "Your session has expired. Please sign in again."
          );

          return;
        }
      }

      /*
       * Backend explicitly says no organization exists.
       */
      if (status === 404) {
        console.log(
          "[ORG] Backend returned 404. No organization exists."
        );

        setOrganization(null);
        setSubscription(null);
        setOrganizationError(null);

        return;
      }

      /*
       * Other errors.
       *
       * Do NOT destroy a previously loaded organization.
       */
      setOrganization((current) => {
        if (current !== undefined) {
          return current;
        }

        return undefined;
      });

      setOrganizationError(
        error?.response?.data?.message ||
          error?.message ||
          "Could not load organization."
      );
    } finally {
      organizationRequestRef.current = false;
      setLoadingOrg(false);
    }
  }, [session]);

  /*
   * =========================================================
   * INITIAL AUTH RESTORATION
   * =========================================================
   */
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        console.log(
          "[AUTH] Restoring Supabase session..."
        );

        const currentSession =
          await authService.getSession();

        if (!mounted) {
          return;
        }

        console.log(
          "[AUTH] Session restored:",
          currentSession
            ? "AUTHENTICATED"
            : "SIGNED OUT"
        );

        setSession(
          currentSession || null
        );
      } catch (error) {
        console.error(
          "[AUTH] Failed to restore authentication:",
          error
        );

        if (mounted) {
          setSession(null);
        }
      }
    }

    initializeAuth();

    /*
     * Listen for Supabase login/logout/session changes.
     */
    const authSubscription =
      authService.onAuthStateChange(
        (newSession) => {
          if (!mounted) {
            return;
          }

          console.log(
            "[AUTH] Auth state changed:",
            newSession
              ? "AUTHENTICATED"
              : "SIGNED OUT"
          );

          setSession(
            newSession || null
          );
        }
      );

    return () => {
      mounted = false;

      authSubscription?.unsubscribe();
    };
  }, []);

  /*
   * =========================================================
   * LOAD ORGANIZATION AFTER SESSION IS READY
   * =========================================================
   */
  useEffect(() => {
    if (session === undefined) {
      return;
    }

    refreshOrganization();
  }, [
    session,
    refreshOrganization,
  ]);

  /*
   * =========================================================
   * SIGN OUT
   * =========================================================
   */
  const signOut = useCallback(async () => {
    try {
      await authService.signOut();
    } catch (error) {
      console.error(
        "[AUTH] Sign out failed:",
        error
      );
    } finally {
      setSession(null);
      setOrganization(null);
      setSubscription(null);
      setOrganizationError(null);
      setLoadingOrg(false);
    }
  }, []);

  /*
   * =========================================================
   * DERIVED STATE
   * =========================================================
   */

  const isAuthenticated =
    session !== undefined &&
    !!session;

  const authLoading =
    session === undefined;

  const hasOrganization =
    organization !== undefined &&
    organization !== null;

  const organizationLoading =
    session === undefined ||
    organization === undefined ||
    loadingOrg;

  const subscriptionActive =
    subscriptionService.isActive(
      subscription?.status
    );

  /*
   * =========================================================
   * CONTEXT VALUE
   * =========================================================
   */
  const value = {
    /*
     * Session
     */
    session,

    user:
      session?.user ?? null,

    isAuthenticated,

    authLoading,

    /*
     * Organization
     */
    organization,

    hasOrganization,

    organizationLoading,

    loadingOrg,

    organizationError,

    refreshOrganization,

    /*
     * Subscription
     */
    subscription,

    subscriptionActive,

    /*
     * Auth actions
     */
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/*
 * =========================================================
 * USE AUTH
 * =========================================================
 */
export function useAuth() {
  const ctx =
    useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }

  return ctx;
}