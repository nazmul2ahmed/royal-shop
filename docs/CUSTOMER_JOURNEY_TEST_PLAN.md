# Royal Shop — Customer Journey Test Plan v1.0

- Date: 2026-11-05
- Status: TEST PLAN APPROVED — TEST EXECUTION PENDING
- Related architecture: CUSTOMER_JOURNEY_ARCHITECTURE.md
- Database execution: NOT AUTHORIZED
- Deployment: NOT AUTHORIZED

## 1. Test Objectives

Verify that the Customer Journey system:

- Creates orders exactly once under retries.
- Protects customer tracking links.
- Exposes no customer PII through public tracking.
- Enforces valid order status transitions.
- Records complete and consistent status history.
- Keeps WhatsApp acknowledgement independent.
- Enforces admin authorization.
- Preserves checkout and order management behavior.

No real customer orders will be created during testing.

## 2. Test Levels

1. Unit tests — pure validation and business logic.
2. Component tests — checkout, tracking and admin UI.
3. API tests — request validation and response contracts.
4. Database integration tests — transaction and constraints.
5. Security tests — token, authorization and privacy.
6. Concurrency tests — duplicate requests and simultaneous updates.
7. Browser tests — desktop and mobile.
8. Regression tests — existing checkout and admin features.

## 3. Order Creation and Idempotency

| ID | Scenario | Expected result |
|---|---|---|
| CJ-ORD-001 | Valid order request | Exactly one order |
| CJ-ORD-002 | Same key and same payload | Existing order response returned |
| CJ-ORD-003 | Same key and changed payload | Request rejected |
| CJ-ORD-004 | Retry after ambiguous network failure | No duplicate order |
| CJ-ORD-005 | Missing customer name | Validation rejection |
| CJ-ORD-006 | Invalid Bangladesh phone | Validation rejection |
| CJ-ORD-007 | Missing district | Validation rejection |
| CJ-ORD-008 | Missing upazila | Validation rejection |
| CJ-ORD-009 | Invalid product ID | Validation rejection |
| CJ-ORD-010 | Invalid quantity | Validation rejection |
| CJ-ORD-011 | Insufficient stock | No partial order or reservation |
| CJ-ORD-012 | Public ordering disabled | 403; no order created |

## 4. Tracking Token Security

| ID | Scenario | Expected result |
|---|---|---|
| CJ-TOK-001 | Valid token | Public tracking response |
| CJ-TOK-002 | Invalid token | Generic rejection |
| CJ-TOK-003 | Revoked token | Access denied |
| CJ-TOK-004 | Expired token, if configured | Access denied |
| CJ-TOK-005 | Order number without token | Access denied |
| CJ-TOK-006 | Token hash database exposure | Original token not recoverable from hash |
| CJ-TOK-007 | Encrypted token without key | Decryption fails |
| CJ-TOK-008 | Repeated invalid attempts | Rate limiting enforced |
| CJ-TOK-009 | Token replacement | Old token revoked |
| CJ-TOK-010 | Permanent token | Remains valid until revoked |
| CJ-TOK-011 | Token replay | Read-only tracking; no unauthorized mutation |
| CJ-TOK-012 | Token in server logs | Plaintext token absent |
| CJ-TOK-013 | Token replacement transaction failure | Full rollback; previous token remains active |
| CJ-TOK-014 | Reuse of revoked token | Permanently rejected; never reactivated |

## 5. Public Data Privacy

| ID | Scenario | Expected result |
|---|---|---|
| CJ-PRV-001 | Valid tracking request | Only approved public fields |
| CJ-PRV-002 | Customer phone inspection | Phone absent |
| CJ-PRV-003 | Address inspection | Full address absent |
| CJ-PRV-004 | Customer note inspection | Note absent |
| CJ-PRV-005 | Admin note inspection | Note absent |
| CJ-PRV-006 | Admin identity inspection | Identifier absent |
| CJ-PRV-007 | Stock movement inspection | Data absent |
| CJ-PRV-008 | Unknown tracking token | No order existence disclosure |

## 6. Order Status Lifecycle

| ID | Current | Requested | Expected |
|---|---|---|---|
| CJ-STS-001 | pending | confirmed | Allowed |
| CJ-STS-002 | confirmed | processing | Allowed |
| CJ-STS-003 | processing | shipped | Allowed |
| CJ-STS-004 | shipped | delivered | Allowed |
| CJ-STS-005 | pending | cancelled | Allowed |
| CJ-STS-006 | confirmed | cancelled | Allowed |
| CJ-STS-007 | delivered | cancelled | Rejected |
| CJ-STS-008 | shipped | pending | Rejected |
| CJ-STS-009 | cancelled | confirmed | Rejected |
| CJ-STS-010 | pending | pending | Rejected |
| CJ-STS-011 | unknown | confirmed | Rejected |
| CJ-STS-012 | pending | invalid status | Rejected |

## 7. Status History

| ID | Scenario | Expected result |
|---|---|---|
| CJ-HIS-001 | Successful status update | One history entry |
| CJ-HIS-002 | Failed transition | No history entry |
| CJ-HIS-003 | Transaction failure | Status and history both rollback |
| CJ-HIS-004 | Multiple transitions | Correct chronological history |
| CJ-HIS-005 | Concurrent status updates | No inconsistent history |
| CJ-HIS-006 | Initial order creation | Initial pending event recorded |
| CJ-HIS-007 | Internal note | Not visible publicly |
| CJ-HIS-008 | Admin identity | Not visible publicly |

## 8. WhatsApp Acknowledgement

