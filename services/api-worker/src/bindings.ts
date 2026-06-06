export interface Env {
  ENVIRONMENT: "local" | "preview" | "production" | string;
  API_VERSION: "v1" | string;
  ALLOWED_ORIGINS?: string;
  DB: D1Database;
  PLACE_CACHE: KVNamespace;
  TRIPMATE_ASSETS: R2Bucket;
  JWT_ACCESS_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;
  KAKAO_REST_API_KEY?: string;
  DATA_GO_KR_API_KEY?: string;
  ODSAY_API_KEY?: string;
  APPLE_SHARED_SECRET?: string;
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?: string;
}

export interface RequestContextVariables {
  requestId: string;
  userId?: string;
  sessionId?: string;
}

export type AppBindings = {
  Bindings: Env;
  Variables: RequestContextVariables;
};
