import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  clearAuthToken,
  clearSessionTokens,
  clearUserProfile,
  getAccessToken,
  getAuthToken,
  getRefreshToken,
  getUserProfile,
  setAccessToken,
  setAuthToken,
  setRefreshToken,
  setUserProfile
} from "../../lib/secure-storage";

import type { UserSignupProfile } from "../../types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthSession {
  authToken: string;
  accessToken: string;
  refreshToken: string;
  user: UserSignupProfile;
}

interface AuthContextValue {
  status: AuthStatus;
  user: UserSignupProfile | null;
  loginWithKakaoMock: (params?: { email?: string; nickname?: string }) => Promise<void>;
  setSession: (session: AuthSession) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function createMockUser(params?: { email?: string; nickname?: string }): UserSignupProfile {
  const safeEmail = params?.email?.trim() || "kakao.mock@tripmate.local";
  const derivedNickname = safeEmail.includes("@") ? safeEmail.split("@")[0] : "여행자";
  const safeNickname = params?.nickname?.trim() || derivedNickname || "여행자";

  return {
    email: safeEmail,
    nickname: safeNickname,
    companion: "solo",
    purpose: "sightseeing",
    travelStyle: "P",
    transport: "walk",
    foods: [],
    childAgeGroups: []
  };
}

function createMockToken(prefix: string): string {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randomSuffix}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserSignupProfile | null>(null);

  const setSession = useCallback(async (session: AuthSession) => {
    await Promise.all([
      setAuthToken(session.authToken),
      setAccessToken(session.accessToken),
      setRefreshToken(session.refreshToken),
      setUserProfile(session.user)
    ]);

    setUser(session.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    await Promise.all([clearAuthToken(), clearSessionTokens(), clearUserProfile()]);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const loginWithKakaoMock = useCallback(
    async (params?: { email?: string; nickname?: string }) => {
      const mockUser = createMockUser(params);
      const authToken = createMockToken("mock_auth");

      await setSession({
        authToken,
        accessToken: createMockToken("mock_access"),
        refreshToken: createMockToken("mock_refresh"),
        user: mockUser
      });
    },
    [setSession]
  );

  useEffect(() => {
    let isActive = true;

    const bootstrapAuth = async () => {
      try {
        const [authToken, accessToken, refreshToken, storedUser] = await Promise.all([
          getAuthToken(),
          getAccessToken(),
          getRefreshToken(),
          getUserProfile<UserSignupProfile>()
        ]);

        if (!isActive) {
          return;
        }

        const hasSessionToken = Boolean(authToken || accessToken || refreshToken);
        setUser(hasSessionToken ? storedUser : null);
        setStatus(hasSessionToken ? "authenticated" : "unauthenticated");
      } catch {
        if (!isActive) {
          return;
        }

        setUser(null);
        setStatus("unauthenticated");
      }
    };

    void bootstrapAuth();

    return () => {
      isActive = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      loginWithKakaoMock,
      setSession,
      logout
    }),
    [loginWithKakaoMock, logout, setSession, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
