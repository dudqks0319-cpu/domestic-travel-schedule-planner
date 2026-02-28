import { login } from "@react-native-seoul/kakao-login";
import Constants from "expo-constants";

export async function requestKakaoAccessToken(): Promise<string> {
  try {
    if (Constants.appOwnership === "expo") {
      throw new Error("카카오 SDK 로그인은 Expo Go에서 지원되지 않습니다. 개발 빌드(iOS/Android)로 실행해주세요.");
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
