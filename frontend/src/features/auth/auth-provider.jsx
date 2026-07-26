import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../core/api/api-client.js";
import { AuthContext } from "./auth-context.js";
import { loginAccount, registerAccount } from "./auth-api.js";

const initialState = {
  status: "loading",
  user: null,
  organization: null,
  accessToken: null,
  bootstrapError: null,
};

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState);
  const establishSession = useCallback(
    (session) =>
      setState({
        status: "authenticated",
        user: session.user,
        organization: session.organization,
        accessToken: session.accessToken,
        bootstrapError: null,
      }),
    [],
  );
  const clearSession = useCallback(
    () => setState({ ...initialState, status: "unauthenticated" }),
    [],
  );
  const logout = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      clearSession();
    }
  }, [clearSession]);
  const login = useCallback(
    async (credentials) => {
      const session = await loginAccount(credentials);
      establishSession(session);
      return session;
    },
    [establishSession],
  );
  const register = useCallback(
    async (registrationInput) => {
      const session = await registerAccount(registrationInput);
      establishSession(session);
      return session;
    },
    [establishSession],
  );

  useEffect(() => {
    let active = true;
    apiRequest("/auth/refresh", { method: "POST" })
      .then((result) => {
        if (active) establishSession(result.data);
      })
      .catch((error) => {
        if (!active) return;
        if (error?.status === 401 && error?.code === "AUTHENTICATION_REQUIRED")
          clearSession();
        else
          setState({
            ...initialState,
            status: "unauthenticated",
            bootstrapError:
              error?.code === "ORGANIZATION_SUSPENDED"
                ? "This organization is suspended."
                : "We could not restore your session.",
          });
      });
    return () => {
      active = false;
    };
  }, [clearSession, establishSession]);

  const value = useMemo(
    () => ({
      ...state,
      establishSession,
      clearSession,
      login,
      register,
      logout,
    }),
    [state, establishSession, clearSession, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
