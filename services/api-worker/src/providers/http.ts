const DEFAULT_PROVIDER_TIMEOUT_MS = 4500;

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
