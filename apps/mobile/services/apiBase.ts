const DEFAULT_WORKER_API_BASE_URL = "http://localhost:8787/api/v1";

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function readApiBaseUrlFromEnv(): string | undefined {
  const maybeProcess = (
    globalThis as {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process;

  const candidate = maybeProcess?.env?.EXPO_PUBLIC_API_BASE_URL;
  if (typeof candidate !== "string") {
    return undefined;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeApiV1BaseUrl(raw?: string): string {
  const base = (raw ?? "").trim() || DEFAULT_WORKER_API_BASE_URL;

  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error("Invalid API base URL configuration.");
  }

  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopbackHost(parsed.hostname))) {
    throw new Error("Insecure API base URL is blocked. Use HTTPS.");
  }

  const pathname = parsed.pathname.replace(/\/+$/, "");
  const apiPath =
    pathname.endsWith("/api/v1") ? pathname :
    pathname.endsWith("/api") ? `${pathname}/v1` :
    `${pathname}/api/v1`;
  const normalizedPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  return `${parsed.protocol}//${parsed.host}${normalizedPath}`;
}

export function getApiV1BaseUrl(raw?: string): string {
  return normalizeApiV1BaseUrl(raw ?? readApiBaseUrlFromEnv());
}

export function getApiOriginUrl(raw?: string): string {
  const apiBase = new URL(getApiV1BaseUrl(raw));
  return `${apiBase.protocol}//${apiBase.host}`;
}
