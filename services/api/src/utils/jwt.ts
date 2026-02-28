import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface TokenPayload {
  userId: string;
  kakaoId: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: "1h" });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as TokenPayload;
}
