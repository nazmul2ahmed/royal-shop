import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";
import {
  decryptTrackingToken,
  encryptTrackingToken,
  generateTrackingToken,
  hashTrackingToken,
  type EncryptedTrackingToken,
  type TrackingKeyConfig,
} from "../_shared/tracking-token.ts";

interface OrderRequest {
  idempotencyKey: string;
  name: string;
  phone: string;
  district: string;
  upazila: string;
  area?: string;
  address: string;
  customer_note?: string;
  items: Array<{
    id: string;
    quantity: number;
  }>;
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function loadTrackingKeyConfig(): TrackingKeyConfig {
  const activeVersionRaw = Deno.env.get(
    "TRACKING_TOKEN_ACTIVE_KEY_VERSION"
  );

  if (!activeVersionRaw || !/^[1-9]\d*$/.test(activeVersionRaw)) {
    throw new Error("INVALID_TRACKING_KEY_CONFIGURATION");
  }

  const activeVersion = Number(activeVersionRaw);

  if (!Number.isSafeInteger(activeVersion) || activeVersion > 20) {
    throw new Error("INVALID_TRACKING_KEY_VERSION");
  }

  const keys: Record<number, string> = {};

  for (let version = 1; version <= activeVersion; version++) {
    const encodedKey = Deno.env.get(
      `TRACKING_TOKEN_KEY_V${version}`
    );

    if (!encodedKey) {
      throw new Error("TRACKING_KEY_VERSION_NOT_CONFIGURED");
    }

    keys[version] = encodedKey;
  }

  return { activeVersion, keys };
}

function getPublicSiteOrigin(): string {
  const configuredUrl = Deno.env.get("PUBLIC_SITE_URL");

  if (!configuredUrl) {
    throw new Error("PUBLIC_SITE_URL_NOT_CONFIGURED");
  }

  const parsedUrl = new URL(configuredUrl);

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error("INVALID_PUBLIC_SITE_URL");
  }

  return parsedUrl.origin;
}

async function createRequestHash(payload: {
  name: string;
  phone: string;
  district: string;
  upazila: string;
  area: string | null;
  address: string;
  customer_note: string | null;
  items: Array<{ id: string; quantity: number }>;
}): Promise<string> {
  const canonicalPayload = JSON.stringify({
    name: payload.name,
    phone: payload.phone,
    district: payload.district,
    upazila: payload.upazila,
    area: payload.area,
    address: payload.address,
    customer_note: payload.customer_note,
    items: payload.items
      .map((item) => ({
        id: item.id.toLowerCase(),
        quantity: item.quantity,
      }))
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  });

  const encoded = new TextEncoder().encode(canonicalPayload);
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const MAX_REQUEST_BODY_BYTES = 16 * 1024;

async function readJsonBody(
  req: Request
): Promise<
  | { data: unknown; error?: never; status?: never }
  | { data?: never; error: string; status: number }
> {
  const contentType = req.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    return {
      error: "Content-Type must be application/json.",
      status: 415,
    };
  }

  const contentLength = req.headers.get("content-length");

  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return { error: "Invalid Content-Length.", status: 400 };
    }

    if (Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
      return { error: "Request body is too large.", status: 413 };
    }
  }

  if (!req.body) {
    return { error: "Request body is required.", status: 400 };
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();

        return {
          error: "Request body is too large.",
          status: 413,
        };
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let decoded: string;

  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(merged);
  } catch {
    return { error: "Invalid request encoding.", status: 400 };
  }

  try {
    return { data: JSON.parse(decoded) };
  } catch {
    return { error: "Invalid JSON request body.", status: 400 };
  }
}
console.info("Royal Shop database-based create-order function started");