Only one WhatsApp acknowledgement is supported per order.
Database uniqueness on (order_id, acknowledgement_type) is mandatory.

| ID | Scenario | Expected result |
|---|---|---|
| CJ-ACK-001 | Customer submits acknowledgement with valid token | Separate acknowledgement saved |
| CJ-ACK-002 | Same acknowledgement submitted again | Existing acknowledgement returned; no duplicate |
| CJ-ACK-003 | Concurrent duplicate submissions | Exactly one database record |
| CJ-ACK-004 | Acknowledgement submitted | Order status remains unchanged |
| CJ-ACK-005 | Admin confirms order | Status becomes confirmed independently |
| CJ-ACK-006 | Browser refresh | Persisted acknowledgement state remains accurate |
| CJ-ACK-007 | Invalid tracking token | Request rejected |
| CJ-ACK-008 | Revoked tracking token | Request rejected |
| CJ-ACK-009 | Expired tracking token | Request rejected |
| CJ-ACK-010 | WhatsApp delivery assumption | App does not claim delivery verification |
| CJ-ACK-011 | Arbitrary public order ID without valid token | Request rejected |
| CJ-ACK-012 | Acknowledgement retry after successful insert | Existing result returned without changing order status |
| CJ-ACK-013 | Token revoked concurrently with acknowledgement | Atomic transaction; revoked token cannot authorize a later acknowledgement |
| CJ-ACK-014 | Existing acknowledgement after retry | Same acknowledgement state returned; no duplicate |

## 9. Admin Authorization

| ID | Scenario | Expected result |
|---|---|---|
| CJ-AUTH-001 | Unauthenticated request | Rejected |
| CJ-AUTH-002 | Authenticated non-admin | Rejected |
| CJ-AUTH-003 | Verified admin | Permitted operation |
| CJ-AUTH-004 | Forged actor_user_id | Rejected |
| CJ-AUTH-005 | Browser requests privileged RPC | Rejected |
| CJ-AUTH-006 | Service-role key inspection | Never present in frontend bundle |
| CJ-AUTH-007 | Admin changes unauthorized order | Rejected |

## 10. Transaction and Concurrency

- Two simultaneous submissions with the same idempotency key create one order.
- Two simultaneous status updates cannot create inconsistent history.
- Status and history commit or rollback together.
- Order cancellation and stock restoration commit or rollback together.
- Duplicate cancellation does not restore stock twice.
- Product deletion cannot silently break cancellation restoration.
- Stock adjustments cannot overwrite newer stock values.

## 11. Frontend and Browser Tests

### Checkout

- Separate district and upazila fields.
- Required field validation.
- Address and customer details preserved on retry.
- Cart remains unchanged until the existing customer confirmation step.
- Acknowledgement API failure preserves cart and pending request.
- Tracking link is presented after successful server response.

| ID | Scenario | Expected result |
|---|---|---|
| CJ-CHK-001 | Missing district | Rejected |
| CJ-CHK-002 | Missing upazila | Rejected |
| CJ-CHK-003 | Missing full address | Rejected |
| CJ-CHK-004 | Area omitted | Accepted |
| CJ-CHK-005 | Customer note omitted | Accepted |
| CJ-CHK-006 | Area supplied | Preserved in order |
| CJ-CHK-007 | Customer note supplied | Preserved in order |
| CJ-CHK-008 | Retry with unchanged address fields | Same idempotent result |
| CJ-CHK-009 | Retry with changed district/upazila/address | Rejected as payload mismatch |
| CJ-CHK-010 | Legacy pending request without new required fields | Safe recovery; never silently create a modified order |

### Customer Tracking

- Valid link opens tracking page.
- Invalid or revoked link displays a safe error.
- Loading and network error states work.
- Status timeline displays all public transitions.
- Token is not placed in ordinary query parameters.
- Tracking token is read from the URL fragment and submitted through HTTPS POST body.
- Tracking token is not stored in localStorage, sessionStorage, or other persistent browser storage.
- No unnecessary third-party scripts.
- Refreshing the page preserves link-based access.

### Admin

- Order search and filters continue working.
- Order details remain correct.
- Status controls enforce allowed transitions.
- Acknowledgement is visually separate from status.
- Timeline displays all transitions.

### Responsive verification

- Desktop layout.
- Tablet layout.
- Mobile layout at approximately 390px.
- No horizontal overflow.
- Buttons and status timeline remain usable.

## 12. Regression Tests

- Existing checkout idempotency tests continue passing.
- Existing order management tests continue passing.
- Existing product and cart behavior remains unchanged.
- No duplicate order submission system is introduced.
- Existing admin authentication remains enforced.
- No browser storage clearing is required.

## 13. Test Environment and Safety

- Unit tests use synthetic fixtures.
- Integration tests use a disposable test database.
- Never use real customer records for test fixtures.
- Never create real customer orders for test verification.
- No production SQL execution.
- No remote migration.
- No deployment without separate explicit approval.

## 14. Acceptance Criteria

The Customer Journey implementation is locally acceptable only when:

1. All required unit tests pass.
2. All token security tests pass.
3. All privacy tests pass.
4. All status lifecycle tests pass.
5. All history consistency tests pass.
6. All acknowledgement tests pass.
7. All authorization tests pass.
8. Concurrency and rollback tests pass.
9. Browser desktop and mobile verification passes.
10. Existing checkout and order management regression tests pass.

Any critical security or data integrity failure blocks acceptance.

## 15. Current Execution Status

All tests are pending implementation.

No test execution is implied by this document.

