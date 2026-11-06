# ROYAL SHOP
## Project Charter & Development Master Plan

Version: 1.0
Created: 3 November 2026
Project Type: Client-specific E-commerce Website
Current Status: Phase 0 - Security Hardening
Deployment Strategy: Client-Owned and Developer-Managed

---

# 1. PROJECT VISION

Royal Shop is a secure, maintainable, responsive e-commerce platform for a specific client operating in the baby-care product category.

The platform must be:
- Secure and reliable.
- Easy for the client to operate.
- Portable between infrastructure accounts.
- Properly documented.
- Maintainable after handover.
- Capable of future improvements without unnecessary rebuilding.

# 2. CORE DEVELOPMENT PRINCIPLES

1. Plan First, Code Second.
2. Security before Production Launch.
3. No unapproved scope expansion.
4. No hardcoded credentials or secrets.
5. Database changes must be documented through migrations.
6. Business data belongs to the client.
7. Public ordering remains disabled until security readiness is approved.
8. Back up affected files before modifications.
9. Verify every important change.
10. No commit, push, or deployment without explicit authorization.
11. Never create fake products or inventory as real business data.
12. Prefer small, testable changes over unnecessary rewrites.

# 3. OWNERSHIP AND DEPLOYMENT MODELS

## Model A - Client-Owned Infrastructure

The client owns:
- Domain.
- Cloudflare account.
- Supabase project.
- Production database.
- Business and customer data.
- Production billing.
- Business administration account.

The developer receives authorized access for development and maintenance.

## Model B - Developer-Managed Service

The developer manages:
- Cloudflare infrastructure.
- Supabase infrastructure.
- Deployment.
- Technical maintenance.
- Backup and recovery operations.

The client retains ownership of:
- Business identity.
- Products and inventory records.
- Customer information.
- Orders and transaction records.
- Business content and operational data.

Each client must have isolated production data and access boundaries.

Shared multi-client database tenancy is not approved until a separate isolation architecture has been designed and tested.

## Ownership Decision

The final model is pending client confirmation.

Development must remain portable and must not permanently bind the project to either model.

# 4. TECHNOLOGY STACK

| Layer | Technology |
|---|---|
| Frontend | React 19 |
| Build Tool | Vite 8 |
| Backend | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Server Functions | Supabase Edge Functions |
| Hosting | Cloudflare Pages |
| Bot Protection | Cloudflare Turnstile |
| Source Control | Git |
| Development Environment | Windows, PowerShell, VS Code |

Technology changes require documented justification and approval.

# 5. FUNCTIONAL SCOPE

## Public Storefront
- Home Page.
- Shop / Product Listing.
- Category Browsing.
- Product Details.
- Shopping Cart.
- Checkout.
- Order Submission.
- Responsive Mobile Experience.

## Admin Panel
- Admin Authentication.
- Protected Dashboard.
- Product Management.
- Category Management.
- Order Management.
- Website Content Management.
- Public Order Enable / Disable Control.

## Future Features - Not Yet Approved
- Payment Gateway.
- Customer Accounts.
- Customer Order Tracking.
- Inventory Automation.
- Delivery Management.
- Coupons and Discounts.
- Advanced Analytics.
- Automated Notifications.

Each future feature requires a separate scope decision.

# 6. SECURITY REQUIREMENTS

## Authentication and Authorization
- Only authorized administrators may access protected management functions.
- Admin role must be verified.
- Public visitors must not receive privileged database access.
- Password recovery and session handling must remain functional.

## Database Security
- RLS enabled on sensitive tables.
- Least-privilege database grants.
- Anonymous users cannot directly access customer orders.
- Service-role credentials remain server-side.
- Database constraints validate critical data.

## Public Order Protection

All conditions must pass before creating an order:

1. Public ordering is enabled.
2. Security readiness is enabled.
3. Request method and body are valid.
4. Turnstile verification succeeds.
5. Rate limits are not exceeded.
6. Product and price are verified from the database.
7. Stock availability is verified.
8. Duplicate order protection passes.

