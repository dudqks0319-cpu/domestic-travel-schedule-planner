import { Router } from "express";

const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "tripmate-api",
    timestamp: new Date().toISOString()
  });
});

export { healthRouter };
