# Royal Shop — Customer Journey Architecture v1.0

- Date: 2026-11-05
- Status: DESIGN APPROVED — IMPLEMENTATION PENDING
- Database execution: NOT AUTHORIZED
- Deployment: NOT AUTHORIZED

## 1. Objective

Provide a secure customer-facing order journey from order submission
through delivery or cancellation.

The existing checkout and order creation workflow remains the source
of order submission. Customer Journey must not create a second order
submission system.

## 2. Approved Design Decisions

1. Tracking token: Permanent until revoked by an authorized admin.
2. Customer timeline: Show all public order status transitions.
3. WhatsApp acknowledgement: Separate from database order status.

## 3. System Components

- Existing CheckoutPage.jsx
- create-order Supabase Edge Function
- orders table
- order_idempotency table
- order_tracking_tokens table (proposed)
- order_status_history table (proposed)
- order_customer_acknowledgements table (proposed)
- track-order Supabase Edge Function (proposed)
- acknowledge-order Supabase Edge Function (proposed)
- Existing admin-orders Edge Function
  (including protected tracking-token revocation and replacement)
- Admin Order Management UI

## 4. Order Lifecycle

Allowed transitions:

- pending -> confirmed
- confirmed -> processing
- processing -> shipped
- shipped -> delivered
- pending -> cancelled
- confirmed -> cancelled

All other transitions are rejected.

Cancellation and stock restoration must be atomic and audited.

## 5. WhatsApp Acknowledgement

Customer acknowledgement is independent of order status.

The customer acknowledgement means only that the customer reports
sending the WhatsApp message. It does not prove WhatsApp delivery.

Acknowledgement must never automatically change order status to confirmed.

## 6. Tracking Token Design

- Generate a cryptographically secure random token on the server.
- Store a unique SHA-256 token hash for verification.
- Encrypted token storage is REQUIRED for safe idempotent retry recovery.
- Use authenticated encryption such as AES-256-GCM.
- Keep encryption keys exclusively in server-side secrets.
- Store a key version with every encrypted token to support key rotation.
- Permanent tokens have no expiry by default.
- Admin can revoke a token and issue a replacement.
- Never store plaintext tokens in database records, idempotency responses,
  application logs, or browser persistent storage.
- Apply rate limiting and generic invalid-token responses.

### Idempotent Tracking Token Recovery

1. The create-order Edge Function generates a cryptographically secure token.
2. The Edge Function calculates its SHA-256 hash and encrypts the token
   using the active server-side encryption key.
3. The RPC receives the token hash, ciphertext, and key version.
4. For a new order, the RPC stores the tracking credential in the same
   transaction as the order and its initial status-history entry.
5. For an existing idempotency key with the same request hash, the RPC
   returns the previously stored ciphertext and key version. Newly
   generated retry credentials must be ignored.
6. The Edge Function decrypts the stored ciphertext server-side and
   reconstructs the same tracking link.
7. Plaintext tokens and tracking links must not be stored in the
   order_idempotency response JSON.
8. A revoked token must never be restored by an idempotent retry.
   The retry must return a safe failure or require an authorized
   replacement-token workflow.
### Tracking Link Handling

Prefer a URL fragment to carry the token, for example:

`/track-order#t=<token>`

The frontend reads the fragment and submits the token in an HTTPS POST
request body. The token must not be sent in ordinary query parameters.

Avoid third-party analytics and unnecessary external scripts on the
tracking page. Do not persist the token in long-lived browser storage.

## 7. Proposed Database Structures

### order_tracking_tokens

- id: UUID primary key.
- order_id: UUID foreign key to orders.
- token_hash: globally unique SHA-256 hash, NOT NULL.
- encrypted_token: authenticated encrypted envelope, NOT NULL.
- key_version: encryption key version, NOT NULL.
- expires_at: nullable timestamp; NULL means no expiry.
- revoked_at: nullable timestamp.
- created_at: timestamp.

Constraints and rules:

- Multiple token records per order are allowed to preserve token history.
- A partial unique index on order_id WHERE revoked_at IS NULL
  must enforce at most one active token per order.
- Token replacement must revoke the previous active token and create
  its replacement in one transaction.
- Token verification must reject revoked or expired tokens.
- The encrypted envelope must contain or identify the AES-GCM nonce,
  ciphertext and authentication tag, with an explicit format version.
- Encryption keys remain exclusively in server-side secrets.

### order_status_history

- id: UUID primary key.
- order_id: UUID foreign key to orders.
- old_status: nullable for initial status.
- new_status: new order status.
- actor_type: system or admin.
- changed_by: nullable verified admin user ID; NULL for system actor.
- note: optional internal-only note.
- created_at: timestamp.

Rules:

- Initial order creation inserts a history record with old_status NULL
  and new_status pending.
- Every successful status transition and its history record must commit
  in the same database transaction.
- actor_type and changed_by must be consistent.
- Internal notes must never be exposed by the public tracking API.
- History records must not be silently overwritten or deleted.

### order_customer_acknowledgements

- id: UUID primary key.
- order_id: UUID foreign key to orders.
- acknowledgement_type: WhatsApp acknowledgement.
- acknowledged_at: timestamp.
- channel: WhatsApp.
- created_at: timestamp.

Rules:

