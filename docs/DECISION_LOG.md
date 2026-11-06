# ROYAL SHOP
## Project Decision Log

Version: 1.0
Created: 4 November 2026
Related Document: PROJECT_CHARTER.md

---

# 1. PURPOSE

This document records approved, pending, deferred, and rejected project decisions.

Its purpose is to:
- Prevent undocumented changes.
- Preserve client-approved requirements.
- Track architecture and security decisions.
- Separate confirmed decisions from assumptions.
- Maintain a clear history of project direction.

A decision is not approved merely because it has been discussed.

# 2. DECISION STATUS DEFINITIONS

| Status | Meaning |
|---|---|
| APPROVED | Explicitly approved for implementation |
| CONFIRMED | Existing condition or decision verified |
| PENDING | Requires further information or approval |
| DEFERRED | Intentionally postponed |
| REJECTED | Not approved |
| SUPERSEDED | Replaced by a later documented decision |

# 3. CONFIRMED PROJECT DECISIONS

## D-001 - Client-Specific Project

Status: CONFIRMED

Decision:
Royal Shop is being developed for a specific client as a business e-commerce system.

Reason:
The project must meet the operational needs of the actual client rather than function only as a portfolio demonstration.

## D-002 - Security-First Development

Status: APPROVED

Decision:
Security hardening must be completed before public ordering is enabled.

Reason:
Customer information, order records, product data, and business operations require appropriate protection.

## D-003 - Public Ordering Initially Disabled

Status: APPROVED

Decision:
Public ordering must remain disabled until the required security checks and launch criteria pass.

Reason:
An unfinished order pipeline must not accept real customer orders.

## D-004 - Dual Deployment Preparation

Status: APPROVED

Decision:
Prepare the project for both Client-Owned Infrastructure and Developer-Managed Service.

Reason:
The final hosting and ownership arrangement has not yet been selected by the client.

## D-005 - Portable Project Architecture

Status: APPROVED

Decision:
Keep source code, environment configuration, database migrations, and deployment instructions portable.

Reason:
The project should be transferable without unnecessary rebuilding or permanent dependence on one account.

## D-006 - Client Data Ownership

Status: APPROVED

Decision:
Business data, customer information, products, inventory records, and orders belong to the client.

Reason:
Infrastructure management does not transfer ownership of business data.

## D-007 - No Shared Multi-Client Database by Default

Status: APPROVED

Decision:
A shared multi-client database architecture is not approved.

Reason:
Tenant isolation, access boundaries, and data security require a separately designed and tested architecture.

## D-008 - No Unapproved Deployment

Status: APPROVED

Decision:
No production deployment, Git commit, or Git push without explicit authorization.

Reason:
The client must retain control over production changes and release timing.

## D-009 - No Fake Business Inventory

Status: APPROVED

Decision:
Do not create demonstration products or stock records that could be mistaken for actual business inventory.

Reason:
Incorrect inventory can mislead customers and disrupt real operations.

## D-010 - Plan Before Implementation

Status: APPROVED

Decision:
Document the requirement and proposed approach before implementing significant changes.

Reason:
This reduces scope creep, rework, and accidental architecture changes.

# 4. PENDING DECISIONS

## D-011 - Final Infrastructure Ownership Model

Status: PENDING

Options:
- Model A: Client-Owned Infrastructure.
- Model B: Developer-Managed Service.

Decision Owner:
Client.

Required Before:
Production account setup and final handover arrangement.

## D-012 - Production Domain Ownership

Status: PENDING

Decision:
Confirm the final domain and its ownership arrangement with the client.

Required Before:
Production DNS configuration.

## D-013 - Production Billing Responsibility

Status: PENDING

Decision:
Confirm who pays for Cloudflare, Supabase, domain registration, and any third-party services.

Required Before:
Production launch.

## D-014 - Maintenance and Support Agreement

Status: PENDING

Decision:
Define maintenance responsibilities, response expectations, service charges, and support duration.

Required Before:
Final handover or ongoing managed service.

# 5. SECURITY IMPLEMENTATION DECISIONS

## D-015 - Cloudflare Turnstile

Status: APPROVED FOR IMPLEMENTATION

Decision:
Use Cloudflare Turnstile with server-side token verification for public order submission.

Requirements:
- Site key is public frontend configuration.
- Secret key remains server-side.
- Verify tokens through Cloudflare Siteverify.
- Validate expected hostname and action.
- Reject failed or invalid verification.
- Never trust frontend verification alone.

## D-016 - Server-Side Rate Limiting

Status: APPROVED FOR IMPLEMENTATION