export default {
  fetch: withSupabase(
    { auth: "publishable" },
    async (req, ctx) => {
      if (req.method !== "POST") {
        return Response.json(
          { error: "Only POST requests are allowed." },
          { status: 405 }
        );
      }

      try {
        // Server-side public order control: fail closed.
        const { data: storeSettings, error: settingsError } =
          await ctx.supabaseAdmin
            .from("store_settings")
            .select("public_order_enabled")
            .eq("id", 1)
            .maybeSingle();

        if (settingsError || !storeSettings) {
          console.error(
            "Store settings lookup failed:",
            settingsError?.message ?? "Settings row not found"
          );

          return Response.json(
            { error: "Order service is temporarily unavailable." },
            { status: 503 }
          );
        }

        if (storeSettings.public_order_enabled !== true) {
          return Response.json(
            { error: "Online ordering is currently unavailable." },
            { status: 403 }
          );
        }
        const parsedBody = await readJsonBody(req);

        if (parsedBody.error) {
          return Response.json(
            { error: parsedBody.error },
            { status: parsedBody.status }
          );
        }

        if (
          !parsedBody.data ||
          typeof parsedBody.data !== "object" ||
          Array.isArray(parsedBody.data)
        ) {
          return Response.json(
            { error: "Invalid order request body." },
            { status: 400 }
          );
        }

        const body = parsedBody.data as OrderRequest;

        const idempotencyKey =
          typeof body?.idempotencyKey === "string"
            ? body.idempotencyKey.trim()
            : "";

        if (!UUID_PATTERN.test(idempotencyKey)) {
          return Response.json(
            { error: "Invalid or missing order request key." },
            { status: 400 }
          );
        }

        const name = cleanText(body?.name);
        const phoneInput =
          typeof body?.phone === "string" ? body.phone.trim() : "";

        const district = cleanText(body?.district);
        const upazila = cleanText(body?.upazila);
        const area = cleanText(body?.area) || null;
        const address = cleanText(body?.address);
        const customerNote = cleanText(body?.customer_note) || null;

        const invalidOptionalFields =
          (body?.area !== undefined && body?.area !== null &&
            typeof body.area !== "string") ||
          (body?.customer_note !== undefined &&
            body?.customer_note !== null &&
            typeof body.customer_note !== "string");

        if (
          !name ||
          name.length > 100 ||
          !district ||
          district.length > 50 ||
          !upazila ||
          upazila.length > 50 ||
          !address ||
          address.length > 200 ||
          (area !== null && area.length > 100) ||
          (customerNote !== null && customerNote.length > 250) ||
          invalidOptionalFields
        ) {
          return Response.json(
            {
              error: "Invalid checkout information. Please review the required address fields and their length limits.",
            },
            { status: 400 }
          );
        }

        if (!/^01[3-9]\d{8}$/.test(phoneInput)) {
          return Response.json(
            { error: "Invalid Bangladesh mobile number." },
            { status: 400 }
          );
        }

        if (
          !Array.isArray(body.items) ||
          body.items.length < 1 ||
          body.items.length > 20
        ) {
          return Response.json(
            { error: "Invalid order items." },
            { status: 400 }
          );
        }

        const quantities = new Map<string, number>();

        for (const item of body.items) {
          if (
            !item ||
            typeof item.id !== "string" ||
            !UUID_PATTERN.test(item.id) ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > 20
          ) {
            return Response.json(
              { error: "Invalid product ID or quantity." },
              { status: 400 }
            );
          }

          const id = item.id.toLowerCase();
          const newQuantity =
            (quantities.get(id) ?? 0) + item.quantity;

          if (newQuantity > 20) {
            return Response.json(
              { error: "Maximum quantity per product is 20." },
              { status: 400 }
            );
          }

          quantities.set(id, newQuantity);
        }

        const normalizedItems = Array.from(quantities.entries())
          .map(([id, quantity]) => ({ id, quantity }))
          .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

        const requestHash = await createRequestHash({
          name,
          phone: phoneInput,
          district,
          upazila,
          area,
          address,
          customer_note: customerNote,
          items: normalizedItems,
        });
        const orderId = crypto.randomUUID().toLowerCase();
        const trackingToken = generateTrackingToken();
        const tokenHash = await hashTrackingToken(trackingToken);
        const trackingKeyConfig = loadTrackingKeyConfig();

        const encryptedToken = await encryptTrackingToken(
          trackingToken,
          orderId,
          trackingKeyConfig
        );

        const { data, error } = await ctx.supabaseAdmin.rpc(
          "create_order_atomic",
          {
            p_order_id: orderId,
            p_idempotency_key: idempotencyKey.toLowerCase(),
            p_request_hash: requestHash,
            p_customer_name: name,
            p_customer_phone: phoneInput,
            p_district: district,
            p_upazila: upazila,
            p_area: area,
            p_address: address,
            p_customer_note: customerNote,
            p_items: normalizedItems,
            p_token_hash: tokenHash,
            p_encrypted_token: encryptedToken,
            p_key_version: trackingKeyConfig.activeVersion,
          }
        );

        if (error) {
          const rpcMessage =
            typeof error.message === "string" ? error.message : "";

          console.error("Atomic order RPC error:", rpcMessage);

          const badRequestErrors = [
            "INVALID_ORDER_REQUEST",
            "INVALID_ORDER_ITEMS",
            "INVALID_ORDER_ITEM_COUNT",
            "INVALID_ORDER_ITEM",
            "INVALID_ORDER_ITEM_QUANTITY",
            "PRODUCT_QUANTITY_LIMIT_EXCEEDED",
          ];

          const conflictErrors = [
            "PRODUCT_UNAVAILABLE",
            "INSUFFICIENT_STOCK",
            "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST",
          ];

          if (badRequestErrors.some((code) => rpcMessage.includes(code))) {
            return Response.json(
              { error: "Invalid order information. Please review your order." },
              { status: 400 }
            );
          }

          if (conflictErrors.some((code) => rpcMessage.includes(code))) {
            return Response.json(
              {
                error: "A product is unavailable, stock is insufficient, or this request key was already used for another order.",
              },
              { status: 409 }
            );
          }

          return Response.json(
            { error: "Order could not be processed. Please try again." },
            { status: 500 }
          );
        }

        const rpcResult = data as Record<string, unknown> | null;

        const credentialValue = rpcResult?.trackingCredential;

        const trackingCredential =
          credentialValue &&
          typeof credentialValue === "object" &&
          !Array.isArray(credentialValue)
            ? credentialValue as Record<string, unknown>
            : null;

        const envelopeValue = trackingCredential?.encryptedToken;

        const envelope =
          envelopeValue &&
          typeof envelopeValue === "object" &&
          !Array.isArray(envelopeValue)
            ? envelopeValue as Record<string, unknown>
            : null;

        const validTrackingCredential = Boolean(
          trackingCredential &&
          typeof trackingCredential.orderId === "string" &&
          UUID_PATTERN.test(trackingCredential.orderId) &&
          typeof trackingCredential.tokenHash === "string" &&
          /^[0-9a-f]{64}$/.test(trackingCredential.tokenHash) &&
          Number.isSafeInteger(trackingCredential.keyVersion) &&
          (trackingCredential.keyVersion as number) >= 1 &&
          (trackingCredential.keyVersion as number) <= 20 &&
          envelope &&
          envelope.format === "A256GCM" &&
          envelope.envelope_version === 1 &&
          typeof envelope.nonce === "string" &&
          /^[A-Za-z0-9+/]{16}$/.test(envelope.nonce) &&
          typeof envelope.ciphertext === "string" &&
          envelope.ciphertext.length > 0 &&
          envelope.ciphertext.length % 4 === 0 &&
          /^[A-Za-z0-9+/]+={0,2}$/.test(envelope.ciphertext) &&
          typeof envelope.tag === "string" &&
          /^[A-Za-z0-9+/]{22}==$/.test(envelope.tag)
        );

        if (
          !rpcResult ||
          typeof rpcResult !== "object" ||
          !validTrackingCredential ||
          rpcResult.success !== true ||
          typeof rpcResult.orderNumber !== "string" ||
          rpcResult.orderNumber.trim().length === 0 ||
          !Array.isArray(rpcResult.items) ||
          rpcResult.items.length < 1 ||
          rpcResult.items.length > 20 ||
          !Number.isSafeInteger(rpcResult.itemCount) ||
          (rpcResult.itemCount as number) < 1 ||
          (rpcResult.itemCount as number) > 400 ||
          typeof rpcResult.subtotal !== "number" ||
          !Number.isFinite(rpcResult.subtotal) ||
          rpcResult.subtotal < 0 ||
          typeof rpcResult.deliveryCharge !== "number" ||
          !Number.isFinite(rpcResult.deliveryCharge) ||
          rpcResult.deliveryCharge < 0 ||
          typeof rpcResult.total !== "number" ||
          !Number.isFinite(rpcResult.total) ||
          rpcResult.total < 0 ||
          typeof rpcResult.message !== "string" ||
          rpcResult.message.trim().length === 0
        ) {
          console.error("Atomic order RPC returned an invalid response.");

          return Response.json(
            { error: "Order could not be confirmed. Please contact support before retrying." },
            { status: 500 }
          );
        }

        const returnedItems = rpcResult.items as unknown[];

        const validItems = returnedItems.every((item: unknown) => {
          if (
            !item ||
            typeof item !== "object" ||
            Array.isArray(item)
          ) {
            return false;
          }

          const orderItem = item as Record<string, unknown>;

          return (
            typeof orderItem.id === "string" &&
            UUID_PATTERN.test(orderItem.id) &&
            typeof orderItem.name === "string" &&
            orderItem.name.trim().length > 0 &&
            Number.isSafeInteger(orderItem.quantity) &&
            (orderItem.quantity as number) >= 1 &&
            (orderItem.quantity as number) <= 20 &&
            typeof orderItem.price === "number" &&
            Number.isFinite(orderItem.price) &&
            orderItem.price >= 0
          );
        });

        const expectedQuantities = new Map(
          normalizedItems.map((item) => [
            item.id.toLowerCase(),
            item.quantity,
          ])
        );

        const returnedProductIds = new Set<string>();

        const itemsMatchRequest =
          validItems &&
          returnedItems.every((item: unknown) => {
            const orderItem = item as Record<string, unknown>;
            const productId = (orderItem.id as string).toLowerCase();

            if (returnedProductIds.has(productId)) {
              return false;
            }

            returnedProductIds.add(productId);

            return (
              expectedQuantities.get(productId) === orderItem.quantity
            );
          }) &&
          returnedProductIds.size === expectedQuantities.size;

        const calculatedItemCount = validItems
          ? returnedItems.reduce(
              (sum: number, item: unknown) =>
                sum + (item as Record<string, number>).quantity,
              0
            )
          : -1;

        const calculatedSubtotal = validItems
          ? returnedItems.reduce(
              (sum: number, item: unknown) => {
                const orderItem = item as Record<string, number>;
                return sum + orderItem.price * orderItem.quantity;
              },
              0
            )
          : -1;

        const totalsMatch =
          itemsMatchRequest &&
          calculatedItemCount === rpcResult.itemCount &&
          Math.abs(calculatedSubtotal - rpcResult.subtotal) < 0.000001 &&
          Math.abs(
            rpcResult.subtotal + rpcResult.deliveryCharge - rpcResult.total
          ) < 0.000001;

        if (!totalsMatch) {
          console.error("Atomic order RPC returned inconsistent item data or totals.");

          return Response.json(
            { error: "Order could not be confirmed. Please contact support before retrying." },
            { status: 500 }
          );
        }

        const credential = trackingCredential as Record<string, unknown>;
        const credentialEnvelope =
          envelope as unknown as EncryptedTrackingToken;

        const recoveredToken = await decryptTrackingToken(
          credentialEnvelope,
          credential.keyVersion as number,
          trackingKeyConfig,
          credential.tokenHash as string,
          credential.orderId as string
        );

        const trackingUrl =
          `${getPublicSiteOrigin()}/track-order#t=${encodeURIComponent(recoveredToken)}`;

        return Response.json({
          success: true,
          orderNumber: rpcResult.orderNumber,
          items: rpcResult.items,
          itemCount: rpcResult.itemCount,
          subtotal: rpcResult.subtotal,
          deliveryCharge: rpcResult.deliveryCharge,
          total: rpcResult.total,
          message: rpcResult.message,
          trackingUrl,
        });
      } catch (error) {
        console.error("Order request error:", error);

        return Response.json(
          { error: "An unexpected server error occurred." },
          { status: 500 }
        );
      }
    }
  ),
};







