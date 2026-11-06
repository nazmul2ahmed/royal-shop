# ROYAL SHOP
## Development Roadmap

Version: 1.0
Created: 4 November 2026
Related Documents:
- PROJECT_CHARTER.md
- DECISION_LOG.md

Current Phase: Phase 0 — Security and Database Readiness (release gate); Phase 1 — Local Application Implementation (parallel workstream)
Current Release Status: Not Production Ready

---

# 1. ROADMAP PURPOSE

This document defines the implementation sequence for Royal Shop.

Objectives:
- Complete Phase 0 security hardening.
- Prevent premature public order activation.
- Protect customer and business data.
- Ensure reliable order and stock operations.
- Prepare the system for either approved deployment model.
- Produce sufficient documentation for maintenance and handover.

This roadmap is a plan, not evidence that any task has been completed.

# 2. ROADMAP STATUS DEFINITIONS

| Status | Meaning |
|---|---|
| NOT STARTED | Work has not started |
| IN PROGRESS | Work is actively being implemented |
| BLOCKED | Work cannot proceed because of a dependency |
| TESTING | Implementation is awaiting verification |
| COMPLETED | Implementation and required verification passed |
| DEFERRED | Intentionally postponed |
| NOT AUTHORIZED | Requires explicit approval before proceeding |

A task must not be marked COMPLETED merely because code was written.

# 3. CURRENT PROJECT BASELINE

## Verified Existing Work

- [x] Database table grants reviewed and hardened.
- [x] RLS enabled on reviewed sensitive tables.
- [x] Admin authentication tested.
- [x] Protected admin routes tested.
- [x] Password recovery tested.
- [x] Store settings table created.
- [x] Store settings policies and grants verified.
- [x] Server-side public order control implemented locally.
- [x] Admin public order control UI implemented locally.
- [x] Request body validation implemented locally.
- [x] Isolated request validation tests passed.
- [x] Frontend production build passed.

## Important Baseline Limitations

- Local changes have not automatically been deployed.
- Existing database changes must be reconciled with migration files.
- public_order_ready is planned but must not be assumed to exist in the database.
- Atomic stock and order creation is not implemented yet.
- Idempotency is not implemented yet.
- Turnstile is not integrated yet.
- Rate limiting is not implemented yet.
- Checkout fulfillment validation is incomplete.

# 4. PHASE 0A - BASELINE AND DATABASE RECONCILIATION

Status: IN PROGRESS

Objective:
Establish and document the verified application and database baseline before further security implementation.

## Completed Baseline Inspections

- [x] Inspect the current project structure.
- [x] Review create-order Edge Function.
- [x] Review Admin Dashboard order control.
- [x] Inspect actual store_settings schema.
- [x] Inspect actual orders and products schemas.
- [x] Review current RLS policies and grants.
- [x] Inspect database constraints and indexes.
- [x] Inspect database triggers and trigger functions.
- [x] Inspect Supabase migrations and SQL directories.
- [x] Review Supabase README and existing SQL archive.
- [x] Confirm that the local migrations directory is empty.
- [x] Confirm that the SQL directory contains only 03-verify-orders-schema.sql.
- [x] Confirm that the existing SQL file is a read-only verification query.
- [x] Historical observation: supabase/config.toml was absent during the earlier inspection. Current local state: the file exists.
- [x] Historical observation: supabase/.gitignore was absent during the earlier inspection. Current local state: the file exists.
- [x] Confirm that the Supabase migration history table was not found.


### Reconciliation Update — 2026-11-06

Completed for the inspected evidence:
- Local historical migration recovery investigation.
- Read-only Development Database schema reconciliation.
- Read-only function, trigger and default-privilege reviews.
- Application-to-database dependency review.

Scope limitations:
- No complete historical migration sequence was recovered.
- External repositories, previous computers and external backup locations remain uninspected.
- Supabase SQL Editor history has not been established as fully recovered.
- The local migrations directory remains empty.
- The configuration-file absence statements above are historical observations, not current local state.

