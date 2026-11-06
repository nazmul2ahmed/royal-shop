# Royal Shop — Project Status

Last Updated: 2026-11-06
Current Phase: Phase 0 — Security and Database Readiness (release gate); Phase 1 — Local Core Functional Implementation (parallel workstream)
Delivery Target: Client Delivery Ready (Local/Staging)
Production Deployment: Not Authorized

## 1. Project Identity

- Project: Royal Shop
- Type: Baby-care e-commerce and order management system
- Local path: D:\Royal Shop
- Production URL: https://royal-shop.pages.dev
- Frontend: React 19 + Vite 8
- Backend services: Supabase
- Supabase project: royal-shop-oms
- Supabase region: eu-west-2

## 2. Delivery Strategy

Client Delivery Ready and Production Deployment are separate milestones.

Client Delivery Ready means core workflows have been tested and the system is ready for client review in a local or staging environment.

Production deployment requires separate authorization and production verification.

## 3. Verified Build and Static Checks

- npm run build: PASS
- npm run lint: PASS with 10 warnings and 0 errors.
- Latest verified build output: 98 modules transformed (2026-11-05).
- Build completed successfully.
- JavaScript bundle exceeds 500 kB warning remains for later optimization.

## 4. Browser Testing — User Reported

The following visual/basic navigation checks were reported successful by the user:

- Home page.
- Shop page.
- Categories page.
- Cart empty state.
- Checkout empty-cart protection.
- Admin login page.
- Forgot Password / Reset Password page.
- Admin dashboard access.
- Product Management page.
- Categories Management page.
- Logout redirect.
- Protected dashboard URL after logout redirects to login.

These are user-reported browser observations, not independently instrumented or complete functional tests.

## 5. Current Application State

- Product count displayed: 0.
- One category is displayed: baby-skincare.
- Product Management form is visible.
- Category Management list and controls are visible.
- Public Online Orders control is DISABLED.
- Order Management has a local protected admin interface at /admin/orders; live database integration remains blocked.
- Website Content section displays Coming next.
- No real inventory has been created for testing.

## 6. Important Known Limitations

- Product create, edit, delete and stock workflows are not functionally verified.
- Category create, edit and disable workflows are not functionally verified.
- Cart add/remove/quantity/subtotal workflows are not verified.
- Successful order creation has not been verified.
- The local Order Management interface supports listing, details and pending-to-confirmed action; complete live lifecycle integration is not verified.
- Complete runtime integration testing has not been completed.
- Security of database operations must be verified independently of frontend route protection.
- Public checkout Edge Function changes are local and have not been deployed.
- No production deployment is authorized.

## 7. Current Phase

Two workstreams are active, with separate completion criteria.

### Phase 0 — Security and Database Readiness

Status: IN PROGRESS — RELEASE GATE.

This workstream remains a mandatory prerequisite for any production release or live order integration.

Completed for the inspected evidence:
- Initial baseline inventory and browser checks.
- Local historical migration archive recovery investigation.
- Read-only Development Database schema reconciliation.
- Read-only function, trigger and default-privilege security reviews.
- Order Management and Customer Journey dependency assessment.

Remaining:
- Prepare a design-only baseline migration proposal.
- Review and document default-privilege remediation options.
- Reconcile the proposed database design with existing data, RLS, grants, functions and triggers.
- Complete the remaining Phase 0 security controls and verification.
- Obtain separate approval before any migration generation, execution or deployment.

### Phase 1 — Local Core Functional Implementation

Status: PARALLEL LOCAL WORKSTREAM.

Local application development may continue in small, testable steps, but it must not bypass Phase 0 release gates.

Completed locally:
- Initial Order Management frontend and protected route.
- Local admin-orders Edge Function source.
- Order Management unit tests and implementation documentation.
- Local lint, type-check and production build verification.
- Order Management browser UI and approximately 390px mobile layout visual review.
- Customer Journey architecture and test plan documentation.
- Business configuration and theme foundations.
- Homepage Featured Products integration.

Customer Journey status:
- Architecture: DESIGN APPROVED.
- Test plan: DOCUMENTED.
- Implementation: PENDING.
- Test execution: PENDING.
- Database execution and deployment: NOT AUTHORIZED.

Current integration gaps:
- Development Database order RPCs and supporting tables are missing.
- Public online ordering remains disabled.
- Customer tracking route and acknowledgement Edge Function are not yet implemented locally.
- Product variant information is not yet integrated into the checkout order contract.
- Complete admin order lifecycle and status history are not implemented.

Next:
- Continue local implementation only where it does not depend on unapproved database or deployment changes.
- Keep the Customer Journey implementation aligned with its approved architecture.
- Continue Website Content Management after the agreed Customer Journey work.

Testing must use synthetic Development data and must not create fake production inventory or real customer orders.
## 8. Change Restrictions

Unless separately approved:

- Do not change database schema, data, RLS policies, grants, functions or triggers.
- Do not execute or generate migrations.
- Do not deploy.
- Do not modify Git history or overwrite existing uncommitted work.
- Do not expose secrets or environment values.

## 9. Order Management — Local Implementation Update (2026-11-05)

