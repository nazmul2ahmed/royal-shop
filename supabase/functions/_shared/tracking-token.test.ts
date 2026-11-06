import {
  generateTrackingToken,
  hashTrackingToken,
  encryptTrackingToken,
  decryptTrackingToken,
} from "./tracking-token.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const ORDER_ID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER_ORDER_ID = "123e4567-e89b-42d3-a456-426614174001";

function makeConfig(fill: number) {
  const key = btoa(
    String.fromCharCode(...new Uint8Array(32).fill(fill)),
  );

  return { activeVersion: 1, keys: { 1: key } };
}

Deno.test("tracking token encryption round-trip with order-bound AAD", async () => {
  const config = makeConfig(7);
  const token = generateTrackingToken();
  const hash = await hashTrackingToken(token);

  const encrypted = await encryptTrackingToken(
    token,
    ORDER_ID,
    config,
  );

  const decrypted = await decryptTrackingToken(
    encrypted.envelope,
    encrypted.keyVersion,
    config,
    hash,
    ORDER_ID,
  );

  assert(token === decrypted, "Decrypted token does not match.");
  assert(/^[a-f0-9]{64}$/.test(hash), "Invalid SHA-256 hash.");
  assert(encrypted.envelope.nonce.length === 16, "Invalid nonce.");
  assert(encrypted.envelope.tag.length === 24, "Invalid GCM tag.");
});

Deno.test("tracking token rejects an incorrect key", async () => {
  const config1 = makeConfig(7);
  const config2 = makeConfig(9);

  const token = generateTrackingToken();
  const tokenHash = await hashTrackingToken(token);

  const encrypted = await encryptTrackingToken(
    token,
    ORDER_ID,
    config1,
  );

  let rejected = false;

  try {
    await decryptTrackingToken(
      encrypted.envelope,
      1,
      config2,
      tokenHash,
      ORDER_ID,
    );
  } catch {
    rejected = true;
  }

  assert(rejected, "Incorrect key was unexpectedly accepted.");
});

Deno.test("tracking token rejects an incorrect expected hash", async () => {
  const config = makeConfig(7);
  const token = generateTrackingToken();

  const encrypted = await encryptTrackingToken(
    token,
    ORDER_ID,
    config,
  );

  let rejected = false;

  try {
    await decryptTrackingToken(
      encrypted.envelope,
      encrypted.keyVersion,
      config,
      "0".repeat(64),
      ORDER_ID,
    );
  } catch {
    rejected = true;
  }

  assert(rejected, "Incorrect expected hash was unexpectedly accepted.");
});

Deno.test("tracking token rejects decryption with another order ID", async () => {
  const config = makeConfig(7);
  const token = generateTrackingToken();
  const tokenHash = await hashTrackingToken(token);

  const encrypted = await encryptTrackingToken(
    token,
    ORDER_ID,
    config,
  );

  let rejected = false;

  try {
    await decryptTrackingToken(
      encrypted.envelope,
      encrypted.keyVersion,
      config,
      tokenHash,
      OTHER_ORDER_ID,
    );
  } catch {
    rejected = true;
  }

  assert(rejected, "Token was accepted for a different order ID.");
});

Deno.test("tracking token rejects an invalid order ID", async () => {
  const config = makeConfig(7);
  const token = generateTrackingToken();

  let rejected = false;

  try {
    await encryptTrackingToken(
      token,
      "not-a-valid-uuid",
      config,
    );
  } catch {
    rejected = true;
  }

  assert(rejected, "Invalid order ID was unexpectedly accepted.");
});
