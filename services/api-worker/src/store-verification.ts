import type { Env } from "./types.js";

export interface EntitlementStoreInput {
  store: "apple" | "google";
  productId: string;
  transactionId: string;
  receiptData: string | null;
}

export type StoreVerificationResult =
  | {
      status: "verified";
      expiresAt: string | null;
      providerStatus: string;
    }
  | {
      status: "pending";
      providerStatus: string;
      reason: string;
    }
  | {
      status: "failed";
      providerStatus: string;
      reason: string;
    };

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

interface AppleVerifyReceiptResponse {
  status?: unknown;
  latest_receipt_info?: unknown;
  receipt?: unknown;
}

interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const APPLE_VERIFY_RECEIPT_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_VERIFY_RECEIPT_URL = "https://sandbox.itunes.apple.com/verifyReceipt";
const GOOGLE_ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ANDROID_PUBLISHER_BASE_URL = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const PKCS8_PRIVATE_KEY_BEGIN = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
const PKCS8_PRIVATE_KEY_END = ["-----END", "PRIVATE KEY-----"].join(" ");

export async function verifyStorePurchase(
  input: EntitlementStoreInput,
  env: Env,
  fetcher: Fetcher = fetch
): Promise<StoreVerificationResult> {
  return input.store === "apple"
    ? verifyApplePurchase(input, env, fetcher)
    : verifyGooglePurchase(input, env, fetcher);
}

async function verifyApplePurchase(
  input: EntitlementStoreInput,
  env: Env,
  fetcher: Fetcher
): Promise<StoreVerificationResult> {
  const sharedSecret = env.APPLE_SHARED_SECRET?.trim();
  if (!sharedSecret || !input.receiptData) {
    return {
      status: "pending",
      providerStatus: "apple_not_configured",
      reason: "Apple receipt verification requires APPLE_SHARED_SECRET and receiptData."
    };
  }

  const productionResult = await postAppleVerifyReceipt(
    APPLE_VERIFY_RECEIPT_URL,
    sharedSecret,
    input.receiptData,
    fetcher
  );
  if (productionResult instanceof Response) {
    return {
      status: "pending",
      providerStatus: `apple_http_${productionResult.status}`,
      reason: "Apple receipt verification request failed."
    };
  }

  const receipt = productionResult.status === 21007
    ? await postAppleVerifyReceipt(APPLE_SANDBOX_VERIFY_RECEIPT_URL, sharedSecret, input.receiptData, fetcher)
    : productionResult;

  if (receipt instanceof Response) {
    return {
      status: "pending",
      providerStatus: `apple_http_${receipt.status}`,
      reason: "Apple sandbox receipt verification request failed."
    };
  }

  if (receipt.status !== 0) {
    return {
      status: "failed",
      providerStatus: `apple_status_${String(receipt.status)}`,
      reason: "Apple did not verify the receipt."
    };
  }

  const purchasedItem = findAppleReceiptItem(receipt, input.productId, input.transactionId);
  if (!purchasedItem) {
    return {
      status: "failed",
      providerStatus: "apple_transaction_mismatch",
      reason: "Apple receipt did not contain the requested product and transaction."
    };
  }

  if (purchasedItem.expiresAt && Date.parse(purchasedItem.expiresAt) <= Date.now()) {
    return {
      status: "failed",
      providerStatus: "apple_expired",
      reason: "Apple receipt is expired."
    };
  }

  return {
    status: "verified",
    providerStatus: "apple_verified",
    expiresAt: purchasedItem.expiresAt
  };
}