Remaining Phase 0A work:
- Prepare a design-only baseline migration proposal.
- Review default-privilege remediation options.
- Document a safe baseline adoption strategy preserving existing data, grants, RLS and trigger behavior.
- Obtain separate approval before migration generation or execution.
## Verified Migration Gaps

- No local migration scripts currently exist in supabase/migrations/.
- A complete original SQL migration sequence has not been recovered from the inspected sources.
- The current database schema has been reconciled against the available reference dump and recovered SQL for the inspected evidence; this does not establish a complete historical execution record.
- The existing verification SQL file is read-only and does not create or modify database objects.
- No migration history table was found during the earlier database inspection.
- No baseline migration has been generated or executed as part of this current workstream.

Historical recovery limitations:
- External repositories, previous computers and external backup locations remain uninspected.
- Supabase SQL Editor history has not been established as fully recovered.
- The recovered SQL and schema snapshot must not be treated as a complete historical migration archive.

## Remaining Tasks

- [x] Recover and review available historical SQL and local repository evidence within the inspected scope.
- [x] Reconcile available SQL and schema reference evidence with the inspected Development Database state.
- [ ] Prepare a design-only baseline migration proposal.
- [ ] Review default-privilege findings and document proposed remediation options.
- [ ] Define a safe baseline adoption strategy that preserves existing data, grants, RLS policies, functions and triggers.
- [ ] Document backup, recovery and verification requirements before any separately approved schema migration.
- [ ] Obtain explicit approval before generating or executing any migration.

Acceptance Criteria:
- Actual database structure is documented.
- Existing database changes are traceable or explicitly documented as unrecovered.
- Migration gaps and unknown historical changes are clearly identified.
- A baseline migration strategy is reviewed before execution.
- No existing business data is damaged.
- No migration is executed without review and backup.

# 5. PHASE 0B - PUBLIC ORDER READINESS GATE

Status: NOT STARTED

Objective:
Ensure public orders remain disabled until security readiness is explicitly established.

Tasks:
- [ ] Design the public_order_ready setting.
- [ ] Add it through a documented database migration.
- [ ] Keep its default value FALSE.
- [ ] Update the server-side order control to check both settings.
- [ ] Ensure missing settings or database errors fail closed.
- [ ] Update Dashboard security status display.
- [ ] Prevent the Admin UI from enabling public orders while readiness is false.
- [ ] Ensure the server independently enforces both flags.

Required Conditions:

public_order_enabled = TRUE
public_order_ready = TRUE

Both must be true before the server accepts a public order.

Acceptance Criteria:
- Default state rejects public orders.
- Missing or invalid settings reject public orders.
- Dashboard cannot bypass server-side checks.
- No order is created when readiness is false.

# 6. PHASE 0C - CLOUDFLARE TURNSTILE

Status: NOT STARTED

Objective:
Protect public order submission from automated abuse.

Tasks:
- [ ] Confirm the production hostname requirements.
- [ ] Create and configure a Turnstile widget.
- [ ] Store the Site Key in frontend configuration.
- [ ] Store the Secret Key in Supabase Edge Function secrets.
- [ ] Never expose the Secret Key in frontend code.
- [ ] Add Turnstile to checkout.
- [ ] Send the verification token to create-order.
- [ ] Verify the token server-side using Cloudflare Siteverify.
- [ ] Validate the expected hostname.
- [ ] Validate the expected action where configured.
- [ ] Reject missing, invalid, expired, or reused tokens.
- [ ] Fail closed if verification is unavailable.
- [ ] Test success and failure scenarios.

Acceptance Criteria:
- A valid token is required.
- Client-side checks alone cannot authorize an order.
- Secret Key is never exposed to the browser.
- Verification failure creates no order.

# 7. PHASE 0D - SERVER-SIDE RATE LIMITING

Status: NOT STARTED

Objective:
Reduce abusive requests and automated order attempts.

