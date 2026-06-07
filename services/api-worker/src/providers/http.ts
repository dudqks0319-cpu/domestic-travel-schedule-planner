const DEFAULT_PROVIDER_TIMEOUT_MS = 4500;

export type ProviderFailureKind =
  | "client_error"
  | "network_error"
  | "rate_limited"
  | "server_error"
  | "timeout"
  | "unknown";

export class ProviderHttpError extends Error {
  readonly statusCode: number;
  readonly failureKind: ProviderFailureKind;

  constructor(statusCode: number) {
    super(`Provider HTTP request failed with status ${statusCode}`);
    this.name = "ProviderHttpError";
    this.statusCode = statusCode;
    this.failureKind = providerFailureKindFromStatus(statusCode);
  }
}

export function providerFailureKindFromStatus(statusCode: number): ProviderFailureKind {
  if (statusCode === 429) {
    return "rate_limited";
  }
  if (statusCode >= 500) {
    return "server_error";
  }
  if (statusCode >= 400) {
    return "client_error";
  }
  return "unknown";
}

export function providerHttpError(response: Response): ProviderHttpError {
  return new ProviderHttpError(response.status);
}

export function classifyProviderError(error: unknown): {
  failureKind: ProviderFailureKind;
  providerStatusCode?: number;
} {
  if (error instanceof ProviderHttpError) {
    return {
      failureKind: error.failureKind,
      providerStatusCode: error.statusCode
    };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return { failureKind: "timeout" };
  }

  if (error instanceof TypeError) {
    return { failureKind: "network_error" };
  }

  return { failureKind: "unknown" };
}

export async function fetchProvider(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
