import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, TokenPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "인증 토큰이 필요합니다" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
  }
}
