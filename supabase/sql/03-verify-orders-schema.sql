-- ROYAL SHOP
-- Purpose: Verify the public.orders table schema.
-- Type: Read-only verification query.
-- Does not modify database records or schema.

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
ORDER BY ordinal_position;