If a security check fails, no order may be created.

## Initial Order State

public_order_enabled = false
public_order_ready = false

Both must be explicitly enabled after required security and operational tests.

## Security Failure Policy
- Settings lookup failure: Fail Closed.
- Turnstile verification failure: Fail Closed.
- Rate limit exceeded: Reject request.
- Invalid request: Reject request.
- Unexpected server error: Return a generic error without exposing internal details.

# 7. PHASE 0 - SECURITY HARDENING

## Completed and Verified Locally

- [x] Database table grants reviewed and hardened.
- [x] Admin authentication flow tested.
- [x] Protected admin routes verified.
- [x] Password recovery tested.
- [x] Store settings table created.
- [x] Store settings RLS and grants verified.
- [x] Server-side Public Order control added locally.
- [x] Request body size and content validation added locally.
- [x] Unexpected server errors changed to generic 500 responses.
- [x] Isolated Deno type check passed.
- [x] Request reader unit tests passed.
- [x] Dashboard Public Order control added locally.
- [x] Frontend production build passed.

## Pending

- [ ] Turnstile integration.
- [ ] Rate limiting.
- [ ] Idempotency protection.
- [ ] Atomic stock validation and order creation.
- [ ] Checkout fulfillment data validation.
- [ ] Database migration reconciliation and original SQL recovery.
- [ ] Final security review.
- [ ] Production deployment approval.

Important: Local changes have not automatically been deployed to Supabase or Cloudflare.

# 8. DATABASE AND DATA INTEGRITY

The database must support:
- Reproducible SQL migrations.
- Documented schema.
- Secure administrator access.
- Reliable order records.
- Product and stock integrity.
- Backup and restore.
- Portable configuration.

Existing Dashboard-created SQL changes must be reconciled with the actual database before migration files are created.

Never generate migrations from assumptions.

# 9. DUAL DEPLOYMENT PREPARATION

## Client-Owned Deployment

Prepare:
- Client Cloudflare setup guide.
- Client Supabase setup guide.
- Environment configuration guide.
- Database migration instructions.
- Edge Function deployment instructions.
- Domain and DNS setup.
- Admin account creation.
- Production verification checklist.

## Developer-Managed Deployment

Prepare:
- Developer infrastructure setup.
- Client-specific Supabase project.
- Client-specific secrets and environment.
- Client data isolation.
- Backup and restore policy.
- Billing and maintenance responsibilities.
- Exit and ownership-transfer procedure.

# 10. DOCUMENTATION STRUCTURE

docs/
  PROJECT_CHARTER.md
  CHANGELOG.md
  DECISION_LOG.md
  DEVELOPMENT_ROADMAP.md
  SECURITY_CHECKLIST.md
  DEPLOYMENT_GUIDE.md
  DATABASE_MIGRATION.md
  BACKUP_AND_RESTORE.md
  CLIENT_HANDOVER.md
  ADMIN_USER_GUIDE.md
  MAINTENANCE_POLICY.md

Documentation must be updated whenever a relevant decision or implementation changes.

# 11. CHANGE CONTROL POLICY

No scope or architecture change may happen informally.

Every proposed change must document:
- Change ID.
- Existing requirement.
- Proposed change.
- Reason.
- Security impact.
- Cost and time impact.
- Compatibility impact.
- Approval status.

## Change Classifications

A - Critical Security Fix:
May be prioritized immediately, with documentation.

B - Required Scope Change:
Requires explicit approval.

C - Optional Enhancement:
Recorded for future consideration; not implemented automatically.

D - Rejected or Deferred:
Recorded with a reason.

The Project Charter must never be silently rewritten to accommodate an unapproved idea.

# 12. DEVELOPMENT WORKFLOW

For each development task:

1. Identify the approved requirement.
2. Inspect the existing implementation.
3. Explain the proposed change.
4. Back up affected files.
5. Make the smallest appropriate change.
6. Run relevant tests.
7. Verify the result.
8. Update documentation and task status.
9. Wait for explicit authorization before deployment.

