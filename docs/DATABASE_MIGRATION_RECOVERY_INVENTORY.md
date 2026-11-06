# Royal Shop - Database Migration Recovery Inventory

**Project:** Royal Shop  
**Supabase Project:** royal-shop-oms  
**Inventory date:** 4 November 2026  
**Status:** Initial inventory - historical migration recovery incomplete

---

## 1. Purpose

This document records the known live database structure, security configuration,
available SQL archives, and missing migration evidence.

It separates:

1. Previously inspected live database state.
2. Locally recovered SQL files.
3. Historical migration information that remains unknown.

This document is an inventory, not a database migration.

## 2. Evidence and limitations

The inventory uses the following evidence:

- Previously supplied Supabase schema inspection results.
- Previously supplied RLS policy and table privilege inspection results.
- Previously supplied trigger and constraint inspection results.
- Local SQL archive inspection performed on 4 November 2026.
- The recovered PRIVATE saved query for `store_settings`.

Important limitations:

- The database was not queried again during this inventory creation.
- The PRIVATE saved query is not proof of complete SQL Editor execution history.
- The Supabase Logs page did not provide query history.
- The original execution order and timestamps of historical SQL changes remain unknown.
- No migration file has been reconstructed or executed from assumptions.

## 3. Local SQL archive inventory

| File | Classification | Status |
|---|---|---|
| `supabase/sql/03-verify-orders-schema.sql` | Read-only verification query | Existing |
| `supabase/sql/archive/recovered/2026-11-04-store-settings.sql` | Recovered saved SQL query | Archived; previously executed and verified according to project records |

The recovered `store_settings` SQL came from:

`Supabase Dashboard > SQL Editor > PRIVATE saved query`

It is an archive copy, not a migration history record.

## 4. Migration directory status

| Item | Finding |
|---|---|
| `supabase/migrations/` | Directory exists |
| Migration files | None found |
| `supabase_migrations.schema_migrations` | Not found during prior database inspection |
| Baseline migration | Not generated |
| Migration execution | Not started |

Do not create a migration history table manually.

Do not generate or execute a baseline migration until the live database state and available historical evidence have been reconciled.

## 5. Known database objects

Five public tables were identified during the previous database inspection.

### 5.1 `public.admin_users`

Known columns:

- `user_id` UUID, primary key, not null.
- `created_at` TIMESTAMPTZ, not null, default `now()`.

Known security configuration:

- RLS enabled.
- Authenticated users can SELECT their own administrator record.
- Policy condition uses `user_id = auth.uid()`.
- Authenticated SELECT privilege retained.
- Anonymous access revoked.
- Foreign key: `user_id` references `auth.users`.

Historical SQL source: Not recovered.

### 5.2 `public.categories`

Known columns:

- `id` UUID, primary key, default `gen_random_uuid()`.
- `name` TEXT, not null.
- `slug` TEXT, not null.
- `description` TEXT, nullable.
- `image_url` TEXT, nullable.
- `icon` TEXT, nullable.
- `is_active` BOOLEAN, not null, default `true`.
- `sort_order` INTEGER, not null, default `0`.
- `created_at` and `updated_at` TIMESTAMPTZ, default `now()`.

Known constraints and indexes:

- Primary key on `id`.
- Unique constraint on `slug`.

Known security configuration:

- RLS enabled.
- Anonymous and authenticated users can SELECT active categories.
- Verified administrators can perform category management operations.
- Admin policy checks membership in `admin_users`.
- Anonymous privilege: SELECT only.
- Authenticated privilege: SELECT, INSERT, UPDATE, DELETE.

Known trigger:

- `categories_updated_at_trigger`
- BEFORE UPDATE.
- Executes `public.set_products_updated_at()`.

Historical SQL source: Not recovered.

### 5.3 `public.products`

Known columns:

- `id` UUID, primary key.
- `name` TEXT, not null.
- `slug` TEXT, not null.
- `category` TEXT, not null.
- `category_id` UUID, nullable.
- `description` TEXT, nullable.
- `price` NUMERIC, not null.
- `compare_at_price` NUMERIC, nullable.
- `stock` INTEGER, not null, default `0`.
- `sku` TEXT, nullable.
- `image_url` TEXT, nullable.
- `tag` TEXT, nullable.
- `is_active` BOOLEAN, not null, default `true`.
- `sort_order` INTEGER, not null, default `0`.
- `created_at` and `updated_at` TIMESTAMPTZ, default `now()`.

Known constraints and indexes:

