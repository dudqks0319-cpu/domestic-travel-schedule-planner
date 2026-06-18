import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { verifyStorePurchase } from "../dist/store-verification.js";

describe("verifyStorePurchase", () => {
  it("verifies an active Apple subscription without storing the receipt", async () => {
    const expiresAt = Date.now() + 86_400_000;
    const calls = [];
    const result = await verifyStorePurchase(
      {
        store: "apple",
        productId: "tripmate_pro_monthly",
        transactionId: "apple-tx-0001",
        receiptData: "opaque-apple-receipt"
      },
      { APPLE_SHARED_SECRET: "apple-shared-secret" },
      async (url, init) => {
        calls.push({ url, body: JSON.parse(String(init?.body)) });
        return jsonResponse({
          status: 0,
          latest_receipt_info: [
            {
              product_id: "tripmate_pro_monthly",
              transaction_id: "apple-tx-0001",
              original_transaction_id: "apple-original-0001",
              expires_date_ms: String(expiresAt)
            }
          ]
        });
      }
    );

    assert.deepEqual(result, {
      status: "verified",
      providerStatus: "apple_verified",
      expiresAt: new Date(expiresAt).toISOString()
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://buy.itunes.apple.com/verifyReceipt");
    assert.equal(calls[0].body["receipt-data"], "opaque-apple-receipt");
    assert.equal(calls[0].body.password, "apple-shared-secret");
  });

  it("falls back to Apple sandbox when production returns sandbox receipt status", async () => {
    const expiresAt = Date.now() + 86_400_000;
    const urls = [];
    const result = await verifyStorePurchase(
      {
        store: "apple",
        productId: "tripmate_pro_monthly",
        transactionId: "apple-original-0001",
        receiptData: "opaque-apple-receipt"
      },
      { APPLE_SHARED_SECRET: "apple-shared-secret" },
      async (url) => {
        urls.push(url);
        if (url.includes("buy.itunes.apple.com")) {
          return jsonResponse({ status: 21007 });
        }
        return jsonResponse({
          status: 0,
          receipt: {
            in_app: [
              {
                product_id: "tripmate_pro_monthly",
                transaction_id: "apple-tx-0001",
                original_transaction_id: "apple-original-0001",
                expires_date_ms: String(expiresAt)
              }
            ]
          }
        });
      }
    );

    assert.equal(result.status, "verified");
    assert.deepEqual(urls, [
      "https://buy.itunes.apple.com/verifyReceipt",
      "https://sandbox.itunes.apple.com/verifyReceipt"
    ]);
  });

  it("keeps Apple verification pending when the shared secret or receipt is missing", async () => {
    const result = await verifyStorePurchase(
      {
        store: "apple",
        productId: "tripmate_pro_monthly",
        transactionId: "apple-tx-0001",
        receiptData: null
      },
      {},
      async () => {
        throw new Error("fetch should not be called when Apple verification is unconfigured");
      }
    );

    assert.equal(result.status, "pending");
    assert.equal(result.providerStatus, "apple_not_configured");
  });

  it("fails closed when Apple receipt product or transaction does not match", async () => {
    const result = await verifyStorePurchase(
      {
        store: "apple",
        productId: "tripmate_pro_monthly",
        transactionId: "apple-tx-0001",
        receiptData: "opaque-apple-receipt"
      },
      { APPLE_SHARED_SECRET: "apple-shared-secret" },
      async () =>
        jsonResponse({
          status: 0,
          latest_receipt_info: [
            {
              product_id: "other_product",
              transaction_id: "apple-tx-0001",
              expires_date_ms: String(Date.now() + 86_400_000)
            }
          ]
        })
    );

    assert.equal(result.status, "failed");
    assert.equal(result.providerStatus, "apple_transaction_mismatch");
  });

  it("verifies an active Google Play subscription with a service account", async () => {
    const serviceAccount = createServiceAccount();
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const calls = [];
    const result = await verifyStorePurchase(
      {
        store: "google",
        productId: "tripmate_pro_monthly",
        transactionId: "google-token-0001",
        receiptData: null
      },
      {
        GOOGLE_PLAY_PACKAGE_NAME: "com.tripmate.app",
        GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount)
      },
      async (url, init) => {
        calls.push({ url, init });
        if (url === "https://oauth2.googleapis.com/token") {
          assert.equal(init?.method, "POST");
          assert.match(String(init?.body), /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer/);
          return jsonResponse({ access_token: "google-access-token", token_type: "Bearer" });
        }

        assert.equal(
          url,
          "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.tripmate.app/purchases/subscriptionsv2/tokens/google-token-0001"
        );
        assert.equal(init?.headers?.authorization, "Bearer google-access-token");
        return jsonResponse({
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          lineItems: [
            {
              productId: "tripmate_pro_monthly",
              expiryTime: expiresAt
            }
          ]
        });
      }
    );

    assert.deepEqual(result, {
      status: "verified",
      providerStatus: "google_verified",
      expiresAt
    });
    assert.equal(calls.length, 2);
  });

  it("keeps Google verification pending when Play configuration is missing", async () => {
    const result = await verifyStorePurchase(
      {
        store: "google",
        productId: "tripmate_pro_monthly",
        transactionId: "google-token-0001",
        receiptData: null
      },
      {},
      async () => {
        throw new Error("fetch should not be called when Google verification is unconfigured");
      }
    );

    assert.equal(result.status, "pending");
    assert.equal(result.providerStatus, "google_not_configured");
  });

  it("fails closed when Google Play subscription is expired or not active", async () => {
    const serviceAccount = createServiceAccount();
    const result = await verifyStorePurchase(
      {
        store: "google",
        productId: "tripmate_pro_monthly",
        transactionId: "google-token-0001",
        receiptData: null
      },
      {
        GOOGLE_PLAY_PACKAGE_NAME: "com.tripmate.app",
        GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount)
      },
      async (url) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return jsonResponse({ access_token: "google-access-token" });
        }

        return jsonResponse({
          subscriptionState: "SUBSCRIPTION_STATE_EXPIRED",
          lineItems: [
            {
              productId: "tripmate_pro_monthly",
              expiryTime: new Date(Date.now() - 86_400_000).toISOString()
            }
          ]
        });
      }
    );

    assert.equal(result.status, "failed");
    assert.equal(result.providerStatus, "google_subscription_state_expired");
  });
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function createServiceAccount() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  return {
    type: "service_account",
    client_email: "tripmate-worker@example.iam.gserviceaccount.com",
    private_key: pem,
    token_uri: "https://oauth2.googleapis.com/token"
  };
}
