import { Platform } from "react-native";

export type MapProviderKind =
  | "kakao-web"
  | "native-map"
  | "mock-preview"
  | "unavailable";

export interface MapProviderState {
  kind: MapProviderKind;
  label: string;
  isProductionProvider: boolean;
  canRenderMap: boolean;
  warning?: string;
}

function readPublicEnv(key: string): string | undefined {
  const maybeProcess = (
    globalThis as {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process;

  const value = maybeProcess?.env?.[key]?.trim();
  return value ? value : undefined;
}

export function getPublicAppEnv(): "development" | "preview" | "production" {
  const value = readPublicEnv("EXPO_PUBLIC_APP_ENV");
  if (value === "preview" || value === "production") {
    return value;
  }

  return "development";
}

export function isProductionRuntime(): boolean {
  return getPublicAppEnv() === "production";
}

export function canUseMockMapPreview(): boolean {
  if (isProductionRuntime()) {
    return false;
  }

  return readPublicEnv("EXPO_PUBLIC_ALLOW_MOCK_MAP_PREVIEW") === "true";
}

export function getKakaoJavascriptKey(): string | undefined {
  return readPublicEnv("EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY");
}

export function resolveMapProviderState(): MapProviderState {
  if (Platform.OS !== "web") {
    return {
      kind: "native-map",
      label: "Native map provider",
      isProductionProvider: true,
      canRenderMap: true
    };
  }

  if (getKakaoJavascriptKey()) {
    return {
      kind: "kakao-web",
      label: "Kakao web map",
      isProductionProvider: true,
      canRenderMap: true
    };
  }

  if (canUseMockMapPreview()) {
    return {
      kind: "mock-preview",
      label: "개발용 지도 미리보기",
      isProductionProvider: false,
      canRenderMap: true,
      warning: "카카오 웹 지도 키가 없어 개발용 미리보기로 표시합니다."
    };
  }

  return {
    kind: "unavailable",
    label: "지도 provider 미설정",
    isProductionProvider: false,
    canRenderMap: false,
    warning: "운영 환경에서는 실제 지도 provider 설정 전까지 mock 지도를 표시하지 않습니다."
  };
}