- Acknowledgement must be submitted only after verifying the order
  through its tracking capability or an authenticated admin action.
- Duplicate acknowledgement submissions must be idempotent.
- Enforce a mandatory UNIQUE(order_id, acknowledgement_type)
  constraint because only one WhatsApp acknowledgement per order
  is supported.
- Concurrent duplicate submissions must result in exactly one
  stored acknowledgement record.
- Acknowledgement must never change the order status.
- Public clients must not be able to modify arbitrary order records.
## 8. API Responsibilities

### create-order

- Validate and normalize all checkout input.
- Enforce public_order_enabled.
- Validate stock and product data.
- Enforce canonical request-hash idempotency.
- Create order, initial pending history, and tracking credential atomically.
- Return order number, checkout summary, and tracking link.
- On an identical retry, recover the original tracking credential
  through its stored encrypted envelope.
- Never return a newly generated replacement token for an existing
  idempotency key.

### track-order

- Accept tracking token through HTTPS POST.
- Verify token hash, expiry, and revocation state.
- Return only public-safe order information.
- Apply rate limiting and generic invalid-token responses.
- Never return phone, full address, customer note, internal notes,
  admin identity, or stock movement information.

### acknowledge-order

- Accept tracking token through HTTPS POST.
- Verify token hash, expiry, and revocation state.
- Record the customer's WhatsApp-send acknowledgement.
- Enforce idempotency so repeated submissions do not create duplicates.
- Return whether the acknowledgement was newly recorded or
  had already been recorded.
- Never change order status or claim WhatsApp delivery was verified.
- Do not accept an arbitrary public order ID as authorization.
- Token verification and acknowledgement insertion must occur within
  one database transaction or an equivalent atomic server-side RPC.
- Enforce the UNIQUE(order_id, acknowledgement_type) constraint at
  database level to handle concurrent duplicate submissions.
- If an acknowledgement already exists, return its existing recorded
  state without inserting another record.
- Token revocation must prevent any subsequent acknowledgement.

### admin-orders

- Require authenticated admin membership.
- Verify admin authorization server-side.
- Permit only valid status transitions.
- Record every successful transition in status history.
- Keep acknowledgement separate from order status.
- Allow authorized token revocation and replacement through a
  server-side protected workflow.
- Revoke the previous active token and create its replacement in
  one atomic database transaction.
- A revoked token must never become active again.
- Verify admin authorization server-side before allowing this operation.
- Preserve token history and never expose plaintext tokens in admin
  logs or database response records.
## 9. Public Tracking Response

Expected public fields:

- orderNumber
- status
- createdAt
- timeline entries containing status and timestamp

Optional total amount may be returned if required.

Never expose:

- customer phone
- full delivery address
- customer note
- internal admin notes
- admin identifiers
- stock movement records

## 10. Checkout Address Requirements

The existing checkout currently collects a single full address.

The proposed checkout must separately collect:

- customer name
- Bangladesh phone number
- district
- upazila
- area/locality
- full delivery address
- optional customer note

District and upazila must not be silently populated with empty strings.

All canonical customer and item fields must be included in the
idempotency request hash.
### 10.1 Final Address Field Contract

- District: required free-text input.
- Upazila: required free-text input.
- Area/locality: optional free-text input.
- Full delivery address: required free-text input.
- Customer note: optional free-text input.

No district or upazila value may be silently defaulted to an empty string.

The server must validate and normalize these fields before order creation.
All five address-related fields must be included in the canonical
idempotency request hash so retries cannot change delivery information.

### 10.2 Legacy Pending Checkout Recovery

- Existing pending checkout requests may contain only the legacy
  name, phone, full-address and item fields.
- Never silently populate missing district or upazila fields with
  empty strings or modify a persisted request under the same
  idempotency key.
- Do not retry a legacy request with a changed payload under its
  original idempotency key.
- Preserve unresolved pending-request data until a safe recovery
  decision is made.
- Provide a clear customer-facing recovery path that avoids creating
  duplicate orders.
- Do not clear the cart or pending request merely because recovery
  was attempted or failed.

## 11. Security Requirements

- No service-role key in browser code.
- No direct anonymous access to private order tables.
- No order lookup using order number alone.
- No customer PII in public tracking responses.
- Admin membership verified server-side.
- Actor identity must not be trusted from arbitrary request input.
- Rate limiting for public tracking.
- Token revocation and replacement support.
- Status and history writes must be atomic.
- Stock reservation and cancellation must be atomic.
- Prevent stale product edit forms from overwriting stock.
- Review product hard-delete behavior before enabling stock reservation.

## 12. Implementation Gates

Before production consideration:

1. Review existing create_order_atomic idempotency behavior.
2. Verify SECURITY INVOKER execution context and actual privileges.
3. Resolve district/upazila validation and checkout integration.
4. Verify status/history/cancellation transaction consistency.
5. Define encryption key rotation and recovery.
6. Complete unit, integration, concurrency and authorization tests.
7. Complete responsive browser verification.

## 13. Approval Boundaries

This document authorizes design and local implementation planning only.

It does not authorize:

- SQL execution
- Remote schema migration
- Remote database mutation
- Edge Function deployment
- Frontend production deployment
- Creation of real customer orders

Each remote operation requires separate explicit approval.

