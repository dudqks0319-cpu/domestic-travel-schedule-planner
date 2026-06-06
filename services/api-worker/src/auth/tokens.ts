import type { Env } from "../bindings";

export type TokenKind = "access" | "refresh";

export interface SignedTokenPayload {
  sub: string;
  typ: TokenKind;
  iat: number;
  exp: number;
  sid?: string;
}

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function base64UrlEncode(input: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return atob(padded);
}

function secretFor(env: Env, kind: TokenKind): string {
  const configured = kind === "access" ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET;
  if (configured?.trim()) {
    return configured.trim();
  }

  if (env.ENVIRONMENT === "local") {
    return `tripmate-${env.ENVIRONMENT}-${kind}-secret`;
  }

  throw new Error(`Missing JWT_${kind.toUpperCase()}_SECRET.`);
}

async function hmacSha256(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(signature);
}

export async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signToken(
  env: Env,
  input: { userId: string; kind: TokenKind; sessionId?: string }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = input.kind === "access" ? ACCESS_TOKEN_TTL_SECONDS : REFRESH_TOKEN_TTL_SECONDS;
  const payload: SignedTokenPayload = {
    sub: input.userId,
    typ: input.kind,
    iat: now,
    exp: now + ttl,
    ...(input.sessionId ? { sid: input.sessionId } : {})
  };
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await hmacSha256(signingInput, secretFor(env, input.kind));
  return `${signingInput}.${signature}`;
}

export async function verifyToken(
  env: Env,
  token: string,
  expectedKind: TokenKind
): Promise<SignedTokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = await hmacSha256(signingInput, secretFor(env, expectedKind));
  if (signature !== expectedSignature) {
    return null;
  }

  let payload: SignedTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as SignedTokenPayload;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.typ !== expectedKind || !payload.sub || payload.exp <= now) {
    return null;
  }

  return payload;
}

export function refreshTokenExpiresAt(): string {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}
