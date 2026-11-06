# Royal Shop - Supabase Database Archive

Project: Royal Shop
Supabase Project: royal-shop-oms

## Folder Structure

- functions/: Edge Function source code
- migrations/: Database migration scripts
- sql/: SQL scripts and verification queries

## Important Rules

1. Never execute an archived SQL file without reviewing it.
2. Keep original migration scripts separate from verification queries.
3. Do not store passwords, service-role keys or API secrets here.
4. Record whether each SQL script was executed and verified.
5. Do not overwrite historical migrations.

## Known Database Objects

- public.products
- public.categories
- public.orders
- public.admin_users
- public.store_settings

## Archive Status

Verified local archive inspection (4 November 2026):

- migrations/ exists but contains no files.
- sql/ contains 03-verify-orders-schema.sql and archive/recovered/2026-11-04-store-settings.sql.
- 03-verify-orders-schema.sql is a read-only orders schema query.
- No local migration history can currently reconstruct the live database.
- One PRIVATE saved query for store_settings has been recovered; it is not a complete SQL Editor execution history.
- Original SQL scripts for the other database objects remain unrecovered.
- Initial recovery inventory: docs/DATABASE_MIGRATION_RECOVERY_INVENTORY.md.
- No baseline migration has been generated or executed.

## Recovered SQL Archive

### 2026-11-04-store-settings.sql

- Source: User-provided PRIVATE saved SQL query.
- Purpose: Create and secure public.store_settings.
- Previous execution: Previously executed.
- Verification: Table, RLS, policies and grants were verified.
- Archived locally: 4 November 2026.
- Re-execution: Not required.
- Classification: Recovered SQL archive, not a migration history record.
