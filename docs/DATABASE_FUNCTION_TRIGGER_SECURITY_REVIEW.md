# ROYAL SHOP
## Database Function and Trigger Security Review

Review Date: 2026-11-04
Project: royal-shop-oms
Supabase Project Ref: anpdnsoxelamxzagxmrh
Review Type: Read-only live database inspection

## 1. Review Scope

This review records the live database findings for:
- Public schema table triggers.
- Database event triggers.
- Function definitions and ownership.
- SECURITY DEFINER status.
- Function EXECUTE privileges.

All findings were collected using read-only SQL queries in Supabase SQL Editor.

No function, trigger, privilege, table, policy, or database setting was modified during this review.

## 2. Table Trigger Findings

Two non-internal triggers were found in the public schema.

| Table | Trigger | Timing | Event | Function |
|---|---|---|---|---|
| categories | categories_updated_at_trigger | BEFORE | UPDATE | set_products_updated_at() |
| products | products_updated_at_trigger | BEFORE | UPDATE | set_products_updated_at() |

Both triggers execute once for each updated row.

Function behavior:

- Assigns NOW() to NEW.updated_at.
- Returns the modified NEW row.

The function is SECURITY INVOKER (prosecdef = false).
Its owner is postgres.

Assessment:
The observed trigger-to-function relationships match the expected updated_at behavior.

No other non-internal table triggers were returned by the public-schema audit query.

## 3. Event Trigger Findings

The following event triggers were returned by the live database query.

| Event Trigger | Event | Enabled | Owner | Function |
|---|---|---|---|---|
| ensure_rls | ddl_command_end | O | postgres | rls_auto_enable() |
| issue_graphql_placeholder | sql_drop | O | supabase_admin | set_graphql_placeholder() |
| issue_pg_cron_access | ddl_command_end | O | supabase_admin | grant_pg_cron_access() |
| issue_pg_graphql_access | ddl_command_end | O | supabase_admin | grant_pg_graphql_access() |
| issue_pg_net_access | ddl_command_end | O | supabase_admin | grant_pg_net_access() |
| pgrst_ddl_watch | ddl_command_end | O | supabase_admin | pgrst_ddl_watch() |
| pgrst_drop_watch | sql_drop | O | supabase_admin | pgrst_drop_watch() |

PostgreSQL event trigger enabled status O means enabled.

The ensure_rls event trigger is owned by postgres and invokes public.rls_auto_enable() at ddl_command_end.

The other listed event triggers are Supabase-managed triggers. They were observed but not modified.

## 4. Function Definition Findings

### 4.1 public.rls_auto_enable()

- Return type: event_trigger
- Language: plpgsql
- Owner: postgres
- SECURITY DEFINER: true
- Configured search_path: pg_catalog

Observed behavior:
- Processes CREATE TABLE, CREATE TABLE AS, and SELECT INTO command tags.
- Restricts its table handling condition to the public schema.
- Attempts to enable row-level security on matching tables.
- Logs success or failure.
- Catches exceptions inside its processing block and logs failures.

Security observations:
- SECURITY DEFINER means the function executes with its owner's privileges.
- The fixed pg_catalog search_path is a positive security measure.
- The function enables RLS but does not create or verify table policies.
- Its exception handling logs failures; it does not necessarily abort the originating DDL command.
- The event trigger has database-wide DDL event scope, while the function's table-handling condition is restricted to public.

### 4.2 public.set_products_updated_at()

- Return type: trigger
- Language: plpgsql
- Owner: postgres
- SECURITY DEFINER: false

Observed behavior:
- Sets NEW.updated_at to NOW().
- Returns NEW.
- Used by the categories and products BEFORE UPDATE triggers.

## 5. Function EXECUTE Privileges

The live information_schema.routine_privileges query returned the following grants.

| Function | Grantee | Privilege |
|---|---|---|
| rls_auto_enable | PUBLIC | EXECUTE |
| rls_auto_enable | anon | EXECUTE |
| rls_auto_enable | authenticated | EXECUTE |
| rls_auto_enable | postgres | EXECUTE |
| rls_auto_enable | service_role | EXECUTE |
| set_products_updated_at | PUBLIC | EXECUTE |
| set_products_updated_at | anon | EXECUTE |
| set_products_updated_at | authenticated | EXECUTE |
| set_products_updated_at | postgres | EXECUTE |
| set_products_updated_at | service_role | EXECUTE |

Assessment:
- Both functions have broad EXECUTE grants.
- PUBLIC includes all database roles, subject to PostgreSQL privilege and object invocation rules.
- An event-trigger function is not equivalent to an ordinary application-callable function.
- The presence of EXECUTE grants alone does not establish that an anonymous client can directly invoke or exploit the event trigger.
- The necessity of these grants has not yet been established.

No privilege revocation or grant change is approved by this audit.

## 6. Security Assessment

Confirmed:
- The two expected updated_at table triggers exist.
- ensure_rls is enabled.
- rls_auto_enable is SECURITY DEFINER and owned by postgres.
- rls_auto_enable has a fixed pg_catalog search_path.
- Both functions have broad EXECUTE grants.
- The event trigger's function attempts to enable RLS on matching public tables.

Not established by this review:
- Whether every existing table has an appropriate RLS policy.
- Whether every future table receives the required policies.
- Whether broad EXECUTE grants are required for the current event-trigger design.
- Whether revoking any grant would affect Supabase or application behavior.
- Whether the event-trigger function has been tested against all relevant DDL cases.

