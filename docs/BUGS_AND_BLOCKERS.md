# Royal Shop — Bugs and Blockers

Last Updated: 2026-11-06

## Status Definitions

- BLOCKER: Prevents safe completion of a core workflow.
- OPEN: Requires investigation or implementation.
- OBSERVATION: Needs confirmation.
- DEFERRED: Not required for the immediate delivery milestone.

## 1. Current Blockers and Open Items

### B-001 — No Product Inventory

Status: OPEN

Evidence:
- Product Management displays 0 Products.
- Shop displays no products.

Impact:
- Add-to-cart, cart calculations, product detail and order workflows cannot yet be fully tested.

Next action:
- Prepare approved test data or a safe staging test environment before product CRUD testing.

### B-002 — Order Creation Not Verified

Status: BLOCKER for production readiness

Evidence:
- Only empty-cart checkout protection has been visually checked.
- Successful order creation has not been tested.

Impact:
- End-to-end checkout and order integrity remain unverified.

Next action:
- Review and test the order workflow safely before enabling public orders.

### B-003 — Stock Integrity Not Verified

Status: BLOCKER for production readiness

Evidence:
- No real inventory.
- Atomic stock decrement and duplicate-order prevention are not implemented/verified.

Impact:
- Concurrent or repeated orders may create inventory inconsistencies.

Next action:
- Resolve and verify stock integrity before production launch.

### B-004 — Category Name Display Observation

Status: OBSERVATION

Evidence:
- User-provided copied table output showed "d" in the category column.
- Slug displayed as baby-skincare.

Impact:
- Actual category name may be incorrect or the copied table formatting may be misleading.

Next action:
- Reinspect the category row in the browser and verify the actual displayed name without modifying the record.

### B-005 — Initial Admin Login Failure

Status: OBSERVATION

Evidence:
- Initial attempt returned Invalid login credentials.
- A later attempt successfully opened the dashboard.

Impact:
- Initial failure cause is unknown.

Next action:
- Do not reset credentials without further evidence.

### B-006 — Admin Database/API Authorization

Status: OPEN

Evidence:
- Frontend Protected Route redirects unauthenticated users.
- Frontend protection alone does not prove database/API authorization.

Impact:
- Server-side and database access controls still require verification.

Next action:
- Review existing RLS and authorization behavior without changing policies or grants.

## 2. Deferred Improvements

- Large JavaScript bundle optimization.
- Advanced analytics.
- Advanced monitoring and alerting.
- Advanced audit logs.
- Multi-branch support.

## 3. Explicitly Not Authorized

- Production deployment.
- Public Online Orders activation.
- Database schema or policy changes.
- Function, trigger, grant or privilege changes.
- Migration execution.

## 4. Current Technical Audit Findings — 2026-11-06

### B-007 — Development Database Order RPC and Support Tables Missing

Status: BLOCKER for live order integration

Verified evidence:
- The linked Development database does not contain `create_order_atomic`.
- The linked Development database does not contain `cancel_order_atomic` or `adjust_product_stock_atomic`.
- The inspected database does not contain `order_idempotency`, `stock_movements`, `order_tracking_tokens` or `order_status_history`.
- The local `create-order` Edge Function calls `create_order_atomic`.

Impact:
- The local order-creation source cannot be considered integration-ready against the inspected Development database.
- Atomic order creation, idempotency, stock reservation and cancellation cannot be verified end to end.

Next action:
- Reconcile the proposed database functions and supporting tables with the verified schema.
- Review the required migration design and permissions.
- Obtain separate approval before generating or executing any migration.

### B-008 — Public Online Ordering Is Disabled

Status: OBSERVED CONFIGURATION; ACTIVATION NOT AUTHORIZED

Verified evidence:
- Development database `store_settings.public_order_enabled` is `false`.
- The local `create-order` function checks this setting and rejects public order creation when disabled.

Impact:
- Public order creation is intentionally unavailable in the inspected Development environment.

Next action:
- Keep public ordering disabled until the security and release gates are satisfied and explicit authorization is obtained.

### B-009 — Customer Tracking and Acknowledgement Workflow Is Incomplete Locally

Status: OPEN

Verified evidence:
- The frontend references `/track-order`, but the inspected application routes do not define that route.
- The Checkout flow invokes `acknowledge-order`.
- The inspected local Edge Functions directory does not contain an `acknowledge-order` function.
- The approved Customer Journey architecture describes these as required components.

Impact:
- Customer tracking and acknowledgement cannot be considered locally complete or integration-tested.

Next action:
- Implement the approved local workflow in small, reviewable steps.
- Keep database changes and Edge Function deployment outside this implementation approval unless separately authorized.

### B-010 — Product Variant Workflow Is Not Integrated

Status: OPEN

Verified evidence:
- Checkout currently submits product ID and quantity, without `variant_id`.
- The inspected `create-order` request contract and request hash do not include `variant_id`.
- The reviewed variant SQL is a draft and explicitly leaves the order/cart/API contract for separate implementation.
- Existing Development order snapshots use the legacy product-only structure.

Impact:
- Variant selection, variant-aware cart identity, variant stock reservation and cancellation restoration are not verified as one workflow.

Next action:
- Complete and review the frontend, API, database-function and order-snapshot contracts together.
- Preserve compatibility with existing legacy order snapshots.
- Do not execute the variant migration draft without separate review and approval.

### B-011 — Admin Order Lifecycle Is Partially Implemented

Status: OPEN

Verified evidence:
- Local `admin-orders` supports list, detail and pending-to-confirmed actions.
- Other documented transitions such as processing, shipped, delivered and cancellation are not implemented in the inspected local function.
- The current confirmation action updates the order status directly; it does not write the proposed status-history record.
- The `admin-orders` function has not been deployed as part of the inspected local implementation.

Impact:
- The complete order lifecycle, audit history and cancellation/stock-restoration workflow are not verified.

Next action:
- Implement lifecycle transitions against the approved Customer Journey design.
- Ensure status changes, history and stock operations are transactionally consistent before live integration testing.

## 5. Audit Boundaries and Evidence Notes

- The database findings above refer to the inspected linked Development database, not an assumption about every remote environment.
- Local Edge Function source code does not prove that a function is deployed or operational.
- Unit tests do not prove live Supabase integration or production readiness.
- Existing legacy order records and snapshots must not be deleted or rewritten without a separately approved backup and cleanup plan.
- SQL drafts remain review-only unless explicitly approved for execution.

