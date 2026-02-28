import "dotenv/config";

export type NodeEnv = "development" | "test" | "production";

export interface EnvConfig {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  apiPrefix: string;
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  // 외부 API 키
  kakaoRestApiKey: string;
  kakaoNativeAppKey: string;
  naverClientId: string;
  naverClientSecret: string;
  dataGoKrApiKey: string;
  kmaApiKey: string;
  odsayApiKey: string;
  jusoSearchApiKey: string;
  jusoMobileApiKey: string;
}

function getRequired(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function getOptional(name: string, fallback = ""): string {
  const value = process.env[name];

  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed === "" ? fallback : trimmed;
}

function getNodeEnv(): NodeEnv {
  const raw = (process.env.NODE_ENV ?? "development").toLowerCase();

  if (raw === "development" || raw === "test" || raw === "production") {
    return raw;
  }

  throw new Error(`Invalid NODE_ENV: ${raw}`);
}

function getPort(): number {
  const raw = process.env.PORT ?? "4000";
  const parsed = Number.parseInt(raw, 10);

  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid PORT: ${raw}`);
  }

  return parsed;
}

function normalizeApiPrefix(rawPrefix: string): string {
  const trimmed = rawPrefix.trim();

  if (!trimmed.startsWith("/")) {
    return `/${trimmed}`;
  }

  return trimmed;
}

export const env: EnvConfig = {
  nodeEnv: getNodeEnv(),
  host: getRequired("HOST", "0.0.0.0"),
  port: getPort(),
  apiPrefix: normalizeApiPrefix(getRequired("API_PREFIX", "/api/v1")),
  databaseUrl: getRequired("DATABASE_URL"),
  jwtAccessSecret: getRequired("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: getRequired("JWT_REFRESH_SECRET"),
  kakaoRestApiKey: getOptional("KAKAO_REST_API_KEY"),
  kakaoNativeAppKey: getOptional("KAKAO_NATIVE_APP_KEY"),
  naverClientId: getOptional("NAVER_CLIENT_ID"),
  naverClientSecret: getOptional("NAVER_CLIENT_SECRET"),
  dataGoKrApiKey: getRequired("DATA_GO_KR_API_KEY"),
  kmaApiKey: getOptional("KMA_API_KEY"),
  odsayApiKey: getOptional("ODSAY_API_KEY"),
  jusoSearchApiKey: getOptional("JUSO_SEARCH_API_KEY"),
  jusoMobileApiKey: getOptional("JUSO_MOBILE_API_KEY")
};
