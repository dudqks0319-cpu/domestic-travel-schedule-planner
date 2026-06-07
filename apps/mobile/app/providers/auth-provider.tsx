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
  getAccessToken,
  getAuthToken,
  getRefreshToken,
  getUserProfile,
  SECURE_STORE_REQUIRED_MESSAGE,
  setAccessToken,
  setAuthToken,
  setRefreshToken,
  setUserProfile
} from "../../lib/secure-storage";
import { clearLocalAuthState, subscribeLocalAuthStateCleared } from "../../services/authCleanup";

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
  loginWithKakao: (kakaoAccessToken: string) => Promise<void>;
  saveGuestProfile: (profile: UserSignupProfile) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
    profileImage:
      backendUser.profileImage?.trim() ||
      existingProfile?.profileImage ||
      null,
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

  const setSession = useCallback(async (session: AuthSession) => {
    try {
      await Promise.all([
        setAuthToken(session.authToken),
        setAccessToken(session.accessToken),
        setRefreshToken(session.refreshToken),
        setUserProfile(session.user)
      ]);
    } catch {
      await clearLocalAuthState("invalid-session");
      throw new Error(`${SECURE_STORE_REQUIRED_MESSAGE} 기기 잠금 설정을 확인한 뒤 다시 시도해주세요.`);
    }

    setUser(session.user);
    setStatus("authenticated");
  }, []);

  const saveGuestProfile = useCallback(async (profile: UserSignupProfile) => {
    await Promise.all([
      clearAuthToken(),
      clearSessionTokens(),
      setUserProfile(profile)
    ]);

    setUser(profile);
    setStatus("unauthenticated");
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    await clearLocalAuthState("logout");
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const deleteAccount = useCallback(async () => {
    await authApi.deleteMe();
    await clearLocalAuthState("account-deleted");
    setUser(null);
    setStatus("unauthenticated");
  }, []);

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
          setUser(storedUser ?? null);
          setStatus("unauthenticated");
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

          setUser(mergedProfile ?? null);
          setStatus("authenticated");
        } catch {
          await clearLocalAuthState("invalid-session");
          if (!isActive) {
            return;
          }
          setUser(null);
          setStatus("unauthenticated");
        }
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

  useEffect(() => subscribeLocalAuthStateCleared(() => {
    setUser(null);
    setStatus("unauthenticated");
  }), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      loginWithKakao,
      saveGuestProfile,
      logout,
      deleteAccount
    }),
    [deleteAccount, loginWithKakao, logout, saveGuestProfile, status, user]
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
