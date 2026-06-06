export type MapDisplayProviderKey = "static" | "kakao" | "naver";

export interface MapDisplayProviderConfig {
  key: MapDisplayProviderKey;
  label: string;
  isInteractive: boolean;
  requiresNativeBuild: boolean;
}

const PROVIDER_CONFIGS: Record<MapDisplayProviderKey, MapDisplayProviderConfig> = {
  static: { key: "static", label: "전국지도 모형", isInteractive: false, requiresNativeBuild: false },
  kakao: { key: "kakao", label: "카카오 지도", isInteractive: true, requiresNativeBuild: false },
  naver: { key: "naver", label: "네이버 지도", isInteractive: true, requiresNativeBuild: true }
};

function readPublicMapProvider(): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_MAP_PROVIDER;
}

export function getConfiguredMapDisplayProvider(): MapDisplayProviderConfig {
  const rawProvider = readPublicMapProvider()?.trim().toLowerCase();
  if (rawProvider === "kakao" || rawProvider === "naver" || rawProvider === "static") {
    return PROVIDER_CONFIGS[rawProvider];
  }

  return PROVIDER_CONFIGS.static;
}

export function getMapProviderNotice(provider = getConfiguredMapDisplayProvider()): string {
  if (provider.key === "naver") {
    return "네이버 지도 native SDK는 EAS Dev Client 연동 검토가 필요합니다.";
  }

  if (provider.key === "kakao") {
    return "카카오 지도는 공개 JavaScript 키가 있을 때 web 지도 탭에서 표시됩니다.";
  }

  return "현재 홈 지도는 지역 선택용 모형이며 실제 장소 좌표는 서버 provider 결과만 사용합니다.";
}