Decision:
Add server-side rate limiting to the public order endpoint.

Requirements:
- Limits must be enforced server-side.
- Requests must fail safely if the rate-limit mechanism is unavailable.
- Rate-limit identifiers must be based on validated request context.
- Do not rely blindly on client-supplied forwarding headers.

## D-017 - Idempotency Protection

Status: APPROVED FOR IMPLEMENTATION

Decision:
Implement duplicate submission protection using an idempotency mechanism.

Requirements:
- A repeated request must not create duplicate orders.
- Database uniqueness or transactional protection must enforce the rule.
- The same request key must not silently create multiple orders.

## D-018 - Atomic Stock and Order Creation

Status: APPROVED FOR IMPLEMENTATION

Decision:
Stock validation, stock reservation or deduction, and order creation must be handled atomically.

Requirements:
- Use a database transaction or suitable database function.
- Prevent concurrent requests from overselling stock.
- A failed order must not leave stock incorrectly changed.
- Define stock restoration behavior for applicable order cancellation cases separately.

## D-019 - Checkout Fulfillment Validation

Status: APPROVED FOR IMPLEMENTATION

Decision:
Validate required delivery and customer information on the server.

Requirements:
- Customer name.
- Valid Bangladesh phone number.
- District.
- Upazila.
- Full delivery address.
- Optional area and customer note, where supported.

Missing or invalid required information must reject the order.

## D-020 - Public Order Readiness Gate

Status: APPROVED FOR IMPLEMENTATION

Decision:
Use separate settings for public ordering permission and security readiness.

Required conditions:
- public_order_enabled = true
- public_order_ready = true

Both conditions must be true before the server accepts public orders.

The readiness flag must not be treated as a substitute for actual server-side security checks.

# 6. CURRENT IMPLEMENTATION STATUS

| Area | Status |
|---|---|
| Database grants hardening | Completed and verified |
| RLS review | Completed for reviewed tables |
| Admin authentication testing | Passed |
| Password recovery testing | Passed |
| Store settings table | Created and verified |
| Server-side order control | Implemented locally |
| Admin order control UI | Implemented locally |
| Request body validation | Implemented locally |
| Turnstile | Pending implementation |
| Rate limiting | Pending implementation |
| Idempotency | Pending implementation |
| Atomic stock/order operation | Pending implementation |
| Fulfillment validation | Pending implementation |
| Final security review | Pending |
| Production deployment | Not authorized |
| Database baseline inspection | Completed and documented |
| Local migrations directory | Empty; historical migration sequence unrecovered |
| Recovered SQL archive | One PRIVATE saved query archived; not a complete history |
| Recovery inventory | Created and verified on 4 November 2026 |
| Migration execution | Not started; review and reconciliation required |

Important:
Local implementation does not mean production deployment.
Do not mark a feature production-ready without the relevant deployment and verification evidence.

# 7. DEFERRED FEATURES

The following features are not part of the current approved Phase 0 work:

- Payment gateway integration.
- Customer accounts.
- Customer order tracking.
- Delivery partner integration.
- Coupon and discount system.
- Advanced analytics.
- Automated marketing notifications.
- Multi-client SaaS conversion.

Each requires a separate proposal and approval.

# 8. DECISION CHANGE HISTORY

| Date | Decision ID | Change | Status |
|---|---|---|---|
| 2026-11-03 | D-001 to D-010 | Initial project direction recorded | Approved / Confirmed |
| 2026-11-04 | D-011 to D-014 | Client ownership and operational decisions recorded | Pending |
| 2026-11-04 | D-015 to D-020 | Security implementation decisions recorded | Approved for implementation |

# 9. NEW DECISION RECORD TEMPLATE

Copy this template when a new decision is proposed.

## D-XXX - Decision Title

Date:
Requested By:
Decision Owner:

Status: PENDING

Existing Requirement:

Proposed Decision:

Reason:

Security Impact:

Cost and Time Impact:

Compatibility Impact:

Alternatives Considered:

Approval Evidence:

Implementation Status:

Related Files:

# 10. GOVERNANCE RULE

- Approved decisions guide implementation.
- Pending decisions must not be treated as approved.
- Deferred features must not enter active development without approval.
- Critical security fixes may be prioritized but must be documented.
- Superseded decisions must remain in the history.
- Update this file whenever a significant decision changes.

The Project Charter defines the overall project direction.
This Decision Log records the decisions that establish and modify that direction.

# 11. DATABASE FUNCTION AND TRIGGER SECURITY AUDIT

Review Date: 2026-11-04

Audit Document:
docs/DATABASE_FUNCTION_TRIGGER_SECURITY_REVIEW.md