The initial local Order Management implementation has been added.

### Implemented locally
- Protected admin route: `/admin/orders`.
- Dashboard Orders card navigation.
- Order list with pagination.
- Search by order number, customer name and phone.
- Status and date filters.
- Order detail view, including district, upazila, area and address.
- Pending-to-confirmed action.
- Desktop table and mobile card layouts.
- Server-side Edge Function source: `supabase/functions/admin-orders/index.ts`.
- Frontend helper and unit tests.

### Verification
- Initial Order Management verification: 26 Node.js tests passed, 0 failed. Current runner results are recorded in Section 11.
- Deno type check: passed.
- Vite production build: passed.
- Initial lint snapshot: 0 errors, 8 warnings. Latest lint run (2026-11-05): 0 errors, 10 warnings.
- Latest production bundle: 577.50 kB. Vite's chunk-size warning above 500 kB remains.

### Important limitations
- The `admin-orders` Edge Function has NOT been deployed.
- Live order listing, detail retrieval and status updates have NOT been integration-tested.
- No database schema, RLS policy, grant or migration was changed for this implementation.
- Public online orders remain DISABLED.
- No production deployment is authorized.

The earlier observation that the Orders dashboard section displayed "Coming next" is superseded by this local implementation. It does not imply that the remote workflow is operational.


## 10. Order Management — Browser UI Verification (2026-11-05)

### Verified in browser
- `/admin/orders` route renders without a frontend runtime crash.
- Dashboard navigation to Order Management works.
- Search, status filter and date filter controls are visible.
- Pagination and refresh controls are visible.
- Mobile layout was visually checked at approximately 390px viewport width.
- No obvious mobile layout overflow or broken layout was reported.

### Known limitation
- The browser displayed: `Failed to send a request to the Edge Function`.
- This is consistent with the `admin-orders` function not yet being deployed.
- Live order listing, detail retrieval and confirmation remain unverified.
- No real customer orders were created or modified.

Browser rendering and responsive layout verification do not establish live backend integration or production readiness.


## 11. Reusable Business Configuration — 2026-11-05

### Implemented locally

- Created `src/config/business.config.js`.
- Added business identity, business type, public contact configuration and branding values.
- Created `docs/BUSINESS_CONFIGURATION.md`.
- Integrated Header branding with `businessConfig`.
- Integrated Footer name and tagline with `businessConfig`.
- Integrated Admin Dashboard branding with `businessConfig`.
- Integrated Admin Login branding and business name with `businessConfig`.
- Integrated Checkout business identity and WhatsApp contact configuration with `businessConfig`.
- Preserved existing Checkout order submission, Supabase and WhatsApp workflow code.

### Verification

- Configuration and documentation contents reviewed through PowerShell.
- Confirmed Checkout imports `business.config.js` exactly once.
- Confirmed Checkout no longer contains hardcoded `ROYAL SHOP` or `Royal Shop` branding references.
- Latest production build completed successfully: 97 modules transformed.
- JavaScript bundle-size warning remains above 500 kB after minification.
- Browser-level verification is still pending.

### Remaining work

1. Align theme variables with configured branding colors.
2. Review remaining business-specific presentation text in shared components.
3. Perform fresh-client configuration verification.
4. Perform browser-level verification of integrated components.

### Change boundaries

- No database schema or migration changes were made.
- No order workflow or customer data handling changes were intended.
- No deployment or production settings were changed.
- Separate client Supabase projects and credentials remain part of the approved architecture.

## 12. Config-Driven Theme Foundation — 2026-11-05

### Implemented locally

- Connected business branding colors from `business.config.js` to global CSS custom properties in `src/main.jsx`.
- Configured `--royal-green`, `--golden-yellow`, and `--soft-cream`.
- Updated `AdminProtectedRoute.jsx` to use `var(--royal-green)`.
- Added Light, Dark, and System theme architecture principles to `docs/BUSINESS_CONFIGURATION.md`.

### Verification

- `main.jsx` integration reviewed.
- Production build completed successfully after theme connection.
- Latest build: 97 modules transformed.
- JavaScript bundle-size warning remains above 500 kB.
- Browser-level theme verification is pending.

### Remaining work

1. Create semantic theme variables in global CSS.
2. Implement a small persistent theme controller.
3. Add a theme selector to the shared navigation.
4. Gradually migrate active page styles to semantic variables.
5. Verify Light, Dark, and System modes across storefront and admin pages.

### Change boundaries

- No database schema or migration changes.
- No authentication, cart, checkout, or order workflow changes.
- No deployment or production configuration changes.
- Light Mode remains the default until theme selection is implemented.

### Theme Implementation Progress — 2026-11-05

#### Implemented locally

- Created `src/context/ThemeContext.jsx`.
- Added `ThemeProvider` and `useTheme()` for shared React theme state.
- Integrated `ThemeProvider` into the application root in `src/main.jsx`.
- Added Light, Dark and System theme preference handling.
- Added browser `localStorage` persistence using the `royal-shop-theme` key.
- Added operating-system dark preference detection through `matchMedia`.
- Added semantic CSS variables for backgrounds, surfaces, text, borders, inputs, and status colors in `src/index.css`.
- Connected root text color, root background, and body background to semantic theme variables.
- Created backups before the theme-related source changes.

