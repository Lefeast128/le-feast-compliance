import {
  ApiError,
  authApi,
  type AuthMembership,
  type AuthUser,
  type OtpResponse,
} from "@/lib/api-client";
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  memberships: AuthMembership[];
  authError: string | null;
  requestOtp: (email: string) => Promise<OtpResponse>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError || error instanceof Error ? error.message : fallback;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<AuthMembership[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);

  const applySession = useCallback((session: Awaited<ReturnType<typeof authApi.getSession>>) => {
    if (!session.authenticated) {
      setIsAuthenticated(false);
      setUser(null);
      setMemberships([]);
      return;
    }

    setIsAuthenticated(true);
    setUser(session.user);
    setMemberships(session.memberships);
  }, []);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      applySession(await authApi.getSession());
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      setMemberships([]);
      setAuthError(errorMessage(error, "Unable to check your session"));
    } finally {
      setIsLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshSession]);

  const requestOtp = useCallback(async (email: string) => {
    setAuthError(null);
    try {
      return await authApi.requestOtp(email);
    } catch (error) {
      setAuthError(errorMessage(error, "Unable to send verification email"));
      throw error;
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    setAuthError(null);
    try {
      const result = await authApi.verifyOtp(email, code);
      setIsAuthenticated(true);
      setUser(result.user);
      setMemberships(result.memberships);
    } catch (error) {
      setAuthError(errorMessage(error, "Unable to verify code"));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);
    try {
      await authApi.logout();
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      setMemberships([]);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    isLoading,
    isAuthenticated,
    user,
    memberships,
    authError,
    requestOtp,
    verifyOtp,
    logout,
    refreshSession,
  }), [isLoading, isAuthenticated, user, memberships, authError, requestOtp, verifyOtp, logout, refreshSession]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