Verified live database findings:
- categories_updated_at_trigger invokes set_products_updated_at() BEFORE UPDATE.
- products_updated_at_trigger invokes set_products_updated_at() BEFORE UPDATE.
- ensure_rls is an enabled ddl_command_end event trigger.
- ensure_rls invokes public.rls_auto_enable().
- rls_auto_enable() is SECURITY DEFINER, owned by postgres, with search_path pg_catalog.
- set_products_updated_at() is SECURITY INVOKER and owned by postgres.
- Both functions have EXECUTE grants for PUBLIC, anon, authenticated, postgres, and service_role.

Audit outcome:
- Read-only inspection completed.
- Broad function EXECUTE grants require further security review.
- The necessity and impact of revoking any grant have not been established.
- No permission, function, trigger, or schema change was made.
- No remediation is approved by this audit record.

Follow-up:
Review function privilege requirements and RLS policy coverage before proposing any database change.

This audit does not supersede D-015 through D-020.
Existing approval and implementation boundaries remain unchanged.
# 12. GIT HISTORY MIGRATION RECOVERY REVIEW

Review Date: 2026-11-04

Evidence reviewed:
- Local main branch and origin/main reference.
- Available Git commit history and tracked Supabase files.
- Live remote branch references using read-only inspection.
- Current working tree status.

Verified findings:
- The repository is not shallow.
- Only one commit is available across the inspected local refs.
- Local main and origin/main point to commit 03776e9f7b507027969afc4e09f460e40573db09.
- The live remote main branch points to the same commit.
- No tracked Supabase files or historical SQL migration files were found in the available commit.
- No additional remote branch was returned by the live remote-head inspection.

Decision:
- No additional historical migration SQL can currently be recovered from the inspected Git history.
- This conclusion does not rule out external repositories, backups, unadvertised branches or other historical sources.
- Existing uncommitted working-tree changes must be preserved.

Change status:
- Documentation-only update.
- No Git history was rewritten.
- No fetch, pull, checkout, reset, commit or push was performed.
- No database or migration changes were made.

Baseline migration remains unauthorized.
Production deployment remains unauthorized.

# 13. FINAL LOCAL MIGRATION RECOVERY FINDINGS — 2026-11-04

### Evidence

The project directory was created on 2026-11-02 at approximately 13:42, while Git metadata activity began at approximately 21:43. The initial commit was created at 21:47 and pushed/updated on origin/main at 22:21.

Therefore, the initial Git commit is not the beginning of project development. It is only the first available Git snapshot.

Read-only recovery checks established:

- The inspected local and remote Git history contains one initial commit.
- The two unreachable Git blobs are a Git ignore configuration and CSS content, not SQL migrations.
- The inspected backup directory contains only one database-extension file: the current `public-schema.sql` reference dump.
- The current `supabase/migrations` directory is empty.
- No additional historical SQL migration archive was recovered from the inspected sources.
- The recovered `store_settings` SQL matches the current public-schema state, but does not provide complete execution history.

### Decision

1. Treat the current local working tree and live schema snapshot as available evidence, not as a complete historical record.
2. Treat the original migration sequence as unrecovered.
3. Do not manufacture historical migration files or claim that an invented baseline represents the original execution history.
4. Do not generate or execute a baseline migration without a separate review and explicit approval.
5. Continue with read-only schema reconciliation before proposing any database change.

### Scope and limitations

This conclusion applies to the local repository, inspected Git refs and remote branch heads, unreachable objects, and current backup directory examined on 2026-11-04.

Other computers, external repositories and external backup locations have not been inspected.

### Change status

- Documentation-only update.
- No Git objects were restored or deleted.
- No Git history was rewritten.
- No fetch, pull, checkout, reset, merge, commit or push was performed.
- No database schema, data, function, trigger, grant or policy was changed.
- No migration was created or executed.
- Production deployment remains unauthorized.

### Next decision point

The next task is a separate read-only schema reconciliation review. Any baseline migration or database modification requires explicit approval.

# 14. READ-ONLY SCHEMA RECONCILIATION AND DEFAULT PRIVILEGE FINDINGS

Review Date: 2026-11-04

Evidence documents:
- `docs/DATABASE_MIGRATION_RECOVERY_INVENTORY.md`
- `docs/DATABASE_FUNCTION_TRIGGER_SECURITY_REVIEW.md`

### Verified findings

