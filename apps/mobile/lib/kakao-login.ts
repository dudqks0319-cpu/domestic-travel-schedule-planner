import { login } from "@react-native-seoul/kakao-login";
import Constants from "expo-constants";

function isKakaoNativeConfigured(): boolean {
  const extra = Constants.expoConfig?.extra as
    | { kakaoNativeAppKeyConfigured?: boolean }
    | undefined;
  return extra?.kakaoNativeAppKeyConfigured === true;
}

export async function requestKakaoAccessToken(): Promise<string> {
  try {
    if (Constants.appOwnership === "expo") {
      throw new Error("카카오 SDK 로그인은 Expo Go에서 지원되지 않습니다. 개발 빌드(iOS/Android)로 실행해주세요.");
    }

    if (!isKakaoNativeConfigured()) {
      throw new Error("카카오 네이티브 앱 키가 설정되지 않았습니다. EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY를 설정한 개발 빌드가 필요합니다.");
    }

    const token = await login();
    const accessToken = token?.accessToken;

    if (!accessToken) {
      throw new Error("카카오 액세스 토큰을 받지 못했습니다.");
    }

    return accessToken;
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "카카오 로그인에 실패했습니다.";
    throw new Error(message);
  }
}

export async function completeKakaoRedirectIfPresent(): Promise<string | null> {
  return null;
}
