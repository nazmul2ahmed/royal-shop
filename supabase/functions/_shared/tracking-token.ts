const TOKEN_BYTES = 32;
const AES_KEY_BYTES = 32;
const GCM_NONCE_BYTES = 12;
const GCM_TAG_BYTES = 16;

export interface EncryptedTrackingToken {
  format: "A256GCM";
  envelope_version: 1;
  nonce: string;
  ciphertext: string;
  tag: string;
}

export interface TrackingKeyConfig {
  activeVersion: number;
  keys: Record<number, string>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new Error("INVALID_BASE64_VALUE");
  }

  const binary = atob(value);

  if (bytesToBase64(
    Uint8Array.from(binary, (character) => character.charCodeAt(0))
  ) !== value) {
    throw new Error("INVALID_BASE64_VALUE");
  }

  return Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0)
  );
}

function validateKeyConfig(config: TrackingKeyConfig): void {
  if (
    !Number.isSafeInteger(config.activeVersion) ||
    config.activeVersion < 1 ||
    !config.keys ||
    typeof config.keys !== "object"
  ) {
    throw new Error("INVALID_TRACKING_KEY_CONFIGURATION");
  }

  const activeKey = config.keys[config.activeVersion];

  if (typeof activeKey !== "string") {
    throw new Error("ACTIVE_TRACKING_KEY_NOT_FOUND");
  }

  for (const [version, encodedKey] of Object.entries(config.keys)) {
    const numericVersion = Number(version);

    if (
      !Number.isSafeInteger(numericVersion) ||
      numericVersion < 1 ||
      typeof encodedKey !== "string"
    ) {
      throw new Error("INVALID_TRACKING_KEY_VERSION");
    }

    const decoded = base64ToBytes(encodedKey);

    if (decoded.length !== AES_KEY_BYTES) {
      throw new Error("INVALID_TRACKING_KEY_LENGTH");
    }
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function importAesKey(
  encodedKey: string,
  usage: KeyUsage[]
): Promise<CryptoKey> {
  const rawKey = base64ToBytes(encodedKey);

  if (rawKey.length !== AES_KEY_BYTES) {
    throw new Error("INVALID_TRACKING_KEY_LENGTH");
  }

  return await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(rawKey),
    { name: "AES-GCM" },
    false,
    usage
  );
}

export function generateTrackingToken(): string {
  const bytes = crypto.getRandomValues(
    new Uint8Array(TOKEN_BYTES)
  );

  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function hashTrackingToken(
  token: string
): Promise<string> {
  if (
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    throw new Error("INVALID_TRACKING_TOKEN");
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeOrderId(orderId: string): string {
  if (
    typeof orderId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)
  ) {
    throw new Error("INVALID_TRACKING_ORDER_ID");
  }

  return orderId.toLowerCase();
}

export async function encryptTrackingToken(
  token: string,
  orderId: string,
  config: TrackingKeyConfig
): Promise<{
  envelope: EncryptedTrackingToken;
  keyVersion: number;
}> {
  validateKeyConfig(config);

  const normalizedOrderId = normalizeOrderId(orderId);
  const additionalData = new TextEncoder().encode(normalizedOrderId);

  await hashTrackingToken(token);

  const keyVersion = config.activeVersion;
  const encodedKey = config.keys[keyVersion];

  const key = await importAesKey(encodedKey, ["encrypt"]);
  const nonce = crypto.getRandomValues(
    new Uint8Array(GCM_NONCE_BYTES)
  );

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce),
      additionalData: toArrayBuffer(additionalData),
      tagLength: GCM_TAG_BYTES * 8,
    },
    key,
    new TextEncoder().encode(token)
  );

  const encryptedBytes = new Uint8Array(encrypted);
  const tagOffset = encryptedBytes.length - GCM_TAG_BYTES;

  return {
    envelope: {
      format: "A256GCM",
      envelope_version: 1,
      nonce: bytesToBase64(nonce),
      ciphertext: bytesToBase64(
        encryptedBytes.slice(0, tagOffset)
      ),
      tag: bytesToBase64(
        encryptedBytes.slice(tagOffset)
      ),
    },
    keyVersion,
  };
}

export async function decryptTrackingToken(
  envelope: EncryptedTrackingToken,
  keyVersion: number,
  config: TrackingKeyConfig,
  expectedTokenHash: string,
  orderId: string
): Promise<string> {
  validateKeyConfig(config);

  const normalizedOrderId = normalizeOrderId(orderId);
  const additionalData = new TextEncoder().encode(normalizedOrderId);

  if (
    !envelope ||
    typeof envelope !== "object" ||
    envelope.format !== "A256GCM" ||
    envelope.envelope_version !== 1 ||
    !Number.isSafeInteger(keyVersion) ||
    keyVersion < 1
  ) {
    throw new Error("INVALID_TRACKING_ENVELOPE");
  }

  const encodedKey = config.keys[keyVersion];

  if (!encodedKey) {
    throw new Error("TRACKING_KEY_VERSION_NOT_AVAILABLE");
  }

  const nonce = base64ToBytes(envelope.nonce);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const tag = base64ToBytes(envelope.tag);

  if (
    nonce.length !== GCM_NONCE_BYTES ||
    ciphertext.length === 0 ||
    tag.length !== GCM_TAG_BYTES
  ) {
    throw new Error("INVALID_TRACKING_ENVELOPE");
  }

  const combined = new Uint8Array(
    ciphertext.length + tag.length
  );

  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  const key = await importAesKey(encodedKey, ["decrypt"]);

  let decrypted: ArrayBuffer;

  try {
    decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(nonce),
        additionalData: toArrayBuffer(additionalData),
        tagLength: GCM_TAG_BYTES * 8,
      },
      key,
      combined
    );
  } catch {
    throw new Error("TRACKING_TOKEN_DECRYPTION_FAILED");
  }

  const token = new TextDecoder("utf-8", {
    fatal: true,
  }).decode(decrypted);

  const actualHash = await hashTrackingToken(token);

  if (
    typeof expectedTokenHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(expectedTokenHash) ||
    actualHash !== expectedTokenHash
  ) {
    throw new Error("TRACKING_TOKEN_HASH_MISMATCH");
  }

  return token;
}



