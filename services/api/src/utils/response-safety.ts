const SENSITIVE_ENV_KEY_PATTERN = /(key|token|secret|password|passwd|private|auth)/i;
const MAX_PUBLIC_MESSAGE_LENGTH = 180;
const REDACTED = "[REDACTED]";

const SAFE_ROUTE_ERROR_MESSAGES = new Set<string>([
  "Route optimization requires at least two points."
]);

let cachedSensitiveEnvValues: string[] | null = null;

function getSensitiveEnvValues(): string[] {
  if (cachedSensitiveEnvValues) {
    return cachedSensitiveEnvValues;
  }

  const values = Object.entries(process.env)
    .filter(([key, value]) => SENSITIVE_ENV_KEY_PATTERN.test(key) && typeof value === "string")
    .map(([, value]) => String(value).trim())
    .filter((value) => value.length >= 6)
    .sort((a, b) => b.length - a.length);

  cachedSensitiveEnvValues = values;
  return values;
}

function limitMessage(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

export function sanitizePublicText(raw: string): string {
  const normalized = raw.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  let redacted = normalized
    .replace(
      /\b(Bearer|Basic|KakaoAK)\s+[^\s]+/gi,
      (_matched: string, scheme: string) => `${scheme} ${REDACTED}`
    )
    .replace(/([?&](api[_-]?key|key|token|secret|password)=)[^&\s]+/gi, `$1${REDACTED}`);

  for (const sensitiveValue of getSensitiveEnvValues()) {
    if (redacted.includes(sensitiveValue)) {
      redacted = redacted.split(sensitiveValue).join(REDACTED);
    }
  }

  return limitMessage(redacted, MAX_PUBLIC_MESSAGE_LENGTH);
}

export function normalizeRouteWarning(raw: string, fallback: string): string {
  const sanitized = sanitizePublicText(raw);
  return sanitized || fallback;
}

export function normalizeRouteErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const sanitized = sanitizePublicText(error.message);
    if (SAFE_ROUTE_ERROR_MESSAGES.has(sanitized)) {
      return sanitized;
    }
  }

  return "Failed to optimize route.";
}

export function normalizeInternalErrorMessage(): string {
  return "Unexpected error.";
}