- Primary key on `id`.
- Unique constraints on `slug` and `sku`.
- `price >= 0`.
- `stock >= 0`.
- `compare_at_price` must be NULL or non-negative.
- Foreign key: `category_id` references `categories.id`.
- On category deletion, `category_id` is set to NULL.

Known security configuration:

- RLS enabled.
- Anonymous and authenticated users can SELECT active products.
- Verified administrators can manage products.
- Admin policy checks membership in `admin_users`.
- Anonymous privilege: SELECT only.
- Authenticated privilege: SELECT, INSERT, UPDATE, DELETE.

Known trigger:

- `products_updated_at_trigger`
- BEFORE UPDATE.
- Executes `public.set_products_updated_at()`.

Historical SQL source: Not recovered.

### 5.4 `public.orders`

Known columns:

- `id` UUID, primary key.
- `order_number` TEXT, not null.
- `customer_name` TEXT, not null.
- `customer_phone` TEXT, not null.
- `district` TEXT, not null.
- `upazila` TEXT, not null.
- `address` TEXT, not null.
- `area` TEXT, nullable.
- `customer_note` TEXT, nullable.
- `items` JSONB, not null.
- `item_count` INTEGER, not null, default `0`.
- `subtotal` NUMERIC, not null.
- `delivery_charge` NUMERIC, not null, default `0`.
- `total` NUMERIC, not null.
- `payment_method` TEXT, not null, default `COD`.
- `status` TEXT, not null, default `pending`.
- `created_at` and `updated_at` TIMESTAMPTZ, default `now()`.

Known constraints and indexes:

- Primary key on `id`.
- Unique constraint on `order_number`.
- `delivery_charge >= 0`.
- `item_count >= 0`.
- `items` must be a JSON array.
- `subtotal >= 0`.
- `total >= 0`.
- `status` must be one of:
  `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`.
- Indexes reported:
  `orders_created_at_idx` and `orders_status_idx`.

Known security configuration:

- RLS enabled.
- No RLS policies were found.
- Anonymous and authenticated table privileges revoked.
- Order access is intended through the server-side Edge Function using service-role access.

Historical SQL source: Not recovered.

### 5.5 `public.store_settings`

Known columns:

- `id` SMALLINT, primary key, default `1`, CHECK `id = 1`.
- `public_order_enabled` BOOLEAN, not null, default `false`.
- `updated_at` TIMESTAMPTZ, not null, default `now()`.

Known security configuration:

- RLS enabled.
- Anonymous privileges revoked.
- Authenticated users have SELECT and UPDATE privileges.
- Verified administrators are allowed by the SELECT and UPDATE policies.
- `service_role` has all table privileges.

Recovered SQL:

`supabase/sql/archive/recovered/2026-11-04-store-settings.sql`

Status:

- Recovered from a PRIVATE saved query.
- Previously executed according to project records.
- Table, RLS, policies and grants previously verified.
- Archive copy created on 4 November 2026.
- Do not rerun as part of migration recovery.

## 6. Shared database security findings

Previously inspected findings:

- RLS is enabled on all five identified public tables.
- RLS was not reported as forced.
- Anonymous users have SELECT access only to categories and products.
- Authenticated users have SELECT access to their own admin record.
- Authenticated users have CRUD privileges on categories and products.
- Authenticated users have SELECT and UPDATE privileges on store settings.
- Anonymous and authenticated users have no direct table privileges on orders.
- `service_role` retains full privileges on the reviewed tables.

These are inspection findings, not a reconstructed sequence of SQL changes.

## 7. Known trigger function

Previously identified function:

`public.set_products_updated_at()`

Known behavior:

- Sets `NEW.updated_at = NOW()`.
- Returns `NEW`.

Known trigger usage:

- `categories_updated_at_trigger`
- `products_updated_at_trigger`

Original function and trigger creation scripts have not been recovered.

## 8. Recovery status matrix

| Database object or change | Live state inspected | Original SQL recovered | Migration status |
|---|---|---|---|
| admin_users | Yes | No | Pending reconciliation |
| categories | Yes | No | Pending reconciliation |
| products | Yes | No | Pending reconciliation |
| orders | Yes | No | Pending reconciliation |
| store_settings | Yes | Partially - saved query | Historical sequence unknown |
| RLS policies | Yes | Partial - store_settings only | Pending reconciliation |
| Table grants | Yes | Partial - store_settings only | Pending reconciliation |
| Updated-at function | Yes | No | Pending recovery |
| Updated-at triggers | Yes | No | Pending recovery |
| Constraints and indexes | Yes | No | Pending reconciliation |