Tasks:
- [ ] Select a suitable server-side rate-limit storage mechanism.
- [ ] Document provider cost and operational dependencies.
- [ ] Define request limits and time windows.
- [ ] Define safe request identifiers.
- [ ] Review trusted proxy and IP-header handling.
- [ ] Implement server-side enforcement.
- [ ] Define behavior when the rate-limit service is unavailable.
- [ ] Add appropriate response codes.
- [ ] Test repeated and concurrent requests.

Acceptance Criteria:
- Rate limits cannot be bypassed by changing frontend controls.
- Untrusted forwarding headers are not blindly accepted.
- Excessive requests are rejected.
- Rate-limit service failure does not silently disable protection.

# 8. PHASE 0E - IDEMPOTENCY AND DUPLICATE ORDER PROTECTION

Status: NOT STARTED

Objective:
Prevent repeated submissions from creating duplicate orders.

Tasks:
- [ ] Define an idempotency-key format.
- [ ] Decide key storage and retention policy.
- [ ] Design database-level uniqueness protection.
- [ ] Define behavior for repeated identical requests.
- [ ] Define behavior for conflicting reuse of a key.
- [ ] Implement transactional protection.
- [ ] Test browser retries and repeated submissions.
- [ ] Test concurrent duplicate requests.

Acceptance Criteria:
- Repeated submissions cannot create duplicate orders.
- Database constraints enforce uniqueness.
- Failed requests do not leave misleading idempotency records.
- Retry behavior is documented.

# 9. PHASE 0F - ATOMIC STOCK AND ORDER CREATION

Status: NOT STARTED

Objective:
Prevent overselling and inconsistent stock updates.

Tasks:
- [ ] Review current product stock structure.
- [ ] Design transactional order creation.
- [ ] Use a database transaction or suitable database function.
- [ ] Lock or safely update relevant stock records.
- [ ] Validate product status and stock within the transaction.
- [ ] Calculate prices using trusted database values.
- [ ] Create the order and update stock atomically.
- [ ] Ensure failed transactions leave no partial changes.
- [ ] Define cancellation and stock-restoration behavior separately.
- [ ] Test concurrent requests for the same product.

Acceptance Criteria:
- Stock cannot become negative through concurrent orders.
- No order is created with unavailable stock.
- Failed order creation does not incorrectly reduce stock.
- Database remains consistent after concurrent requests.

# 10. PHASE 0G - CHECKOUT FULFILLMENT VALIDATION

Status: NOT STARTED

Objective:
Collect reliable delivery information before accepting an order.

Required Fields:
- [ ] Customer name.
- [ ] Valid Bangladesh phone number.
- [ ] District.
- [ ] Upazila.
- [ ] Full delivery address.

Optional Fields:
- [ ] Area or locality.
- [ ] Customer note.

Additional Tasks:
- [ ] Review frontend checkout validation.
- [ ] Implement equivalent server-side validation.
- [ ] Reject missing required information.
- [ ] Reject invalid field types and unreasonable lengths.
- [ ] Define supported district and upazila values.
- [ ] Ensure order records store validated fulfillment data.
- [ ] Test invalid and incomplete checkout submissions.

Acceptance Criteria:
- Required fulfillment fields cannot be omitted.
- Server validation is independent of frontend validation.
- Orders contain usable delivery information.

# 11. PHASE 0H - SECURITY INTEGRATION TESTING

Status: NOT STARTED

Objective:
Verify the complete order pipeline as one security-controlled process.

Test Categories:

## Access Control
- [ ] Anonymous users cannot read orders directly.
- [ ] Unauthorized users cannot modify products or settings.
- [ ] Admin access is enforced.
- [ ] Service-role credentials remain server-side.

## Request Validation
- [ ] Invalid HTTP method rejected.
- [ ] Invalid content type rejected.
- [ ] Malformed JSON rejected.
- [ ] Oversized body rejected.
- [ ] Invalid customer information rejected.
- [ ] Invalid product identifiers rejected.
- [ ] Invalid quantities rejected.

