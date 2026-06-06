import { Hono } from "hono";

import type { AppBindings } from "../bindings";

export const healthRoutes = new Hono<AppBindings>();

healthRoutes.get("/", (c) =>
  c.json({
    ok: true,
    service: "tripmate-api-worker",
    environment: c.env.ENVIRONMENT,
    version: c.env.API_VERSION,
    requestId: c.get("requestId")
  })
);