"Original SQL recovered" means an identifiable historical SQL source is available.
A live database inspection alone does not count as recovery of the original SQL.

## 9. Unknown historical details

The following information remains unknown or incomplete:

- Original SQL scripts for admin_users, categories, products and orders.
- Original SQL for the updated-at function and triggers.
- Original SQL for indexes, constraints and foreign keys.
- Original SQL used to configure RLS policies and table grants.
- Exact historical execution order.
- Exact historical execution timestamps.
- Whether any earlier SQL scripts were modified after execution.
- Whether additional historical SQL exists outside the one recovered PRIVATE saved query.

## 10. Next recovery actions

1. Inspect any remaining Supabase SQL Editor saved queries, if available.
2. Check whether the project has any exported database schema or backup.
3. Preserve every recovered SQL file without modifying its contents.
4. Compare each recovered script with the previously inspected live database state.
5. Record unresolved differences and missing historical evidence.
6. Review the safest baseline strategy.
7. Obtain approval before generating any baseline migration.
8. Back up the database before any approved schema migration.
9. Verify every migration after execution.

## 11. Explicit safety restrictions

Until reconciliation and approval are complete:

- Do not execute recovered SQL again.
- Do not create a fake migration history.
- Do not mark reconstructed SQL as original historical SQL.
- Do not overwrite existing migration files.
- Do not make schema changes for the sake of completing the archive.
- Keep public ordering disabled.
- Do not deploy to production.
- Do not commit or push without explicit authorization.

---

**Inventory status:** Initial inventory documented.  
**Historical migration recovery:** Incomplete.  
**Baseline migration:** Not authorized.
## 12. Git History Recovery Results

Review Date: 2026-11-04

### Repository evidence

- Repository root: D:\Royal Shop
- Local branch: main
- Available remote-tracking branch: origin/main
- Configured remote name: origin
- Repository is not shallow.
- Available local commit count across current refs: 1.
- Local main and origin/main resolve to the same commit:
  03776e9f7b507027969afc4e09f460e40573db09
- Live remote branch inspection returned:
  refs/heads/main at 03776e9f7b507027969afc4e09f460e40573db09
- The available commit is the initial Royal Shop baby care e-commerce commit.
- No tracked Supabase files exist in that commit.
- No historical SQL, PSQL or dump file changes were found in available Git refs.
- No additional remote branch was returned by the live remote-head inspection.

### Recovery conclusion

No historical migration archive was recovered from the currently available Git history or the inspected live remote main branch.

This finding is limited to the repository, refs and remote branches inspected on 2026-11-04. Other repositories, remote branches not advertised, previous computers, external backups and untracked archives have not been ruled out.

### Working tree safety

- The working tree contains existing modified and untracked project files.
- No checkout, reset, merge, pull or fetch was performed during this review.
- No working-tree changes were discarded.
- No commit or push was performed.

### Updated recovery classification

| Evidence | Classification | Status |
|---|---|---|
| store_settings recovered SQL | Recovered SQL | Matches current public schema |
| public-schema.sql | Schema snapshot | Reference only |
| 03-verify-orders-schema.sql | Verification SQL | Read-only |
| Git historical migration files | Historical archive | Not found in inspected refs |
| Current supabase/migrations directory | Migration directory | Empty |

**Historical migration recovery:** Incomplete; no additional historical SQL recovered.

**Baseline migration:** Not authorized and not generated.

**Next action:** Preserve the evidence and evaluate any remaining external recovery sources before proposing a baseline strategy.

## 13. FINAL LOCAL RECOVERY FINDINGS — 2026-11-04

### Local project and Git chronology

The available filesystem and Git metadata establish the following chronology:

| Evidence | Recorded time |
|---|---|
| Royal Shop project directory creation | 2026-11-02 13:42:51 |
| Git metadata activity began | 2026-11-02 21:43:24 |
| Initial Git commit | 2026-11-02 21:47:41 |
| Push/update of origin/main | 2026-11-02 22:21:56 |

The local project directory predates Git initialization by several hours. Therefore, the initial Git commit represents the first recorded Git snapshot, not the beginning of project development.

The current working tree is a later local project snapshot and includes uncommitted and untracked files. It must not be confused with the original complete development history.

### Unreachable Git object inspection

The read-only command `git fsck --full --no-reflogs --unreachable` identified two unreachable blobs:

| Blob | Size | Identified content type | SQL evidence |
|---|---:|---|---|
| `ec790658a73c4a978b2cb35af64b3778fabe0fc0` | 368 bytes | Git ignore configuration | None |
| `73c6a409258114b72fad4707d441f1a61fcf8433` | 648 bytes | CSS theme/style content | None |