#### Verification

- Reviewed the ThemeContext and application-root integration.
- Confirmed the three global CSS theme references.
- Production build completed successfully after the global theme CSS change.
- Latest build: 98 modules transformed.
- CSS: 41.22 kB; JavaScript: 574.90 kB.
- JavaScript chunk-size warning above 500 kB remains.
- Browser-level theme behavior has not yet been verified.

#### Remaining work

1. Add a Light / Dark / System selector to shared navigation.
2. Apply semantic theme variables to active storefront and admin styles.
3. Verify theme persistence after reload.
4. Verify System mode responds to operating-system preference changes.
5. Check contrast, form controls, cards, navigation, and responsive layouts.
6. Complete browser-level Light and Dark mode testing.

#### Current limitations

- Semantic theme variables are prepared but most existing page styles still use fixed colors.
- Dark Mode is not yet fully applied across the application.
- Theme selection has no visible user interface yet.
- No database schema, authentication, cart, checkout, or order workflow was changed.
- No deployment or production configuration was changed.

### Featured Products — 2026-11-05

- Added public.products.is_featured boolean column with NOT NULL and DEFAULT false.
- Live Supabase migration executed and schema verified.
- Admin Product Form now supports Featured selection.
- Product insert/update payload includes is_featured.
- Production build successful: 98 modules transformed.
- Homepage Supabase Featured Products integration is pending.
- Shop Page, Cart and Checkout behavior must remain unchanged.


### Homepage Featured Products — 2026-11-05

- Homepage now fetches active featured products from Supabase public.products.
- Products are sorted by sort_order, then name.
- Product images and names use React Router links to product detail pages by slug.
- Product cards show image, name, category, price, optional compare price, stock status and product tag.
- Add to Cart uses the Supabase product object.
- Order Now passes directProduct to the existing Checkout workflow.
- Loading, error and empty states are implemented.
- Added responsive product image styling; existing mobile two-column grid is preserved.
- Removed obsolete static productIcons mapping and outdated demo collection copy.
- Production build successful: 98 modules transformed; JavaScript bundle 577.50 kB.
- Existing large-chunk warning remains non-blocking.
- Browser verification of Admin Featured selection, Homepage display, product details, cart and direct checkout is pending.


## 13. Separate Node.js and Deno Test Runners — 2026-11-05

### Configuration

| Item | Value |
|---|---|
| Node.js | 24.20.0 |
| Deno | 2.9.8 |
| Node test command | `npm test` |
| Deno test command | `npm run test:deno` |
| Node test file | `tests/orderManagement.test.mjs` |
| Deno test file | `supabase/functions/_shared/tracking-token.test.ts` |

### Verification Results

| Test Suite | Result |
|---|---|
| Order Management — Node.js | 26 passed, 0 failed |
| Tracking Token — Deno | 5 passed, 0 failed |
| Combined unit tests | 31 passed, 0 failed |

### Tracking Token Coverage

- Encryption/decryption round-trip with order-bound AAD.
- Incorrect encryption key rejection.
- Incorrect expected hash rejection.
- Cross-order decryption rejection.
- Invalid order ID rejection.

### Runtime Notes

- Deno executable was found at `%USERPROFILE%\.deno\bin\deno.exe`.
- Deno was initially missing from the Windows User PATH.
- The User PATH was updated to include the Deno binary directory.
- Both npm test scripts completed successfully.
- Node.js and Deno tests must remain separate because the Deno test file uses `Deno.test()`.

These are unit-test results only. They do not establish successful Supabase integration, deployed Edge Function behavior, database authorization or production readiness.

## 14. Development Database and Order Workflow Audit — 2026-11-06

### Development Database findings

- Required order RPCs `create_order_atomic`, `cancel_order_atomic` and `adjust_product_stock_atomic` are absent.
- Supporting tables for idempotency, stock movements, tracking tokens and order status history are absent.
- `store_settings.public_order_enabled` is currently false.
- The Development Database contains zero products and six legacy demo orders.
- The six existing demo orders are pending and contain legacy product snapshots.
- No stock reservation history was found for those orders.

### Local application and Edge Function findings

- The local `create-order` function depends on the missing `create_order_atomic` RPC.
- Checkout order items do not currently include `variant_id`.
- The `/track-order` route is absent from the local application.
- The `acknowledge-order` Edge Function is not present locally.
- The local `admin-orders` implementation supports listing, details and pending-to-confirmed action.
- A complete order status lifecycle and status history are not yet implemented.

### Verification

- Node.js unit tests: 26 passed.
- Deno unit tests: 5 passed.
- Combined unit tests: 31 passed.
- These results do not establish live Supabase integration or deployed Edge Function behavior.

### Change boundaries

- This audit did not modify database schema, data, RLS, grants, functions or triggers.
- No new migration was executed.
- No Edge Function was deployed.
- Public online ordering remains disabled.
- Production deployment remains unauthorized.
- SQL drafts remain review-only.
- Git staging, commits and pushes require separate approval.