## Working Preferences
- Bangla instructions.
- Exact PowerShell commands.
- One practical step at a time.
- Wait for command output before continuing.
- Avoid unnecessary repeated tests.
- Never request passwords, API keys, or secrets in chat.

# 13. PRODUCTION LAUNCH CRITERIA

Public ordering must not launch until:

- [ ] Security hardening is complete.
- [ ] Turnstile server verification works.
- [ ] Rate limiting is tested.
- [ ] Duplicate order protection is tested.
- [ ] Stock concurrency is protected.
- [ ] Checkout information is complete.
- [ ] Admin access is verified.
- [ ] Backup and recovery are documented.
- [ ] Production environment is configured.
- [ ] Client approves the launch.
- [ ] Deployment is explicitly authorized.

# 14. PROJECT DECISION REGISTER

| Decision | Status |
|---|---|
| Project is for a specific client | Confirmed |
| Dual deployment preparation | Approved |
| Final ownership model | Pending client |
| React and Vite | Current approved stack |
| Supabase | Current approved backend |
| Cloudflare Pages | Current hosting |
| Public orders initially disabled | Approved |
| Security-first development | Approved |
| Shared multi-client database | Not approved |
| Production deployment | Not authorized |

# 15. CURRENT DEVELOPMENT POSITION

Project Directory: D:\Royal Shop

Current Phase: Phase 0 - Security Hardening

Immediate Priorities:

1. Turnstile integration.
2. Rate limiting.
3. Idempotency protection.
4. Atomic stock and order creation.
5. Checkout fulfillment data validation.
6. Final security testing.
7. Deployment and handover preparation.

Unrelated features must not interrupt these priorities without an approved change request.

# 16. FINAL PROJECT RULE

Royal Shop is a client business system, not merely a demonstration website.

The objective is to deliver a secure, maintainable, documented, portable system that the client can own and operate independently, while allowing the developer to provide authorized ongoing technical services.

Plan changes require documented decisions.
Implementation follows approved plans.
Production deployment requires explicit authorization.

---

# 17. REUSABLE BUSINESS TEMPLATE ARCHITECTURE

## 17.1 Architectural Goal

Royal Shop will remain a client-specific baby-care e-commerce implementation while its underlying architecture is prepared for future reuse across different business types.

The long-term direction is one reusable Core Template with separately configured business implementations.

## 17.2 Core and Business Configuration

The reusable core may contain common capabilities such as:
- Storefront and navigation.
- Product and category presentation.
- Cart and checkout foundations.
- Administration and authentication.
- Supabase integration.
- Security and deployment foundations.

Business-specific configuration should control:
- Business name, logo and visual identity.
- Contact and business information.
- Delivery and operational settings.
- Feature availability.
- Business-specific content.

Specialized business workflows must remain optional modules. A pharmacy, baby-care shop and general retailer must not be forced to use identical business rules.

## 17.3 Client Isolation

Initial deployment model:
- One codebase template.
- One business-specific configuration per implementation.
- One separate Supabase project per client.
- Separate credentials, storage and business data.
- No shared multi-client database by default.

## 17.4 Fresh Project Portability

Every reusable implementation must have documented instructions for:
- Creating a fresh Supabase project.
- Applying reviewed database migrations.
- Configuring RLS and database permissions.
- Deploying Edge Functions.
- Configuring Storage.
- Setting environment variables.
- Building and deploying the frontend.
- Verifying a fresh installation.
- Transferring ownership to a client.

A fresh setup must not depend on undocumented manual changes made to an earlier client's database.

## 17.5 Implementation Boundary

Royal Shop is the first implementation, not a reason for an immediate full rewrite.

Reusable boundaries will be introduced incrementally and verified without breaking existing cart, checkout, order management or client workflows.

Shared multi-tenant infrastructure remains outside the initial scope.

