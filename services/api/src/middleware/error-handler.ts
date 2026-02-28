import { NextFunction, Request, Response } from "express";
import {
  normalizeInternalErrorMessage,
  sanitizePublicText
} from "../utils/response-safety";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const message = err instanceof Error ? sanitizePublicText(err.message) : "unknown";
  console.error(`[api] unhandled error: ${message || "unknown"}`);

  res.status(500).json({
    error: "Internal Server Error",
    message: normalizeInternalErrorMessage()
  });
}
