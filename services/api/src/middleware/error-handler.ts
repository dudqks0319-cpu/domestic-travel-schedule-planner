import { NextFunction, Request, Response } from "express";
import { normalizeInternalErrorMessage } from "../utils/response-safety";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[api] unhandled error", err);

  res.status(500).json({
    error: "Internal Server Error",
    message: normalizeInternalErrorMessage()
  });
}
