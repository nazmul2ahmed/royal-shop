import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const MAX_BODY_BYTES = 16 * 1024;

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function normalizeSearch(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/[^\p{L}\p{M}\p{N}\s+-]/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

function getPositiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

export default {
  fetch: withSupabase(
    { auth: "user" },
    async (req, ctx) => {
      if (req.method !== "POST") {
        return jsonResponse({ error: "Only POST requests are allowed." }, 405);
      }

      try {
        const userId = ctx.userClaims?.id;

        if (!userId) {
          return jsonResponse({ error: "Authentication required." }, 401);
        }

        // Verify admin membership before accessing orders.
        const { data: adminRecord, error: adminError } =
          await ctx.supabase
            .from("admin_users")
            .select("user_id")
            .eq("user_id", userId)
            .maybeSingle();

        if (adminError) {
          console.error("Admin membership verification failed.");
          return jsonResponse(
            { error: "Admin access verification failed." },
            500,
          );
        }

        if (!adminRecord) {
          return jsonResponse({ error: "Admin access required." }, 403);
        }

        const contentType = req.headers.get("content-type")
          ?.split(";")[0]
          .trim()
          .toLowerCase();

        if (contentType !== "application/json") {
          return jsonResponse(
            { error: "Content-Type must be application/json." },
            415,
          );
        }

        const rawBody = await req.text();

        if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
          return jsonResponse({ error: "Request body is too large." }, 413);
        }

        let body: unknown;

        try {
          body = JSON.parse(rawBody);
        } catch {
          return jsonResponse({ error: "Invalid JSON request body." }, 400);
        }

        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return jsonResponse({ error: "Invalid request body." }, 400);
        }

        const payload = body as Record<string, unknown>;

        if (payload.action === "list") {
          const page = getPositiveInteger(payload.page, 1, 100000);
          const limit = getPositiveInteger(payload.limit, 20, 50);
          const search = normalizeSearch(payload.search);

          const status = typeof payload.status === "string"
            ? payload.status
            : "all";

          const from = payload.from == null || payload.from === ""
            ? null
            : payload.from;

          const to = payload.to == null || payload.to === ""
            ? null
            : payload.to;

          if (
            status !== "all" &&
            !ALLOWED_STATUSES.includes(status)
          ) {
            return jsonResponse(
              { error: "Invalid order status filter." },
              400,
            );
          }

          if (from !== null && !isValidDate(from)) {
            return jsonResponse({ error: "Invalid start date." }, 400);
          }

          if (to !== null && !isValidDate(to)) {
            return jsonResponse({ error: "Invalid end date." }, 400);
          }

          if (from && to && from > to) {
            return jsonResponse(
              { error: "Start date cannot be after end date." },
              400,
            );
          }

          let query = ctx.supabaseAdmin
            .from("orders")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false });

          if (status !== "all") {
            query = query.eq("status", status);
          }

          if (search) {
            query = query.or(
              `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`,
            );
          }

          if (from) {
            query = query.gte(
              "created_at",
              `${from}T00:00:00+06:00`,
            );
          }

          if (to) {
            const exclusiveEnd = new Date(`${to}T00:00:00+06:00`);
            exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
            query = query.lt("created_at", exclusiveEnd.toISOString());
          }

          const start = (page - 1) * limit;
          query = query.range(start, start + limit - 1);

          const { data, error, count } = await query;

          if (error) {
            console.error("Admin order list query failed.");
            return jsonResponse({ error: "Could not load orders." }, 500);
          }

          const total = count ?? 0;

          return jsonResponse({
            success: true,
            orders: data ?? [],
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          });
        }

        if (payload.action === "detail") {
          if (
            typeof payload.orderId !== "string" ||
            !UUID_PATTERN.test(payload.orderId)
          ) {
            return jsonResponse(
              { error: "Invalid order detail request." },
              400,
            );
          }

          const { data: order, error: detailError } =
            await ctx.supabaseAdmin
              .from("orders")
              .select("*")
              .eq("id", payload.orderId)
              .maybeSingle();

          if (detailError) {
            console.error("Admin order detail query failed.");
            return jsonResponse(
              { error: "Could not load order details." },
              500,
            );
          }

          if (!order) {
            return jsonResponse(
              { error: "Order not found." },
              404,
            );
          }

          return jsonResponse({
            success: true,
            order,
          });
        }
        if (payload.action === "confirm") {
          if (
            typeof payload.orderId !== "string" ||
            !UUID_PATTERN.test(payload.orderId)
          ) {
            return jsonResponse(
              { error: "Invalid order confirmation request." },
              400,
            );
          }

          // Atomic conditional update: only a pending order can be confirmed.
          const { data: updatedOrder, error: updateError } =
            await ctx.supabaseAdmin
              .from("orders")
              .update({
                status: "confirmed",
                updated_at: new Date().toISOString(),
              })
              .eq("id", payload.orderId)
              .eq("status", "pending")
              .select("id, order_number, status, updated_at")
              .maybeSingle();

          if (updateError) {
            console.error("Admin order confirmation failed.");
            return jsonResponse(
              { error: "Could not confirm this order." },
              500,
            );
          }

          if (!updatedOrder) {
            return jsonResponse(
              { error: "Order not found or it is no longer pending." },
              409,
            );
          }

          return jsonResponse({
            success: true,
            order: updatedOrder,
          });
        }

        return jsonResponse({ error: "Unknown action." }, 400);
      } catch (error) {
        console.error(
          "Admin orders request failed:",
          error instanceof Error ? error.message : "Unknown error",
        );

        return jsonResponse(
          { error: "An unexpected server error occurred." },
          500,
        );
      }
    },
  ),
};