import type { Context } from "hono";

import type { AppBindings } from "../bindings";

export interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export function errorResponse(
  c: Context<AppBindings>,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 501,
  code: string,
  message: string
): Response {
  const requestId = c.get("requestId") ?? "unknown";
  return c.json<ApiErrorBody>(
    {
      ok: false,
      error: {
        code,
        message,
        requestId
      }
    },
    status
  );
}

export function notImplemented(c: Context<AppBindings>, feature: string): Response {
  return errorResponse(
    c,
    501,
    "NOT_IMPLEMENTED",
    `${feature} API는 Phase 5 이후 구현됩니다.`
  );
}
