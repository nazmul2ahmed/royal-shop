export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateOrderId(orderId) {
  if (typeof orderId !== "string" || !UUID_PATTERN.test(orderId)) {
    throw new TypeError("A valid order ID is required.");
  }

  return orderId;
}

export function canTransitionOrderStatus(currentStatus, nextStatus) {
  return currentStatus === "pending" && nextStatus === "confirmed";
}

export function normalizeOrderSearch(value) {
  if (typeof value !== "string") return "";

  return value
    .replace(/[^\p{L}\p{M}\p{N}\s+-]/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

export function getOrderStatusLabel(status) {
  const labels = {
    pending: "Pending",
    confirmed: "Confirmed",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  return labels[status] ?? "Unknown";
}

export function isValidOrderDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

export function normalizeOrderPagination(page, limit) {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  return {
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, 100000)
      : 1,
    limit: Number.isSafeInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 50)
      : 20,
  };
}

export function createOrderListPayload(filters = {}) {
  const pagination = normalizeOrderPagination(
    filters.page,
    filters.limit,
  );

  return {
    action: "list",
    ...pagination,
    search: normalizeOrderSearch(filters.search),
    status: typeof filters.status === "string" && filters.status
      ? filters.status
      : "all",
    from: filters.from || null,
    to: filters.to || null,
  };
}

export function createOrderDetailPayload(orderId) {
  return {
    action: "detail",
    orderId: validateOrderId(orderId),
  };
}

export function createOrderConfirmPayload(orderId) {
  return {
    action: "confirm",
    orderId: validateOrderId(orderId),
  };
}
