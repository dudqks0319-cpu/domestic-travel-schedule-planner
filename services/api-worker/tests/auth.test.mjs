import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyAccessToken } from "../dist/auth.js";

const jwtSecret = "unit-auth-secret";

describe("verifyAccessToken", () => {
  it("accepts a valid HS256 access token with configured issuer and audience", async () => {
    const token = await createJwt({
      sub: "user_a",
      iss: "tripmate-local",
      aud: "tripmate-mobile",
      exp: Math.floor(Date.now() / 1000) + 3600
    });

    const result = await verifyAccessToken(token, {
      JWT_ACCESS_SECRET: jwtSecret,
      JWT_ISSUER: "tripmate-local",
      JWT_AUDIENCE: "tripmate-mobile"
    });

    assert.equal(result.ok, true);
    assert.equal(result.user.id, "user_a");
  });

  it("accepts an allowed audience from an array claim", async () => {
    const token = await createJwt({
      sub: "user_a",
      iss: "tripmate-local",
      aud: ["legacy-mobile", "tripmate-mobile"],
      exp: Math.floor(Date.now() / 1000) + 3600
    });

    const result = await verifyAccessToken(token, {
      JWT_ACCESS_SECRET: jwtSecret,
      JWT_ISSUER: "tripmate-local",
      JWT_AUDIENCE: "tripmate-web, tripmate-mobile"
    });

    assert.equal(result.ok, true);
  });

  it("rejects expired, wrong issuer, and wrong audience tokens deterministically", async () => {
    const expired = await verifyAccessToken(
      await createJwt({
        sub: "user_a",
        iss: "tripmate-local",
        aud: "tripmate-mobile",
        exp: Math.floor(Date.now() / 1000) - 1
      }),
      authEnv()
    );
    assert.deepEqual(pickFailure(expired), { status: 401, code: "token_expired" });

    const wrongIssuer = await verifyAccessToken(
      await createJwt({
        sub: "user_a",
        iss: "wrong-issuer",
        aud: "tripmate-mobile",
        exp: Math.floor(Date.now() / 1000) + 3600
      }),
      authEnv()
    );
    assert.deepEqual(pickFailure(wrongIssuer), { status: 401, code: "invalid_token" });

    const wrongAudience = await verifyAccessToken(
      await createJwt({
        sub: "user_a",
        iss: "tripmate-local",
        aud: "wrong-audience",
        exp: Math.floor(Date.now() / 1000) + 3600
      }),
      authEnv()
    );
    assert.deepEqual(pickFailure(wrongAudience), { status: 401, code: "invalid_token" });
  });

  it("fails closed when auth is unconfigured or token shape is invalid", async () => {
    const missingSecret = await verifyAccessToken("header.payload.signature", {});
    assert.deepEqual(pickFailure(missingSecret), { status: 503, code: "auth_unconfigured" });

    const malformed = await verifyAccessToken("not-a-jwt", authEnv());
    assert.deepEqual(pickFailure(malformed), { status: 401, code: "invalid_token" });

    const wrongAlgorithm = await verifyAccessToken(
      await createJwt(
        {
          sub: "user_a",
          iss: "tripmate-local",
          aud: "tripmate-mobile",
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        { alg: "none", typ: "JWT" }
      ),
      authEnv()
    );
    assert.deepEqual(pickFailure(wrongAlgorithm), { status: 401, code: "invalid_token" });
  });
});

function authEnv() {
  return {
    JWT_ACCESS_SECRET: jwtSecret,
    JWT_ISSUER: "tripmate-local",
    JWT_AUDIENCE: "tripmate-mobile"
  };
}

function pickFailure(result) {
  assert.equal(result.ok, false);
  return { status: result.status, code: result.code };
}

async function createJwt(payload, header = { alg: "HS256", typ: "JWT" }) {
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHs256(signingInput, jwtSecret);
  return `${signingInput}.${encodeBytesBase64Url(signature)}`;
}

async function signHs256(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function encodeBase64Url(value) {
  return encodeBytesBase64Url(new TextEncoder().encode(value));
}

function encodeBytesBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
