import test from "node:test";
import assert from "node:assert/strict";

import {
  canTransitionOrderStatus,
  normalizeOrderSearch,
  getOrderStatusLabel,
  isValidOrderDate,
  normalizeOrderPagination,
  createOrderListPayload,
} from "../src/lib/orderManagement.js";

test("pending order can be confirmed", () => {
  assert.equal(canTransitionOrderStatus("pending", "confirmed"), true);
});

test("confirmed order cannot return to pending", () => {
  assert.equal(canTransitionOrderStatus("confirmed", "pending"), false);
});

test("pending order cannot be cancelled through the initial workflow", () => {
  assert.equal(canTransitionOrderStatus("pending", "cancelled"), false);
});

test("same-status transition is rejected", () => {
  assert.equal(canTransitionOrderStatus("pending", "pending"), false);
});

test("unknown status transition is rejected", () => {
  assert.equal(canTransitionOrderStatus("unknown", "confirmed"), false);
});

test("search input is trimmed", () => {
  assert.equal(normalizeOrderSearch("  RS-1001  "), "RS-1001");
});

test("non-string search input becomes empty", () => {
  assert.equal(normalizeOrderSearch(null), "");
});

test("search input is limited to 100 characters", () => {
  assert.equal(normalizeOrderSearch("a".repeat(120)).length, 100);
});

test("Bangla customer names are preserved in search", () => {
  assert.equal(normalizeOrderSearch("  সজল আহমেদ  "), "সজল আহমেদ");
});

test("search whitespace is normalized", () => {
  assert.equal(normalizeOrderSearch("  Royal   Shop  "), "Royal Shop");
});

test("search punctuation is removed safely", () => {
  assert.equal(normalizeOrderSearch("RS-1001,()"), "RS-1001");
});

test("known status gets a readable label", () => {
  assert.equal(getOrderStatusLabel("pending"), "Pending");
});

test("unknown status gets a safe fallback label", () => {
  assert.equal(getOrderStatusLabel("unexpected"), "Unknown");
});

test("valid ISO date is accepted", () => {
  assert.equal(isValidOrderDate("2026-11-04"), true);
});

test("impossible calendar date is rejected", () => {
  assert.equal(isValidOrderDate("2026-02-30"), false);
});

test("incorrect date format is rejected", () => {
  assert.equal(isValidOrderDate("04-11-2026"), false);
});

test("non-string date is rejected", () => {
  assert.equal(isValidOrderDate(null), false);
});

test("invalid pagination uses safe defaults", () => {
  assert.deepEqual(normalizeOrderPagination(0, -5), {
    page: 1,
    limit: 20,
  });
});

test("pagination limit is capped at 50", () => {
  assert.deepEqual(normalizeOrderPagination(2, 100), {
    page: 2,
    limit: 50,
  });
});

test("page number is capped", () => {
  assert.deepEqual(normalizeOrderPagination(200000, 20), {
    page: 100000,
    limit: 20,
  });
});

test("list payload uses the expected API action and defaults", () => {
  assert.deepEqual(createOrderListPayload(), {
    action: "list",
    page: 1,
    limit: 20,
    search: "",
    status: "all",
    from: null,
    to: null,
  });
});

test("list payload normalizes filters for the API", () => {
  assert.deepEqual(
    createOrderListPayload({
      page: "2",
      limit: "25",
      search: "  সজল   আহমেদ ",
      status: "pending",
      from: "2026-11-01",
      to: "2026-11-04",
    }),
    {
      action: "list",
      page: 2,
      limit: 25,
      search: "সজল আহমেদ",
      status: "pending",
      from: "2026-11-01",
      to: "2026-11-04",
    },
  );
});

test("detail payload includes a valid order ID", async () => {
  const { createOrderDetailPayload } = await import("../src/lib/orderManagement.js");

  assert.deepEqual(
    createOrderDetailPayload("123e4567-e89b-12d3-a456-426614174000"),
    {
      action: "detail",
      orderId: "123e4567-e89b-12d3-a456-426614174000",
    },
  );
});

test("detail payload rejects an invalid order ID", async () => {
  const { createOrderDetailPayload } = await import("../src/lib/orderManagement.js");

  assert.throws(
    () => createOrderDetailPayload("invalid-id"),
    TypeError,
  );
});

test("confirm payload includes a valid order ID", async () => {
  const { createOrderConfirmPayload } = await import("../src/lib/orderManagement.js");

  assert.deepEqual(
    createOrderConfirmPayload("123e4567-e89b-12d3-a456-426614174000"),
    {
      action: "confirm",
      orderId: "123e4567-e89b-12d3-a456-426614174000",
    },
  );
});

test("confirm payload rejects an invalid order ID", async () => {
  const { createOrderConfirmPayload } = await import("../src/lib/orderManagement.js");

  assert.throws(
    () => createOrderConfirmPayload("not-a-uuid"),
    TypeError,
  );
});
