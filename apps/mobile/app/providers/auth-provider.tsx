import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { authApi } from "../../services/api";
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

interface BackendAuthUser {
  id: string;
  nickname: string;
  email?: string | null;
  profileImage?: string | null;
}

interface AuthContextValue {
  status: AuthStatus;
  user: UserSignupProfile | null;
  isGuest: boolean;
  loginWithKakao: (kakaoAccessToken: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  setSession: (session: AuthSession) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const DEMO_USER: UserSignupProfile = {
  email: "guest@tripmate.local",
  nickname: "여행자",
  companion: "solo",
  purpose: "sightseeing",
  travelStyle: "P",
  transport: "transit",
  foods: ["korean", "cafe"],
  childAgeGroups: []
};

function mergeUserProfile(
  backendUser: BackendAuthUser,
  existingProfile: UserSignupProfile | null
): UserSignupProfile {
  return {
    email:
      backendUser.email?.trim() ||
      existingProfile?.email ||
      "kakao.user@tripmate.local",
    nickname:
      backendUser.nickname?.trim() ||
      existingProfile?.nickname ||
      "여행자",
    companion: existingProfile?.companion ?? "solo",
    purpose: existingProfile?.purpose ?? "sightseeing",
    travelStyle: existingProfile?.travelStyle ?? "P",
    transport: existingProfile?.transport ?? "walk",
    foods: existingProfile?.foods ?? [],
    childAgeGroups: existingProfile?.childAgeGroups ?? []
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserSignupProfile | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  const activateGuest = useCallback(async () => {
    await Promise.all([clearAuthToken(), clearSessionTokens(), setUserProfile(DEMO_USER)]);
    setIsGuest(true);
    setUser(DEMO_USER);
    setStatus("authenticated");
  }, []);

  const setSession = useCallback(async (session: AuthSession) => {
    await Promise.all([
      setAuthToken(session.authToken),
      setAccessToken(session.accessToken),
      setRefreshToken(session.refreshToken),
      setUserProfile(session.user)
    ]);

    setIsGuest(false);
    setUser(session.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    await activateGuest();
  }, [activateGuest]);

  const continueAsGuest = useCallback(async () => {
    await activateGuest();
  }, [activateGuest]);

  const loginWithKakao = useCallback(
    async (kakaoAccessToken: string) => {
      const existingProfile = await getUserProfile<UserSignupProfile>();
      const response = await authApi.kakaoLogin(kakaoAccessToken);
      const accessToken = response.data?.accessToken as string;
      const refreshToken = response.data?.refreshToken as string;
      const backendUser = response.data?.user as BackendAuthUser;

      if (!accessToken || !refreshToken || !backendUser) {
        throw new Error("로그인 응답이 올바르지 않습니다.");
      }

      await setSession({
        authToken: accessToken,
        accessToken,
        refreshToken,
        user: mergeUserProfile(backendUser, existingProfile)
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
        if (!hasSessionToken) {
          await activateGuest();
          return;
        }

        try {
          const meResponse = await authApi.getMe();
          const backendUser = meResponse.data?.user as BackendAuthUser | undefined;
          const mergedProfile = backendUser
            ? mergeUserProfile(backendUser, storedUser)
            : storedUser;

          if (!isActive) {
            return;
          }

          if (mergedProfile) {
            await setUserProfile(mergedProfile);
            if (!isActive) {
              return;
            }
          }

          setIsGuest(false);
          setUser(mergedProfile ?? null);
          setStatus("authenticated");
        } catch {
          if (!isActive) return;
          await activateGuest();
        }
      } catch {
        if (!isActive) {
          return;
        }

        setIsGuest(true);
        setUser(DEMO_USER);
        setStatus("authenticated");
      }
    };

    void bootstrapAuth();

    return () => {
      isActive = false;
    };
  }, [activateGuest]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isGuest,
      loginWithKakao,
      continueAsGuest,
      setSession,
      logout
    }),
    [continueAsGuest, isGuest, loginWithKakao, logout, setSession, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function AuthProviderRouteShim() {
  return null;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