## Order Security
- [ ] Public ordering disabled.
- [ ] Readiness disabled.
- [ ] Turnstile missing.
- [ ] Turnstile invalid.
- [ ] Turnstile reused.
- [ ] Rate limit exceeded.
- [ ] Duplicate request.
- [ ] Product inactive.
- [ ] Insufficient stock.
- [ ] Concurrent order attempts.
- [ ] Database failure.
- [ ] Unexpected server error.

## Data Integrity
- [ ] Client-supplied prices are ignored.
- [ ] Server calculates totals.
- [ ] Order items match verified products.
- [ ] Stock remains consistent.
- [ ] Failed requests create no partial order.

Acceptance Criteria:
All critical security tests pass.
No unresolved critical or high-risk issue remains.
Evidence is recorded in the security checklist.

# 12. PHASE 0I - DEPLOYMENT PREPARATION

Status: NOT STARTED

Objective:
Prepare a portable and documented production deployment.

Tasks:
- [ ] Review production environment variables.
- [ ] Document Cloudflare Pages configuration.
- [ ] Document Supabase project setup.
- [ ] Document database migrations.
- [ ] Document Edge Function deployment.
- [ ] Document Turnstile configuration.
- [ ] Document secret management.
- [ ] Prepare backup procedure.
- [ ] Prepare restore procedure.
- [ ] Verify admin account setup procedure.
- [ ] Prepare production smoke-test checklist.
- [ ] Document rollback procedure.

Deployment Model A:
Client-Owned Infrastructure.

Deployment Model B:
Developer-Managed Service.

Final model remains pending client confirmation.

Acceptance Criteria:
A qualified maintainer can follow the documentation to prepare the environment.
No secret or production credential is embedded in source code.

# 13. PHASE 0J - CLIENT HANDOVER PREPARATION

Status: NOT STARTED

Tasks:
- [ ] Prepare Admin User Guide.
- [ ] Prepare Deployment Guide.
- [ ] Prepare Database Migration Guide.
- [ ] Prepare Backup and Restore Guide.
- [ ] Prepare Maintenance Policy.
- [ ] Document ownership and access responsibilities.
- [ ] Document billing responsibilities.
- [ ] Document support boundaries.
- [ ] Document exit and infrastructure transfer procedure.
- [ ] Obtain client review and approval.

Acceptance Criteria:
The client understands how to operate the system and who is responsible for its infrastructure and maintenance.

# 14. PRODUCTION RELEASE GATE

Status: NOT AUTHORIZED

Public ordering must remain disabled until all of the following are true:

- [ ] Phase 0A completed.
- [ ] Phase 0B completed.
- [ ] Phase 0C completed.
- [ ] Phase 0D completed.
- [ ] Phase 0E completed.
- [ ] Phase 0F completed.
- [ ] Phase 0G completed.
- [ ] Phase 0H completed.
- [ ] Required backup and restore procedures verified.
- [ ] Production environment reviewed.
- [ ] Client approval obtained.
- [ ] Explicit deployment authorization obtained.

Passing a local build is not production security approval.

# 15. WORK SEQUENCE AND DEPENDENCIES

The implementation order is:

1. Baseline and database reconciliation.
2. Public order readiness gate.
3. Turnstile integration.
4. Rate limiting.
5. Idempotency.
6. Atomic stock and order creation.
7. Checkout fulfillment validation.
8. Integrated security testing.
9. Deployment preparation.
10. Client handover preparation.

A dependency may require an earlier task to be revisited.
Any change to the approved sequence must be documented.

### Workstream sequencing clarification — 2026-11-06

Phase 0 remains the mandatory security and database release gate. Phase 1 local application implementation may proceed in parallel where it does not depend on unapproved database changes or deployment. Parallel local work does not authorize public ordering or production release.

# 16. OUT OF SCOPE FOR PHASE 0

The following are not part of this security roadmap:

- Payment gateway.
- Customer account system.
- Customer order tracking is outside the Phase 0 security implementation sequence; it is covered by the separately approved Customer Journey architecture and remains a Phase 1 implementation task.
- Delivery partner automation.
- Coupon system.
- Advanced analytics.
- Marketing automation.
- Shared multi-client SaaS architecture.

