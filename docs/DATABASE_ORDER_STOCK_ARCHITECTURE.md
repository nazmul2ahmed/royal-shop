# Royal Shop — Order & Stock Architecture

Date: 2026-11-04
Status: Design Draft — Not Implemented

## 1. Objective

Implement reliable order creation, stock reservation, duplicate-request
protection, order cancellation, stock adjustment and stock movement auditing.

No database changes or production deployment are authorized by this document.

## 2. Verified Existing Database Structure

### products
- id: UUID primary key
- name: text
- price: numeric
- stock: integer, NOT NULL, default 0
- is_active: boolean, NOT NULL, default true
- category_id: UUID, nullable
- stock constraint: stock >= 0
- SKU and slug have unique constraints

### orders
- id: UUID primary key
- order_number: text, unique
- customer_name: text
- customer_phone: text
- address: text
- items: JSONB array
- item_count: integer
- subtotal, delivery_charge, total: numeric
- status: pending, confirmed, processing, shipped, delivered, cancelled
- created_at and updated_at timestamps

The existing order schema has no idempotency key.

## 3. Current Order Item Format

The current Edge Function stores verified product data in this format:

{
  "id": "product-uuid",
  "name": "Product name",
  "quantity": 2,
  "price": 100
}

The product UUID is retained in each order item. Cancellation and stock
restoration must use this ID, not the product name or slug.

## 4. Stock Definition

`products.stock` represents currently available stock.

- New product: Admin may set initial stock.
- Order creation: available stock is decremented atomically.
- Cancellation: reserved stock is restored atomically.
- Product information editing: must not overwrite stock.
- Stock adjustment: must use a dedicated protected operation.
- Stock must never become negative.

## 5. Required Database Components — Proposal

### A. order_idempotency

Purpose: prevent duplicate orders when the same checkout request is retried.

Proposed fields:
- idempotency_key UUID primary key
- request_hash TEXT NOT NULL
- order_id UUID referencing orders
- response JSONB
- created_at TIMESTAMPTZ

Rules:
- Same key + same request hash: return the original result.
- Same key + different request hash: reject the request.
- A failed transaction must not leave a completed idempotency record.
- Concurrent requests using the same key must not create two orders.

Retention and cleanup policy must be decided before implementation.

### B. stock_movements

Purpose: maintain an auditable record of stock changes.

Proposed fields:
- id UUID primary key
- product_id UUID
- order_id UUID nullable
- movement_type TEXT
- quantity INTEGER
- stock_before INTEGER
- stock_after INTEGER
- reason TEXT nullable
- actor_user_id UUID nullable
- created_at TIMESTAMPTZ

Movement types:
- order_reserved
- order_cancelled
- admin_adjustment

Movement records must be written in the same transaction as the stock change.
Application roles must not be allowed to rewrite historical movement records.

Product deletion behavior and retention must be reviewed before adding
foreign-key constraints to the audit table.

## 6. Atomic Order Creation

A trusted database operation should:

1. Validate the idempotency key and request hash.
2. Resolve the submitted product IDs against the database.
3. Reject missing or inactive products.
4. Read authoritative names and prices from products.
5. Validate quantities and calculate totals on the server.
6. Decrement stock conditionally, ensuring sufficient stock.
7. Insert the order with verified item data.
8. Insert stock movement records.
9. Save the idempotency response.
10. Commit all changes together.

Any failure must roll back the entire transaction.

Product rows should be processed in a deterministic order to reduce
deadlock risk.

The client must never supply authoritative prices or stock values.

## 7. Cancellation and Restoration

A protected cancellation operation should:

1. Lock or safely transition the target order.
2. Allow cancellation only from explicitly permitted statuses.
3. Change status only if the order is not already cancelled.
4. Restore stock using the product IDs and quantities stored in the order.
5. Insert stock movement records.
6. Commit the status change and stock restoration together.

Repeated cancellation must not restore stock more than once.

The exact allowed status transitions require approval before implementation.

## 8. Admin Stock Adjustment

Product editing and stock adjustment must be separate operations.

- General product editing must omit stock from its update payload.
- Stock adjustment must use a protected atomic database operation.
- Every adjustment must record before/after values, quantity, reason and actor.
- Concurrent stock adjustments and orders must not overwrite each other.

## 9. Security Requirements

- Do not expose privileged RPC operations to anon or ordinary authenticated users.
- Restrict trusted order and stock operations to service_role or a separately
  verified administrative authorization path.
- Use SECURITY DEFINER only when necessary.
- Set a fixed safe search_path for SECURITY DEFINER functions.
- Fully qualify referenced database objects where appropriate.
- Revoke unintended PUBLIC execution privileges.
- Review grants and RLS behavior for every new table.
- Do not modify existing managed Supabase functions, triggers or default ACLs.

## 10. Frontend and Edge Function Changes

### Checkout
- Generate one idempotency key per checkout attempt.
- Reuse the same key when retrying that attempt.
- Generate a new key only for a genuinely new order.
- Treat database order creation success separately from WhatsApp opening.
- Do not tell the customer that an order failed merely because browser storage
  or WhatsApp navigation failed after the order was saved.
- Provide an order-number recovery path.

### Product Management
- Do not send stock in ordinary product-edit updates.
- Provide a separate stock adjustment workflow.

### Admin Order Management
- List and inspect orders.
- Show order number, customer details, items, totals and status.
- Provide only valid status transitions.
- Provide cancellation with confirmation and a clear result.
- Prevent repeated cancellation and duplicate restoration.

## 11. Critical Risks to Resolve

- Concurrent checkout overselling.
- Duplicate orders after network or browser retries.
- Stock overwritten by stale product-edit forms.
- Stock restoration repeated on cancellation.
- Product records becoming unavailable before historical order recovery.
- Order saved successfully but browser storage or WhatsApp failing.
- Unauthorized access to privileged RPC functions.
- Audit records being modified or deleted.

## 12. Implementation Sequence

1. Review and approve architecture.
2. Review migration SQL and security grants.
3. Approve database execution separately.
4. Implement atomic database operations.
5. Update Edge Function.
6. Update Checkout idempotency and recovery behavior.
7. Separate Product editing from stock adjustment.
8. Build Admin Order Management.
9. Test concurrent checkout, retries, insufficient stock, cancellation,
   repeated cancellation and stock adjustments.
10. Review all changes before any Git push or production deployment.

## 13. Explicit Non-Goals

- No fake products or stock.
- No automatic production deployment.
- No migration execution without separate approval.
- No changes to existing database policies or grants without review.
- No destructive Git operations.