async function verifyGooglePurchase(
  input: EntitlementStoreInput,
  env: Env,
  fetcher: Fetcher
): Promise<StoreVerificationResult> {
  const packageName = env.GOOGLE_PLAY_PACKAGE_NAME?.trim();
  const serviceAccount = parseGoogleServiceAccount(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
  if (!packageName || !serviceAccount) {
    return {
      status: "pending",
      providerStatus: "google_not_configured",
      reason: "Google Play verification requires GOOGLE_PLAY_PACKAGE_NAME and GOOGLE_PLAY_SERVICE_ACCOUNT_JSON."
    };
  }

  const accessToken = await fetchGoogleAccessToken(serviceAccount, fetcher);
  if (!accessToken) {
    return {
      status: "pending",
      providerStatus: "google_oauth_failed",
      reason: "Google OAuth access token request failed."
    };
  }

  const purchaseUrl = `${GOOGLE_ANDROID_PUBLISHER_BASE_URL}/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(input.transactionId)}`;
  const response = await fetcher(purchaseUrl, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return {
      status: response.status >= 500 ? "pending" : "failed",
      providerStatus: `google_http_${response.status}`,
      reason: "Google Play subscription verification request failed."
    };
  }

  const body = await readJsonObject(response);
  if (!body) {
    return {
      status: "pending",
      providerStatus: "google_invalid_json",
      reason: "Google Play returned an invalid response."
    };
  }

  const state = getString(body.subscriptionState);
  const lineItem = findGoogleLineItem(body, input.productId);
  if (!lineItem) {
    return {
      status: "failed",
      providerStatus: "google_product_mismatch",
      reason: "Google Play purchase did not contain the requested product."
    };
  }

  if (state !== "SUBSCRIPTION_STATE_ACTIVE") {
    return {
      status: "failed",
      providerStatus: state ? `google_${state.toLowerCase()}` : "google_state_missing",
      reason: "Google Play subscription is not active."
    };
  }

  if (!lineItem.expiresAt || Date.parse(lineItem.expiresAt) <= Date.now()) {
    return {
      status: "failed",
      providerStatus: "google_expired",
      reason: "Google Play subscription is expired or missing an expiry time."
    };
  }

  return {
    status: "verified",
    providerStatus: "google_verified",
    expiresAt: lineItem.expiresAt
  };
}

async function postAppleVerifyReceipt(
  url: string,
  sharedSecret: string,
  receiptData: string,
  fetcher: Fetcher
): Promise<AppleVerifyReceiptResponse | Response> {
  const response = await fetcher(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      "receipt-data": receiptData,
      password: sharedSecret,
      "exclude-old-transactions": true
    })
  });

  if (!response.ok) {
    return response;
  }

  const body = await readJsonObject(response);
  if (!body) {
    return { status: "invalid_json" };
  }

  return body;
}

async function fetchGoogleAccessToken(
  serviceAccount: GoogleServiceAccount,
  fetcher: Fetcher
): Promise<string | null> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenUrl = serviceAccount.token_uri || GOOGLE_OAUTH_TOKEN_URL;
  const assertion = await signGoogleServiceAccountJwt(
    {
      iss: serviceAccount.client_email,
      scope: GOOGLE_ANDROID_PUBLISHER_SCOPE,
      aud: tokenUrl,
      iat: nowSeconds,
      exp: nowSeconds + 3600
    },
    serviceAccount.private_key
  );

  const response = await fetcher(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }).toString()
  });

  if (!response.ok) {
    return null;
  }

  const body = await readJsonObject(response);
  return body ? getString(body.access_token) : null;
}

async function signGoogleServiceAccountJwt(payload: Record<string, unknown>, privateKeyPem: string): Promise<string> {
  const encodedHeader = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const encodedPayload = base64UrlJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    decodePkcs8Pem(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(signingInput))
  );
  return `${signingInput}.${base64UrlBytes(signature)}`;
}

function findAppleReceiptItem(
  response: AppleVerifyReceiptResponse,
  productId: string,
  transactionId: string
): { expiresAt: string | null } | null {
  const candidates = [
    ...receiptInfoArray(response.latest_receipt_info),
    ...receiptInfoArray(isRecord(response.receipt) ? response.receipt.in_app : undefined)
  ];

  for (const candidate of candidates) {
    const candidateProductId = getString(candidate.product_id);
    const candidateTransactionId = getString(candidate.transaction_id);
    const candidateOriginalTransactionId = getString(candidate.original_transaction_id);
    if (
      candidateProductId === productId &&
      (candidateTransactionId === transactionId || candidateOriginalTransactionId === transactionId)
    ) {
      return { expiresAt: appleExpiryToIso(candidate.expires_date_ms) };
    }
  }

  return null;
}

function findGoogleLineItem(
  response: Record<string, unknown>,
  productId: string
): { expiresAt: string | null } | null {
  const lineItems = response.lineItems;
  if (!Array.isArray(lineItems)) {
    return null;
  }

  for (const item of lineItems) {
    if (!isRecord(item)) {
      continue;
    }

    if (getString(item.productId) === productId) {
      return { expiresAt: getString(item.expiryTime) };
    }
  }

  return null;
}

function receiptInfoArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
}

function appleExpiryToIso(value: unknown): string | null {
  const text = getString(value);
  if (!text) {
    return null;
  }

  const millis = Number.parseInt(text, 10);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

async function readJsonObject(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await response.json();
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseGoogleServiceAccount(value: string | undefined): GoogleServiceAccount | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) {
      return null;
    }

    const clientEmail = getString(parsed.client_email);
    const privateKey = getString(parsed.private_key);
    const tokenUri = getString(parsed.token_uri) || undefined;
    return clientEmail && privateKey ? { client_email: clientEmail, private_key: privateKey, token_uri: tokenUri } : null;
  } catch {
    return null;
  }
}

function decodePkcs8Pem(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(PKCS8_PRIVATE_KEY_BEGIN, "")
    .replace(PKCS8_PRIVATE_KEY_END, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function base64UrlJson(value: Record<string, unknown>): string {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
