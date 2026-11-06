# Royal Shop — Testing Log

Last Updated: 2026-11-04

## Testing Evidence Rules

- User-reported browser observations are recorded as User-reported PASS.
- A visual PASS does not prove complete functional behavior.
- Untested behavior remains PENDING.
- Do not mark a test PASS without evidence.
- Do not use fake inventory as real business data.

## 1. Build and Static Checks

| Test | Result | Evidence |
|---|---|---|
| npm run build | PASS | Exit code 0; 92 modules transformed |
| npm run lint | PASS with warnings | 0 errors; 10 warnings |
| Vite local server startup | PASS | Vite ready at 127.0.0.1:5173 |

## 2. Public Website Browser Checks

| Page / Feature | Result | Evidence / Limitation |
|---|---|---|
| Home | User-reported PASS | Visual inspection |
| Shop | User-reported PASS | No products available |
| Categories | User-reported PASS | One category visible |
| Cart empty state | User-reported PASS | Empty-cart message/illustration |
| Checkout empty-cart protection | User-reported PASS | No Products Selected; Back to Cart link |

## 3. Admin Browser Checks

| Page / Feature | Result | Evidence / Limitation |
|---|---|---|
| Admin Login UI | User-reported PASS | Login form visible |
| Password Reset UI | User-reported PASS | Page and controls visible |
| Admin authentication | User-reported PASS | Dashboard later displayed logged-in email |
| Dashboard | User-reported PASS | Dashboard sections visible |
| Product Management UI | User-reported PASS | Form and zero-product empty state |
| Categories Management UI | User-reported PASS | One category and actions visible |
| Logout redirect | User-reported PASS | Redirected to login |
| Protected dashboard route | User-reported PASS | Direct URL after logout redirected to login |

## 4. Observations Requiring Follow-up

- Initial login attempt returned Invalid login credentials; a later login succeeded. Root cause has not been established.
- Category table output appeared to show category name as "d". Confirm whether this is actual stored/displayed data or a copy/rendering issue.
- Product category dropdown showed baby-skincare.
- Product count remains zero.
- Public Online Orders is DISABLED.

## 5. Pending Functional Tests

| Test | Status |
|---|---|
| Product form required-field validation | PENDING |
| Product slug/SKU validation | PENDING |
| Product create/edit/delete | PENDING |
| Product stock correctness | PENDING |
| Category create/edit/disable | PENDING |
| Category-product relationship | PENDING |
| Add to Cart | PENDING |
| Remove from Cart | PENDING |
| Quantity update and subtotal | PENDING |
| Checkout form validation | PENDING |
| Successful order creation | PENDING |
| Duplicate order prevention | PENDING |
| Atomic stock decrement | PENDING |
| Admin order management | PENDING |
| Unauthorized database/API access checks | PENDING |
| Mobile responsiveness | PENDING |

## 6. Safety Restrictions

Do not enable public online orders or submit real customer orders during testing without explicit approval.

Do not alter production data, database policies, schema, functions or deployment configuration as part of this log.

## 7. Order Management Local Verification — 2026-11-05

| Check | Result | Evidence / Limitation |
|---|---|---|
| Order helper unit tests | PASS | 26 passed, 0 failed |
| Status transition rules | PASS | Pending can be confirmed; unsupported transitions rejected |
| Search normalization | PASS | Bengali text preserved; whitespace and punctuation normalized |
| Date validation | PASS | Valid and invalid ISO calendar dates tested |
| Pagination normalization | PASS | Safe defaults and limits tested |
| List/detail/confirm payloads | PASS | Payload defaults and UUID validation tested |
| Edge Function type check | PASS | `deno check` completed without errors |
| Production build | PASS | Vite build completed; 562.46 kB JS chunk warning remains |
| Lint | PASS WITH WARNINGS | 0 errors, 8 warnings in existing files |
| Live order list | NOT TESTED | Edge Function not deployed |
| Live order detail | NOT TESTED | Edge Function not deployed |
| Live order confirmation | NOT TESTED | Edge Function not deployed |
| Mobile browser verification | PASS | Visually checked at approximately 390px; user reported layout acceptable |
| Unauthorized API access | PENDING | Requires deployed integration/security testing |

### Scope clarification

The 26 tests cover the local order-management helper module. They do not exercise Supabase, the remote database, Edge Function authorization or real order records.

No live orders were created or modified during these checks.

## 8. Order Management Browser UI Check — 2026-11-05

### Results
- Admin Order Management page rendered in the browser.
- Dashboard navigation worked.
- Search, status, date, pagination and refresh controls were visible.
- Mobile viewport around 390px was visually checked; user reported the layout looked okay.
- No frontend runtime crash was reported.

### Backend limitation
- UI displayed `Failed to send a request to the Edge Function`.
- `admin-orders` has not been deployed.
- Therefore live list, detail and confirmation workflows were not tested.

No real orders were created, confirmed, updated or deleted during this check.


## 9. Separate Node.js and Deno Test Runners — 2026-11-05

### Test Runner Configuration

| Item | Configuration |
|---|---|
| Node.js version | 24.20.0 |
| Deno version | 2.9.8 |
| Node test command | `npm test` |
| Deno test command | `npm run test:deno` |
| Node test file | `tests/orderManagement.test.mjs` |
| Deno test file | `supabase/functions/_shared/tracking-token.test.ts` |

### Results

| Test Suite | Result | Evidence |
|---|---|---|
| Order Management (Node.js) | PASS | 26 passed, 0 failed |
| Tracking Token (Deno) | PASS | 5 passed, 0 failed |
| Combined total | PASS | 31 passed, 0 failed |

### Tracking Token Test Coverage

- Encryption/decryption round-trip with order-bound AAD.
- Incorrect encryption key rejection.
- Incorrect expected hash rejection.
- Decryption with another order ID rejected.
- Invalid order ID rejected.

### Runtime Configuration Note

Deno was installed at `%USERPROFILE%\.deno\bin\deno.exe`, but its directory was initially missing from the Windows User PATH.

The User PATH was updated. Both test commands now run successfully through their respective npm scripts.

Node.js and Deno tests must remain separate because the Deno test file uses `Deno.test()` and cannot run directly under Node.js.

