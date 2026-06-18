import { login } from "@react-native-seoul/kakao-login";

const KAKAO_OAUTH_STATE_KEY = "tripmate:kakaoOAuthState";

function getRestApiKey(): string {
  return process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY?.trim() ?? "";
}

function getRedirectUrl(): string {
  if (process.env.EXPO_PUBLIC_KAKAO_REDIRECT_URI?.trim()) {
    return process.env.EXPO_PUBLIC_KAKAO_REDIRECT_URI.trim();
  }

  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}/auth/login`;
}

function createOauthState(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function requireBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("카카오 웹 로그인은 브라우저에서만 사용할 수 있습니다.");
  }
}

export async function requestKakaoAccessToken(): Promise<string> {
  requireBrowser();

  const restApiKey = getRestApiKey();
  const redirectUrl = getRedirectUrl();

  if (!restApiKey) {
    throw new Error("카카오 REST API 키가 설정되지 않았습니다. EXPO_PUBLIC_KAKAO_REST_API_KEY를 설정하면 웹 로그인도 사용할 수 있습니다.");
  }

  const state = createOauthState();
  window.sessionStorage.setItem(KAKAO_OAUTH_STATE_KEY, state);

  const authorizeUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", restApiKey);
  authorizeUrl.searchParams.set("redirect_uri", redirectUrl);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);

  window.location.assign(authorizeUrl.toString());

  return new Promise<string>(() => undefined);
}

export async function completeKakaoRedirectIfPresent(): Promise<string | null> {
  requireBrowser();

  const currentUrl = new URL(window.location.href);
  const code = currentUrl.searchParams.get("code");
  const state = currentUrl.searchParams.get("state");
  const errorDescription = currentUrl.searchParams.get("error_description");

  if (errorDescription) {
    currentUrl.searchParams.delete("error");
    currentUrl.searchParams.delete("error_description");
    window.history.replaceState({}, document.title, currentUrl.toString());
    throw new Error(errorDescription);
  }

  if (!code) {
    return null;
  }

  const restApiKey = getRestApiKey();
  const redirectUrl = getRedirectUrl();

  if (!restApiKey) {
    throw new Error("카카오 REST API 키가 설정되지 않았습니다. EXPO_PUBLIC_KAKAO_REST_API_KEY를 확인해주세요.");
  }

  const expectedState = window.sessionStorage.getItem(KAKAO_OAUTH_STATE_KEY);
  if (expectedState && state !== expectedState) {
    throw new Error("카카오 로그인 상태 검증에 실패했습니다. 다시 시도해주세요.");
  }

  const token = await login({
    restApiKeyWeb: restApiKey,
    redirectUrlWeb: redirectUrl,
    codeWeb: code
  });

  window.sessionStorage.removeItem(KAKAO_OAUTH_STATE_KEY);
  currentUrl.searchParams.delete("code");
  currentUrl.searchParams.delete("state");
  window.history.replaceState({}, document.title, currentUrl.toString());

  if (!token.access_token) {
    throw new Error("카카오 액세스 토큰을 받지 못했습니다.");
  }

  return token.access_token;
}
