# Order Management — Implementation Notes

Date: 2026-11-05
Project: Royal Shop
Scope: Local implementation only

## 1. Purpose

Provide an authenticated admin interface for reviewing and managing customer orders.

## 2. Frontend

Route:
- `/admin/orders`

Access:
- Wrapped in the existing `AdminProtectedRoute`.

Files:
- `src/pages/OrderManagementPage.jsx`
- `src/pages/OrderManagementPage.css`
- `src/lib/orderManagement.js`
- `src/App.jsx`
- `src/pages/AdminDashboardPage.jsx`

Features:
- Paginated order list.
- Search by order number, customer name and phone.
- Status filter.
- Date range filter.
- Order detail modal.
- Customer delivery information.
- Item and price breakdown.
- Pending-to-confirmed action.
- Responsive desktop and mobile layouts.

Order details display district and upazila separately, as these are required columns in the current orders table.

## 3. Backend API

Local Edge Function source:
- `supabase/functions/admin-orders/index.ts`

Invocation:
- `supabase.functions.invoke("admin-orders", { body })`

Supported actions:

### list
Returns a paginated order list.

Input fields include:
- `action`
- `page`
- `limit`
- `search`
- `status`
- `from`
- `to`

The implementation applies search normalization, status validation, date validation and Bangladesh-local date boundaries.

### detail
Returns one order by UUID.

Input:
- `action: "detail"`
- `orderId`

### confirm
Attempts to confirm an order only when its current status is `pending`.

The update is conditional on the existing status. A conflict is returned if the order is no longer pending.

## 4. Authorization design

The Edge Function uses user-authenticated mode.

Expected authorization sequence:
1. Require a valid authenticated user.
2. Read the caller's own admin membership record through the user-scoped Supabase client.
3. Reject callers without an admin membership record.
4. Use the server-side admin client for order operations only after membership verification.

The browser must never receive or use the service-role key.

The orders table has RLS enabled and no direct authenticated read/update policy. The implementation intentionally avoids granting broad direct browser access.

## 5. Status workflow

Currently supported transition:

`pending -> confirmed`

Other transitions are rejected by the initial workflow.

Processing, shipping, delivery and cancellation workflows are not implemented as actionable transitions yet.

## 6. Tests and local verification

Test file:
- `tests/orderManagement.test.mjs`

Latest reported result:
- 26 tests passed.
- 0 failed.

Coverage includes:
- Status transition rules.
- Search normalization, including Bengali characters.
- Status labels.
- ISO date validation.
- Pagination defaults and caps.
- List payload construction.
- Detail and confirmation UUID validation.

Other reported checks:
- `deno check` passed for the Edge Function.
- `npm run build` passed.
- `npm run lint` reported 0 errors and 8 warnings in existing files.

The Vite build reports a JavaScript chunk of approximately 562.46 kB, above its 500 kB warning threshold.

## 7. Not yet verified

- Edge Function deployment.
- Remote API invocation.
- Live order list and detail queries.
- Live confirmation update.
- Browser-level responsive verification.
- Unauthorized API integration tests.
- End-to-end order lifecycle.

Unit tests and local build success do not establish production readiness.

## 8. Deployment and database restrictions

As of this document:
- `admin-orders` has not been deployed.
- No database migration was executed for this feature.
- No remote schema, RLS policy or grant was changed for this feature.
- Public online orders remain disabled.
- No production deployment is authorized.

Do not execute SQL drafts or deploy this function without separate explicit approval.

## 9. Next steps

1. Review the rendered admin interface in a browser.
2. Verify modal open/close behavior and responsive layout.
3. Review the Edge Function source and authorization behavior.
4. Resolve remote deployment and database prerequisites through a separately approved process.
5. Perform controlled integration tests only after deployment is explicitly authorized.

## Browser Verification — 2026-11-05

- `/admin/orders` rendered successfully in the browser.
- Dashboard navigation and visible filter/pagination controls were checked.
- Mobile layout was visually checked at approximately 390px and reported as acceptable.
- The page displayed an Edge Function request error because the local function source has not been deployed.
- Live order data, details and confirmation remain unverified.

This is a local UI verification only, not an end-to-end integration test.