The Customer Journey architecture is separately approved as a design. Its implementation remains pending and does not authorize database migration, Edge Function deployment or production release. Other scope additions still require separate change requests and approval.

# 17. ROADMAP CHANGE CONTROL

Every significant roadmap change must:
- Reference a decision ID.
- Explain why the sequence or scope changes.
- Identify security implications.
- Identify cost and time implications.
- Record approval status.
- Update the Decision Log where applicable.

Never mark work complete without verification evidence.

# 18. CURRENT NEXT TASK

Next approved task:

PHASE 0A — DESIGN-ONLY BASELINE MIGRATION PROPOSAL AND DEFAULT PRIVILEGE REVIEW

Immediate objectives:
- Prepare a proposed baseline migration strategy from the inspected Development Database state.
- Identify existing objects that must be preserved rather than recreated.
- Document tables, columns, constraints, indexes, RLS policies, grants, functions and triggers.
- Account explicitly for the incomplete historical migration archive.
- Review default-privilege findings and document reversible remediation options.
- Identify backup, adoption and verification requirements.

Reference documents:
- `docs/DATABASE_MIGRATION_RECOVERY_INVENTORY.md`
- `docs/DATABASE_FUNCTION_TRIGGER_SECURITY_REVIEW.md`
- `docs/BUGS_AND_BLOCKERS.md`
- `docs/PROJECT_STATUS.md`

Restrictions:
- Design and review only.
- Do not generate migration files at this stage.
- Do not execute SQL or change database configuration.
- Do not change existing data, RLS, grants, functions or triggers.
- Do not enable public ordering.
- Production deployment remains unauthorized.
# 19. DATABASE FUNCTION AND TRIGGER SECURITY AUDIT

Review Date: 2026-11-04

Status: READ-ONLY AUDIT COMPLETED; REMEDIATION PENDING

Audit document:
docs/DATABASE_FUNCTION_TRIGGER_SECURITY_REVIEW.md

Completed inspections:
- Public schema table triggers.
- Database event triggers.
- Function definitions and ownership.
- SECURITY DEFINER status and search_path.
- Function EXECUTE privileges.

Verified:
- categories and products have their expected updated_at triggers.
- ensure_rls is enabled and invokes rls_auto_enable().
- Both reviewed functions have broad EXECUTE grants.

Remaining work:
- Assess whether broad EXECUTE grants are necessary.
- Verify event-trigger privilege behavior before proposing permission changes.
- Review RLS policy coverage and future-table safeguards.

Restrictions:
- Do not revoke or grant function privileges without documented approval.
- Do not modify or disable event triggers without documented approval.
- Do not treat RLS enablement as a substitute for appropriate RLS policies.
- No database changes were made during this audit.

Roadmap sequencing:
Historical archive recovery and read-only schema reconciliation are complete for the inspected evidence.
The current next task is a design-only baseline migration proposal and default-privilege review.
This security audit does not authorize migration generation, database changes or production deployment.
# 20. MIGRATION GIT RECOVERY RESULTS

Review Date: 2026-11-04

Status: AVAILABLE GIT HISTORY REVIEWED; HISTORICAL MIGRATION NOT RECOVERED

Completed:
- Inspected local main and origin/main.
- Confirmed the repository is not shallow.
- Reviewed all available local commit history.
- Reviewed tracked Supabase files in the current commit.
- Inspected live remote branch references.
- Confirmed the live remote main points to the same initial commit as local main.
- Confirmed no historical SQL migration files are present in the inspected Git history.

Limitations:
- Other repositories and external backups have not been inspected.
- Unadvertised or inaccessible remote branches have not been ruled out.
- No complete original migration execution history is available.

Safety:
- Existing uncommitted changes remain untouched.
- No fetch, pull, checkout, reset, merge, commit or push was performed.
- No migration was created or executed.
- No database schema or permissions were changed.
- Production deployment remains unauthorized.

