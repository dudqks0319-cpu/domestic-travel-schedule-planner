import type { Env } from "../bindings";

export interface VerifiedKakaoProfile {
  kakaoUserId: string;
  nickname: string;
  email?: string;
  profileImage?: string;
}

interface KakaoUserMeResponse {
  id?: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
    };
  };
  properties?: {
    nickname?: string;
    thumbnail_image?: string;
    profile_image?: string;
  };
}

function imageUrlValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("https://")) {
    return null;
  }

  return trimmed;
}

export async function verifyKakaoAccessToken(
  env: Env,
  kakaoAccessToken: string
): Promise<VerifiedKakaoProfile | null> {
  const trimmed = kakaoAccessToken.trim();
  if (!trimmed) {
    return null;
  }

  if ((env.ENVIRONMENT === "local" || env.ENVIRONMENT === "preview") && trimmed.startsWith("dev:")) {
    const nickname = trimmed.slice("dev:".length).trim() || "TripMate Dev";
    return {
      kakaoUserId: `dev-${nickname.toLowerCase().replaceAll(/[^a-z0-9가-힣_-]/g, "-")}`,
      nickname,
      email: `${nickname.toLowerCase().replaceAll(/[^a-z0-9_-]/g, "-")}@tripmate.local`
    };
  }

  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: {
      Authorization: `Bearer ${trimmed}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
    }
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json().catch(() => null)) as KakaoUserMeResponse | null;
  if (!body?.id) {
    return null;
  }

  const nickname =
    body.kakao_account?.profile?.nickname?.trim() ||
    body.properties?.nickname?.trim() ||
    "카카오 여행자";
  const email = body.kakao_account?.email?.trim();
  const profileImage =
    imageUrlValue(body.kakao_account?.profile?.profile_image_url) ??
    imageUrlValue(body.kakao_account?.profile?.thumbnail_image_url) ??
    imageUrlValue(body.properties?.profile_image) ??
    imageUrlValue(body.properties?.thumbnail_image);

  return {
    kakaoUserId: String(body.id),
    nickname,
    ...(email ? { email } : {}),
    ...(profileImage ? { profileImage } : {})
  };
}