Neither object contains the inspected SQL signatures. These objects are not historical migration evidence.

No unreachable Git object was restored, deleted or modified.

### Backup archive inspection

A recursive inspection of the current `backups` directory found only one file with a database/archive extension:

- `backups/schema-reference-20261104-010408/public-schema.sql`

The file is a current public-schema reference dump, not a historical migration archive.

The backup extension inventory contained 17 Markdown files, 8 JSX files, 2 CSS files, 2 TypeScript files, 1 Git ignore file, 1 SQL file and 1 text file.

No additional SQL, PostgreSQL dump, database, SQLite, ZIP, 7z, TAR or GZ archive was found in the inspected backup directory.

### Combined recovery conclusion

The following sources have now been inspected:

- Current `supabase/migrations` directory.
- Available local Git commit history and refs.
- Live remote branch heads.
- Two unreachable Git blobs.
- Current project backup directory.
- Recovered `store_settings` SQL.
- Current public-schema reference dump.

No additional historical migration SQL was recovered from these inspected sources.

The recovered `store_settings` SQL matches the corresponding current public-schema state. It is evidence of the saved SQL definition, not a complete database execution history.

The public-schema dump represents the current inspected schema state. It does not reconstruct the original sequence of historical database changes or prove the full history of every database object.

### Recovery status and restrictions

- Local Git and backup recovery review: Complete for the inspected sources.
- Historical migration sequence: Not recovered.
- External repositories, other computers and external backup locations: Not inspected or ruled out.
- Schema reference: Available.
- Recovered `store_settings` SQL: Available and reconciled with the current public schema.
- Baseline migration: Not authorized and not generated.
- Migration execution: Not authorized by this recovery review.
- Database modifications: None performed during this recovery review.

### Next step

Proceed to a separate, read-only schema reconciliation review using the current public-schema dump, verified live database findings, application code and recovered SQL.

Any baseline migration proposal or database modification requires separate review and explicit approval.

## 14. READ-ONLY SCHEMA RECONCILIATION RESULTS

Review Date: 2026-11-04

### 14.1 Schema snapshot evidence

Two public-schema dumps were generated from the linked Supabase project:

- Initial snapshot: `backups/schema-reference-20261104-010408/public-schema.sql`
- Fresh snapshot: `backups/schema-reference-fresh-20261104-014738/public-schema.sql`

Both files have the same SHA256:

`1DC46DC0ACA94375EBCDD13D108366378FBC57116BB08FF9A826CA89B51DE820`

The files are byte-for-byte identical. The fresh export therefore did not reveal a schema change relative to the earlier snapshot.

### 14.2 Reconciled schema objects

The live database findings were compared with the public-schema snapshot.

| Object category | Live evidence | Reconciliation result |
|---|---:|---|
| Public tables | 5 | Matched |
| Table columns | 49 | Names, order, types, nullability and defaults matched |
| Constraints | 21 | Matched |
| Indexes | 12 | Matched |
| RLS policies | 13 | Matched |
| Public table triggers | 2 | Live definitions exist but are absent from both dumps |
| Database event triggers | 7 | Live inspection evidence available |
| Reviewed public functions | 2 | Definitions and security attributes inspected |

The five tables are `admin_users`, `categories`, `orders`, `products`, and `store_settings`.

The 12 indexes include primary-key and unique-constraint indexes as well as three ordinary indexes:
`idx_products_category_id`, `orders_created_at_idx`, and `orders_status_idx`.

### 14.3 Trigger snapshot discrepancy

Live inspection returned two non-internal public table triggers:

- `categories_updated_at_trigger` invoking `set_products_updated_at()`.
- `products_updated_at_trigger` invoking `set_products_updated_at()`.

Neither the initial nor the fresh public-schema dump contains a `CREATE TRIGGER` statement.

The identical dump hashes establish that a later export did not resolve this discrepancy. The live trigger query remains the available evidence for these two triggers. The public-schema dump must not be treated as a complete trigger inventory.

Seven live database event triggers were also returned. `ensure_rls` is the project-specific event trigger reviewed here; the other six are Supabase-managed event triggers. The public-schema dump is not a complete inventory of global event triggers.

### 14.4 Current table access and RLS findings

Live privilege inspection confirmed:

