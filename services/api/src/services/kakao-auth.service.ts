import axios from "axios";

interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
}

interface KakaoUserResponse {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
}

export async function getKakaoUserByToken(kakaoAccessToken: string): Promise<KakaoUserResponse> {
  const response = await axios.get<KakaoUserResponse>("https://kapi.kakao.com/v2/user/me", {
    headers: {
      Authorization: `Bearer ${kakaoAccessToken}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
    }
  });

  return response.data;
}

export type { KakaoTokenResponse, KakaoUserResponse };
