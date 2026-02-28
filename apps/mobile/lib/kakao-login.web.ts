export async function requestKakaoAccessToken(): Promise<string> {
  throw new Error("카카오 네이티브 로그인은 모바일 앱(iOS/Android)에서만 지원됩니다.");
}