Roadmap sequencing:
Local Git history and available local backup recovery investigations are complete for the inspected sources.
External repositories, previous computers and external backup locations remain outside the inspected scope.
The current task is a design-only baseline migration proposal and default-privilege review.
Baseline migration generation or execution requires separate documented approval.

# 21. FINAL LOCAL MIGRATION RECOVERY FINDINGS

## Completed recovery checks

- Inspected the current local migration directory.
- Reviewed available local Git history and live remote branch heads.
- Established that the local project directory predates Git initialization.
- Confirmed that the initial Git commit is not evidence of the original project start.
- Inspected both unreachable Git blobs; neither contains SQL migration content.
- Inspected the current backup directory for SQL and database/archive formats.
- Reconciled the recovered `store_settings` SQL with the current public-schema reference dump.

## Final recovery result

No additional historical migration SQL was recovered from the inspected local repository, Git objects, remote branch heads or backup directory.

The current `public-schema.sql` is a schema reference snapshot, not a historical migration archive. The recovered `store_settings` SQL is a verified saved definition, not a complete execution history.

External repositories, previous computers and external backup locations remain outside the inspected scope.

## Completed follow-up — Read-only Schema Reconciliation

The completed reconciliation covered:

1. Current public-schema reference dump.
2. Inspected Development Database tables, columns, constraints, indexes, policies, grants, functions and triggers.
3. Available recovered SQL files.
4. Current application queries and Edge Function database dependencies.

The reconciliation report documents:

- Confirmed matches.
- Differences between the live Development Database and local reference.
- Application database dependencies.
- Unverified or missing historical evidence.
- Identified risks and recommended next actions.

The findings are limited to the inspected evidence and do not establish a complete historical migration record.

## Safety gates

- Do not invent historical migrations.
- Do not generate or execute a baseline migration during reconciliation.
- Do not modify production database objects or data.
- Do not deploy the Edge Function or frontend.
- Any database change requires a separate documented proposal and explicit approval.

**Phase 0A remains active.** Historical archive recovery and read-only schema reconciliation are complete for the inspected evidence. The baseline migration decision and remaining security work are pending.

# 22. READ-ONLY SCHEMA RECONCILIATION RESULTS

Review Date: 2026-11-04

Status: READ-ONLY RECONCILIATION COMPLETED FOR INSPECTED EVIDENCE; BASELINE DECISION PENDING

Audit documents:
- `docs/DATABASE_MIGRATION_RECOVERY_INVENTORY.md`
- `docs/DATABASE_FUNCTION_TRIGGER_SECURITY_REVIEW.md`

## Completed inspections

- Generated a fresh linked public-schema dump.
- Compared the fresh dump with the earlier dump; SHA256 hashes are identical.
- Reconciled five tables and 49 columns.
- Reconciled 21 constraints, 12 indexes and 13 RLS policies.
- Reviewed current live table grants and RLS enablement.
- Reviewed two live public table triggers and seven live event triggers.
- Reviewed two public function definitions and their security attributes.
- Inspected default privileges for `postgres` and `supabase_admin`.
- Compared active application database dependencies with the inspected schema.

## Confirmed discrepancies and risks

- Both public-schema dumps omit the two live public table trigger definitions.
- The public-schema dump is not a complete global event-trigger inventory.
- Broad default privileges exist for future public-schema objects created by `postgres` and `supabase_admin`.
- The RLS auto-enable event trigger does not create or validate RLS policies.
- Historical migration sequence remains unrecovered.
- No obvious application-to-schema column mismatch was identified in the inspected active files.
- Order-creation integrity and abuse protections remain separate Phase 0 implementation tasks.

## Remaining work

1. Review Supabase dependencies and operational requirements for broad default privileges.
2. Prepare a baseline-migration proposal representing the inspected current schema state.
3. Explicitly document trigger and event-trigger handling in that proposal.
4. Define a safe baseline adoption strategy that does not replay existing schema changes against the current production database.
5. Obtain explicit approval before generating or executing a baseline migration.
6. Continue the Phase 0 security work in its documented sequence.