Important:
RLS being enabled does not by itself guarantee correct access control. Policies and table privileges must also be reviewed.

## 7. Required Follow-up

1. Review the necessity of PUBLIC, anon, and authenticated EXECUTE grants.
2. Verify PostgreSQL event-trigger function privilege behavior before proposing any revocation.
3. Review RLS policies for all existing public tables.
4. Test any proposed function privilege changes in a non-production environment first.
5. Confirm that future tables receive appropriate RLS policies, not merely RLS enablement.
6. Record and approve any proposed change before implementation.

## 8. Change and Deployment Status

- Audit queries: read-only.
- Database modifications during this review: none.
- Function modifications: none.
- Trigger modifications: none.
- Permission modifications: none.
- Migration generated: no.
- Production deployment: not authorized.
- Remediation approval: pending.

## 9. Evidence and Limitations

Evidence consists of the live SQL query results supplied during the review on 2026-11-04.

The review covers the returned public-schema table triggers, database event triggers, two named public functions, and their reported EXECUTE privileges.

This document is an audit record, not proof of a complete database penetration test or a complete review of all database objects.

---

## 10. DEFAULT PRIVILEGE AND SCHEMA DUMP FOLLOW-UP

Review Date: 2026-11-04

### 10.1 Live default privilege inspection

A read-only `pg_default_acl` query returned default privileges in schema `public` for object owners `postgres` and `supabase_admin`.

For both owners, the returned entries include:

- TABLES: broad privileges for `anon`, `authenticated`, `postgres`, and `service_role`, including SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER and MAINTAIN.
- SEQUENCES: SELECT, UPDATE and USAGE for those roles.
- FUNCTIONS: EXECUTE for those roles.

These entries apply to future objects created by the respective owners. They must not be confused with the current privileges on existing objects.

### 10.2 Security assessment

- Broad default table privileges can grant future `anon` and `authenticated` access beyond the minimum required by an application.
- RLS does not replace table-level privilege restrictions. In particular, privileges such as TRUNCATE, TRIGGER and MAINTAIN are not controlled by row policies.
- The current five public tables were separately inspected and have narrower live grants.
- The `rls_auto_enable` event trigger enables RLS on matching new public tables but does not create or validate suitable policies.
- The necessity and ownership implications of the defaults for `postgres` and `supabase_admin` have not yet been established.

### 10.3 Schema dump discrepancy

The initial and fresh public-schema dumps have identical SHA256:

`1DC46DC0ACA94375EBCDD13D108366378FBC57116BB08FF9A826CA89B51DE820`

Both dumps omit `CREATE TRIGGER` statements, while live inspection confirms the two public table triggers described in Section 2.

The public-schema dump must therefore not be treated as complete evidence for table triggers or global event triggers. Live catalog query results remain the evidence for the inspected trigger definitions and event-trigger inventory.

### 10.4 Required follow-up

1. Review why both `postgres` and `supabase_admin` have broad default privileges in `public`.
2. Identify which defaults are required by Supabase-managed operations.
3. Determine whether application-created objects can use a more restrictive owner or controlled grant process.
4. Review the implications of revoking or narrowing defaults before proposing any change.
5. Verify that future tables receive appropriate RLS policies and minimum required grants.
6. Test any proposed changes in a non-production environment.
7. Obtain explicit approval before changing default privileges.

### 10.5 Change and deployment status

- Default privilege inspection: read-only.
- Schema dump comparison: read-only.
- No default privileges were changed.
- No function or trigger was changed.
- No database migration was generated or executed.
- Production deployment remains unauthorized.


## 11. Default Privileges and Function Exposure Decision

Audit date: 2026-11-04

### Function inventory

| Function | Kind | Security Definer | Current dependency |
|---|---|---|---|
| `rls_auto_enable` | Event trigger | Yes | Custom event-trigger function |
| `set_products_updated_at` | Trigger | No | Enabled BEFORE UPDATE triggers on categories and products |

Both functions currently have EXECUTE entries for PUBLIC, anon, authenticated, postgres, and service_role in the inspected ACL.

### Security interpretation

- `rls_auto_enable` is an event-trigger function, not a normal RPC function.
- `set_products_updated_at` is a trigger function, not a normal RPC business endpoint.
- The two function exposure indicators in the Dashboard must not be treated as proof of ordinary RPC reachability.
- The `SECURITY DEFINER` property of `rls_auto_enable` makes its ownership, search_path, and execution context important. Its existing definition was previously inspected; do not change its ACL without a dedicated dependency review.
- The trigger function is actively used by two enabled table triggers. Its required trigger behavior must be preserved.

### Default ACL findings

Broad default privileges were observed for postgres and supabase_admin in public. The supabase_admin role is Supabase-managed and had no matching owned public objects in this particular ownership query.

The absence of currently owned objects does not prove that a managed role's defaults are unnecessary.

### Decision

- Leave both function definitions, triggers, and current EXECUTE grants unchanged.
- Do not revoke PUBLIC, anon, authenticated, or service_role EXECUTE privileges at this stage.
- Review Data API exposure separately from PostgreSQL function ACLs.
- Review postgres default ACL changes only after a complete dependency and ownership analysis.
- Do not attempt to change Supabase-managed supabase_admin defaults as part of application hardening.

No database or Dashboard changes were performed.

