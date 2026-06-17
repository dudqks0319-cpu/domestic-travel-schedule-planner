export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: Record<string, unknown>;
  error?: string;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}

export interface KVNamespace {
  get(key: string, options?: { type?: "text" | "json" | "arrayBuffer" | "stream" }): Promise<unknown>;
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface R2Bucket {
  get(key: string): Promise<unknown>;
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream | string): Promise<unknown>;
  delete(key: string | string[]): Promise<void>;
}

export interface Env {
  DB: D1Database;
  PROVIDER_CACHE: KVNamespace;
  SHARE_ASSETS: R2Bucket;
  ENVIRONMENT?: string;
  CORS_ALLOWED_ORIGINS?: string;
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

export interface RequestContext {
  requestId: string;
  env: Env;
  authenticated: boolean;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
