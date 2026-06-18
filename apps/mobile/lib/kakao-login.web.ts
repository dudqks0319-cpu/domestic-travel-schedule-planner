export async function requestKakaoAccessToken(): Promise<string> {
  throw new Error(
    "카카오 웹 로그인은 서버 OAuth broker가 준비된 뒤 활성화합니다. 모바일/웹 번들에는 KAKAO_REST_API_KEY를 넣지 마세요."
  );
}

export async function completeKakaoRedirectIfPresent(): Promise<string | null> {
  return null;
}