- Initial and fresh public-schema dumps are byte-for-byte identical; SHA256 is `1DC46DC0ACA94375EBCDD13D108366378FBC57116BB08FF9A826CA89B51DE820`.
- Five public tables and 49 columns reconcile with the live column inventory.
- All 21 inspected constraints, 12 indexes and 13 RLS policies reconcile with the available schema snapshot.
- Current live table grants were inspected separately and match the recorded restricted access model.
- RLS is enabled on all five inspected public tables.
- Two live public table triggers are absent from both schema dumps.
- Seven live event triggers were returned by the event-trigger catalog query.
- Two public functions and their security attributes were inspected.
- Broad default privileges exist for future public-schema objects created by `postgres` and `supabase_admin`.
- Inspected active application database references have no obvious column mismatch with the current schema.

### Decisions and restrictions

1. Treat the current public-schema dump as a schema reference snapshot, not a complete trigger or event-trigger inventory.
2. Treat live catalog query results as the available evidence for the two table triggers and seven event triggers.
3. Treat default privileges as future-object defaults; do not infer that they are the current grants on existing tables.
4. Do not revoke or alter default privileges until Supabase dependencies and operational requirements have been reviewed.
5. Do not assume RLS enablement automatically creates safe policies.
6. Treat schema reconciliation as separate from reconstruction of the original historical migration sequence.
7. A baseline migration must represent the inspected current state and must not be described as recovered historical execution history.
8. Baseline migration generation or execution requires separate explicit approval.

### Change status

- Read-only schema reconciliation completed for the inspected evidence.
- Documentation update only.
- No database schema, data, grant, default privilege, policy, function or trigger was changed.
- No migration was generated or executed.
- No Git history operation or production deployment was performed.

### Next decision point

Prepare a baseline-migration proposal for review, including object coverage, trigger handling, default privileges, Supabase-managed objects, and safe adoption strategy. Do not create or execute the baseline until explicitly approved.


## 15. Default Privileges Security Decision

Date: 2026-11-04

### Context

A read-only review inspected default ACLs, object ownership, Data API exposure settings, public functions, and table trigger dependencies.

### Evidence

- `postgres` owns five public application tables and two public functions.
- No matching public objects owned by `supabase_admin` were returned.
- Broad default ACL entries were observed for postgres and supabase_admin.
- Data API exposed schemas: `public` and `graphql_public`.
- Automatically expose new tables: ON.
- Exposed tables: 0 of 5.
- Exposed functions: 2 of 2.
- The two functions are an event-trigger function and a trigger function, not ordinary RPC business functions.
- The trigger function is used by enabled update triggers on categories and products.

### Decisions

1. Preserve existing table grants and policies.
2. Do not modify supabase_admin default privileges.
3. Treat automatic exposure of new tables as a configuration risk requiring a separately approved change.
4. Consider disabling automatic exposure after confirming the expected effect on future Data API grants and application workflows.
5. Do not change postgres default ACLs until dependency, ownership, and Supabase-managed behavior are fully reviewed.
6. Do not revoke function EXECUTE grants based only on the Dashboard exposure count.

### Authorization boundary

This entry records a security recommendation, not authorization to execute it.

No database, Dashboard, application code, migration, Git, or deployment changes were made during this review.


---

## D-021 - Reusable Business Template Architecture

Date: 2026-11-05

Status: APPROVED

### Context

Royal Shop is the first client-specific implementation. The architecture should also support future business projects without rebuilding the common foundation each time.

### Decision

1. Maintain one reusable Core Template for common storefront, administration, authentication, database integration and deployment capabilities.
2. Treat Royal Shop as the first business-specific implementation of this architecture.
3. Keep business identity, branding, contact information, operational settings and feature configuration separate from reusable core logic.
4. Allow business-specific modules where genuinely required. Do not force every business into the same operational model.
5. Use a separate Supabase project and isolated business data for each client by default.
6. Prepare documented fresh-project setup, database bootstrap, migrations, RLS, Edge Functions, Storage and deployment procedures.
7. Never include one client's credentials, customer data, orders, inventory or private business content in another client's reusable template.
8. Preserve existing business workflows and backward compatibility.
9. Do not introduce shared multi-tenant database infrastructure in the initial template.
10. Implement template separation incrementally. This decision does not authorize a broad code rewrite or database migration.

### Implementation Principles

- Keep shared functionality in the reusable core.
- Keep business-specific settings in a clearly identified configuration layer.
- Keep optional business capabilities modular.
- Document architectural and implementation changes continuously.
- Test fresh setup independently from the existing live project.
- Do not use fake inventory or demo customer/order records as real business data.

### Authorization Boundary

This decision approves the architectural direction and documentation.

It does not authorize database changes, migration execution, production deployment, Git operations or a large-scale application refactor.