## Safety gates

- Do not invent historical migrations.
- Do not treat the schema snapshot as a complete trigger or event-trigger inventory.
- Do not change default privileges without a separate reviewed and approved proposal.
- Do not generate or execute a baseline migration without explicit approval.
- Do not modify production database objects or data during this documentation task.
- Do not deploy the Edge Function or frontend.
- Do not commit or push these documentation changes unless separately requested.

## Current next task

Prepare a design-only baseline migration proposal and review the default privilege findings. No migration file generation or database execution is included in that proposal stage.


## 23. Default Privileges Security Review

Review date: 2026-11-04

### Completed read-only checks

- Audited default ACL entries for postgres and supabase_admin.
- Checked public-schema object ownership for both roles.
- Checked Data API exposed schemas and automatic exposure setting.
- Identified the two exposed public functions.
- Verified the table triggers using set_products_updated_at.
- Confirmed that the two functions are trigger/event-trigger functions rather than ordinary RPC business functions.

### Findings

- Automatically expose new tables is ON.
- `public` and `graphql_public` are selected as exposed schemas.
- Dashboard reports zero exposed tables and two exposed functions.
- Broad postgres default privileges may affect future objects created by postgres.
- Supabase-managed supabase_admin defaults must be treated separately.
- Current application table grants and RLS policies were audited independently and must be preserved.

### Recommended next actions (not yet authorized)

1. Review the exact effects of turning OFF Automatically expose new tables.
2. Prepare a separate, reversible Dashboard configuration change proposal.
3. Map future table, sequence, and function creation owners.
4. Review postgres default ACL dependencies before proposing any SQL change.
5. Re-check API access and application workflows after any separately approved configuration change.

### Explicit exclusions

No default privileges were changed. No function ACLs, triggers, policies, table grants, schemas, migrations, application code, Git history, or production deployment were changed.

# 24. CURRENT WORKSTREAM AND AUDIT UPDATE — 2026-11-06

## Current workstream structure

- Phase 0 — Security and Database Readiness remains the mandatory release gate.
- Phase 1 — Local Application Implementation may proceed in parallel where work does not depend on unapproved database changes or deployment.
- Public ordering remains disabled until all required security and readiness conditions are explicitly verified.

## Completed within the inspected evidence

- Historical migration archive recovery investigation.
- Read-only Development Database schema reconciliation.
- Database function, trigger and privilege inspections.
- Application-to-database dependency review.

These completed investigations do not establish a complete historical migration execution record. External repositories, previous computers, external backups and complete Supabase SQL Editor history remain unverified.

## Current next task

Prepare a design-only baseline migration proposal and review default-privilege findings.

The proposal must account for:
- Existing data, grants, RLS policies, functions and triggers that must be preserved.
- Incomplete historical migration evidence.
- Safe adoption without replaying existing schema changes.
- Backup, recovery and verification requirements.
- Reversible remediation options for default privileges.

Migration generation and execution require separate documented approval.

## Parallel Phase 1 application status

- Development Database order RPCs and supporting tables required by the current order workflow are missing.
- Public ordering remains disabled.
- Customer Journey architecture has been approved separately, but local tracking-route and acknowledgement Edge Function implementation remains pending.
- Local application implementation must not be treated as proof of live database integration or deployment readiness.

## Reference documents

- `docs/BUGS_AND_BLOCKERS.md`
- `docs/PROJECT_STATUS.md`
- `docs/CUSTOMER_JOURNEY_ARCHITECTURE.md`
- `docs/DATABASE_MIGRATION_RECOVERY_INVENTORY.md`
- `docs/DATABASE_FUNCTION_TRIGGER_SECURITY_REVIEW.md`

## Change boundaries

This documentation update does not authorize:
- Database schema, data, grants, RLS, function or trigger changes.
- Migration file generation or execution.
- Edge Function or frontend deployment.
- Git staging, commit or push.
- Production deployment or public ordering activation.

Production readiness has not been established.