- `anon` has SELECT on `categories` and `products`, with no tested table privileges on the other three tables.
- `authenticated` has SELECT on `admin_users`; CRUD on `categories` and `products`; SELECT and UPDATE on `store_settings`; and no tested privileges on `orders`.
- `service_role` has all tested table privileges on all five tables.
- RLS is enabled on all five tables.
- FORCE ROW LEVEL SECURITY is false on all five tables.
- `orders` has no RLS policies and no anon/authenticated table grants; its current application insertion path uses the Edge Function service-role client.

These findings describe the inspected current state. Service-role credentials must remain server-side.

### 14.5 Default privilege findings

Read-only inspection of `pg_default_acl` returned default privileges in the `public` schema for both `postgres` and `supabase_admin`.

For both owners, the returned defaults include:

- TABLES: broad privileges for `anon`, `authenticated`, `postgres`, and `service_role`, including SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER and MAINTAIN.
- SEQUENCES: SELECT, UPDATE and USAGE for those roles.
- FUNCTIONS: EXECUTE for those roles.

These are default privileges for future objects created by the respective owners. They are not proof that the same privileges currently exist on every existing table or function.

The current five-table grants were inspected separately and are recorded above. No default privilege change was made or approved. Supabase-managed behavior and object-creation requirements must be assessed before proposing a change.

### 14.6 Application dependency reconciliation

The inspected active frontend and Edge Function database references use columns present in the reconciled schema.

Reviewed dependencies include:

- Admin authentication: `admin_users.user_id`.
- Admin order control: `store_settings.public_order_enabled` and `updated_at`.
- Category management and storefront: category identity, descriptive, image, active and sorting fields.
- Product management and storefront: product identity, category, price, stock, image, active and sorting fields.
- Product-category relationship: `products.category_id` references `categories.id`, with `ON DELETE SET NULL`.
- Order creation: the inspected Edge Function insert fields are present in `orders`.

No obvious application-to-schema column mismatch was identified in the inspected active files.

This is a column/dependency review, not a complete runtime integration test.

The current order-creation implementation still requires separate work for atomic stock decrement, idempotency, Turnstile verification, rate limiting and full server-side request validation. These are application security and data-integrity gaps, not schema reconciliation mismatches.

### 14.7 Reconciliation conclusion and limitations

The inspected live table structure, constraints, indexes, policies and current table grants reconcile with the available public-schema snapshot.

The two live table triggers are not represented in the snapshot. Global event triggers and default privileges require separate evidence and must not be inferred from a public-schema-only dump.

Historical migration sequence remains unrecovered. The recovered `store_settings` SQL remains a saved definition, not complete execution history.

No baseline migration was generated or executed. No database objects, data, privileges, functions, triggers or policies were modified during this read-only reconciliation.

External repositories, other computers and external backup locations remain outside the inspected scope.

### 14.8 Next decision point

Prepare a separate baseline-migration proposal for review. The proposal must distinguish a schema baseline representing the inspected current state from the unrecovered historical migration sequence.

Do not generate or execute a baseline migration without separate explicit approval.


## 15. Default Privileges Security Decision

Audit date: 2026-11-04

### Verified evidence

- `postgres` owns five application tables and two public functions in the public schema.
- No matching public-schema objects owned by `supabase_admin` were returned by the ownership audit.
- Default ACL inspection previously identified broad default privileges for both `postgres` and `supabase_admin` in public.
- Data API exposed schemas include `public` and `graphql_public`.
- Automatically expose new tables is currently ON.
- Dashboard reports 0 of 5 tables exposed and 2 of 2 functions exposed.
- The two public functions are `rls_auto_enable` (event-trigger function) and `set_products_updated_at` (trigger function).
- `set_products_updated_at` is used by enabled BEFORE UPDATE triggers on `categories` and `products`.

### Security interpretation

Default privileges affect future objects created by the relevant owner; they do not retroactively change privileges on existing objects.

The current five application tables have separately audited grants. Their current grants must not be inferred from default ACLs.

The two exposed functions are trigger/event-trigger functions, not ordinary RPC business functions. Their exposure count alone does not establish that they are callable as normal RPC endpoints.

### Decision

1. Preserve the current verified table grants.
2. Do not modify `supabase_admin` default privileges based on this audit.
3. Evaluate disabling automatic exposure of newly created tables as a separate controlled configuration change.
4. Do not modify `postgres` default privileges until object-creation ownership, Supabase dependencies, migration behavior, and required future grants have been reviewed.
5. Do not revoke function EXECUTE privileges until all dependencies and PostgreSQL event-trigger requirements have been verified.

### Change status

Documentation-only decision record. No Dashboard setting, database privilege, schema, function, trigger, migration, application code, or deployment was changed.

