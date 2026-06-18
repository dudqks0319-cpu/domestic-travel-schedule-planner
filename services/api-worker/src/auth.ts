import type { AuthenticatedUser, Env } from "./types.js";

interface AuthSuccess {
  ok: true;
  user: AuthenticatedUser;
}

interface AuthFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

type AuthResult = AuthSuccess | AuthFailure;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function verifyAccessToken(token: string, env: Env): Promise<AuthResult> {
  const secret = env.JWT_ACCESS_SECRET?.trim();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      code: "auth_unconfigured",
      message: "Authentication is not configured for this environment."
    };
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return invalidToken();
  }

  const header = decodeJsonObject(parts[0]);
  const payload = decodeJsonObject(parts[1]);
  if (!header || !payload || header.alg !== "HS256") {
    return invalidToken();
  }

  const signingInput = `${parts[0]}.${parts[1]}`;
  const expectedSignature = await signHs256(signingInput, secret);
  const actualSignature = decodeBase64Url(parts[2]);
  if (!actualSignature || !constantTimeEqual(expectedSignature, actualSignature)) {
    return invalidToken();
  }

  const subject = getString(payload.sub);
  if (!subject) {
    return invalidToken();
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = getNumber(payload.exp);
  if (typeof expiresAt === "number" && nowSeconds >= expiresAt) {
    return {
      ok: false,
      status: 401,
      code: "token_expired",
      message: "The access token has expired."
    };
  }

  const notBefore = getNumber(payload.nbf);
  if (typeof notBefore === "number" && nowSeconds < notBefore) {
    return invalidToken();
  }

  const issuerPolicy = env.JWT_ISSUER?.trim();
  if (issuerPolicy && payload.iss !== issuerPolicy) {
    return invalidToken();
  }

  const audiencePolicy = parseAudiencePolicy(env.JWT_AUDIENCE);
  if (audiencePolicy.length > 0 && !audienceMatches(payload.aud, audiencePolicy)) {
    return invalidToken();
  }

  return {
    ok: true,
    user: {
      id: subject,
      subject
    }
  };
}

function invalidToken(): AuthFailure {
  return {
    ok: false,
    status: 401,
    code: "invalid_token",
    message: "The bearer access token is invalid."
  };
}

async function signHs256(value: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(value)));
}

function decodeJsonObject(value: string): Record<string, unknown> | undefined {
  const bytes = decodeBase64Url(value);
  if (!bytes) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(textDecoder.decode(bytes));
    if (!isRecord(parsed)) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function decodeBase64Url(value: string): Uint8Array | undefined {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return undefined;
  }
}

function constantTimeEqual(expected: Uint8Array, actual: Uint8Array): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected[index] ^ actual[index];
  }

  return diff === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseAudiencePolicy(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function audienceMatches(value: unknown, allowedAudiences: string[]): boolean {
  if (typeof value === "string") {
    return allowedAudiences.includes(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => typeof item === "string" && allowedAudiences.includes(item));
  }

  return false;
}
