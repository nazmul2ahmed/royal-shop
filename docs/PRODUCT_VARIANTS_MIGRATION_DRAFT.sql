-- ============================================================
-- ROYAL SHOP: PRODUCT VARIANTS + GLOBAL SKU REGISTRY
-- Draft date: 2026-11-05
-- STATUS: REVIEW DRAFT ONLY — DO NOT EXECUTE
--
-- Purpose:
--   1. Add real product variants with independent SKU, price and stock.
--   2. Enforce SKU uniqueness across products AND variants.
--   3. Extend stock movement audit to identify a variant where relevant.
--   4. Preserve existing product-only catalogue and order snapshots.
--
-- IMPORTANT:
--   - This is a design draft, not an approved executable migration.
--   - Do not run in Supabase SQL Editor or against any database.
--   - Historical migration recovery is incomplete.
--   - Existing live schema must be re-inspected before implementation.
--   - Existing order RPCs / Edge Functions are NOT changed by this file.
--   - Existing product-only orders must remain supported by application
--     and RPC changes designed and tested separately.
-- ============================================================


-- ============================================================
-- SECTION 0: PRE-FLIGHT REQUIREMENTS (MANUAL REVIEW)
-- ============================================================

-- Before any future execution, verify all of the following:
--
-- A. Confirm current live definitions of:
--      public.products
--      public.orders
--      public.stock_movements (if already created)
--      all relevant constraints, indexes, triggers, RLS and grants.
--
-- B. Confirm whether the proposed order_idempotency and stock_movements
--    tables have already been created. This draft assumes the stock
--    movement table from DATABASE_ORDER_STOCK_MIGRATION_DRAFT.sql
--    does not yet exist in the live database.
--
-- C. Confirm PostgreSQL version and supported constraint behavior.
--
-- D. Check existing product SKUs for:
--      - leading/trailing whitespace;
--      - case-only duplicates;
--      - blank strings;
--      - duplicate values after the chosen normalization rule.
--
-- E. Decide and document SKU normalization. This draft uses exact,
--    case-sensitive TEXT uniqueness and does not silently rewrite SKUs.
--    If case-insensitive uniqueness is required, design that explicitly
--    (for example, a normalized generated/key column) before execution.
--
-- F. Review product deletion behavior. Existing products may be referenced
--    by orders and other records. Do not change deletion semantics casually.
--
-- G. Reconcile this draft with the Customer Journey and Order & Stock
--    drafts. Do not apply drafts independently without one reviewed plan.
--
-- H. Test the complete migration and rollback in a disposable database
--    reconstructed from verified schema evidence, not guessed history.


-- ============================================================
-- SECTION 1: PRODUCT VARIANTS
-- ============================================================

CREATE TABLE public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id UUID NOT NULL
        REFERENCES public.products(id)
        ON DELETE RESTRICT,

    name TEXT NOT NULL,

    -- Example: {"size":"100ml"} or {"size":"M","age":"3-6 months"}.
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,

    sku TEXT NOT NULL,

    price NUMERIC NOT NULL,

    compare_at_price NUMERIC NULL,

    stock INTEGER NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT true,

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT product_variants_name_length_check
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),

    CONSTRAINT product_variants_sku_nonempty_check
        CHECK (char_length(btrim(sku)) BETWEEN 1 AND 100),

    CONSTRAINT product_variants_attributes_object_check
        CHECK (jsonb_typeof(attributes) = 'object'),

    CONSTRAINT product_variants_price_check
        CHECK (price >= 0),

    CONSTRAINT product_variants_compare_at_price_check
        CHECK (compare_at_price IS NULL OR compare_at_price >= 0),

    CONSTRAINT product_variants_stock_check
        CHECK (stock >= 0),

    CONSTRAINT product_variants_sort_order_check
        CHECK (sort_order >= 0),

    -- Prevent two variants of one product from sharing the same display name.
    CONSTRAINT product_variants_product_name_key
        UNIQUE (product_id, name),

    -- Variant SKU is globally registered below. This local unique
    -- constraint is intentionally omitted so inventory_skus is the
    -- single cross-entity uniqueness authority.
    CONSTRAINT product_variants_id_product_key
        UNIQUE (id, product_id)
);

CREATE INDEX product_variants_product_active_sort_idx
    ON public.product_variants(product_id, is_active, sort_order, name);


-- Use the already-inspected shared timestamp function, but verify its
-- current live definition before any execution.
CREATE TRIGGER product_variants_updated_at_trigger
    BEFORE UPDATE ON public.product_variants
    FOR EACH ROW
    EXECUTE FUNCTION public.set_products_updated_at();


-- ============================================================
-- SECTION 2: GLOBAL SKU REGISTRY
-- ============================================================

-- A registry row belongs to exactly one product OR one variant.
-- The two foreign keys provide real referential integrity; the CHECK
-- constraint prevents a row from having zero or two owners.
--
-- Product and variant SKU values are synchronized by triggers in
-- SECTION 3. This registry is the global uniqueness authority.
--
-- Existing products.sku remains in place, including its historical
-- UNIQUE constraint. Existing SKU values are backfilled below.

CREATE TABLE public.inventory_skus (
    sku TEXT PRIMARY KEY,

    product_id UUID NULL
        REFERENCES public.products(id)
        ON DELETE CASCADE,

    variant_id UUID NULL
        REFERENCES public.product_variants(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT inventory_skus_sku_nonempty_check
        CHECK (char_length(btrim(sku)) BETWEEN 1 AND 100),

    CONSTRAINT inventory_skus_exactly_one_owner_check
        CHECK (
            (product_id IS NOT NULL AND variant_id IS NULL)
            OR
            (product_id IS NULL AND variant_id IS NOT NULL)
        ),

    CONSTRAINT inventory_skus_product_owner_key
        UNIQUE (product_id),

    CONSTRAINT inventory_skus_variant_owner_key
        UNIQUE (variant_id)
);

CREATE INDEX inventory_skus_product_id_idx
    ON public.inventory_skus(product_id)
    WHERE product_id IS NOT NULL;

CREATE INDEX inventory_skus_variant_id_idx
    ON public.inventory_skus(variant_id)
    WHERE variant_id IS NOT NULL;


-- Backfill current non-NULL product SKUs.
-- If any existing product SKUs collide under the registry's exact
-- uniqueness rule, this statement fails instead of silently choosing
-- an owner. Resolve data conflicts before any future execution.
INSERT INTO public.inventory_skus (sku, product_id)
SELECT sku, id
FROM public.products
WHERE sku IS NOT NULL;


-- ============================================================
-- SECTION 3: SKU SYNCHRONIZATION TRIGGERS
-- ============================================================

-- Product SKU synchronization.
-- A conflict with another product or variant aborts the transaction.
CREATE OR REPLACE FUNCTION public.sync_product_inventory_sku()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.sku IS NOT NULL THEN
            DELETE FROM public.inventory_skus
            WHERE product_id = OLD.id
              AND sku = OLD.sku;
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.sku IS DISTINCT FROM NEW.sku
       AND OLD.sku IS NOT NULL THEN
        DELETE FROM public.inventory_skus
        WHERE product_id = OLD.id
          AND sku = OLD.sku;
    END IF;

    IF NEW.sku IS NOT NULL THEN
        INSERT INTO public.inventory_skus (sku, product_id)
        VALUES (NEW.sku, NEW.id)
        ON CONFLICT (sku) DO UPDATE
            SET product_id = EXCLUDED.product_id,
                variant_id = NULL
            WHERE public.inventory_skus.product_id = EXCLUDED.product_id;
        -- If the conflicting row belongs to a different owner, the
        -- ON CONFLICT WHERE clause updates zero rows. Raise explicitly.
        IF NOT EXISTS (
            SELECT 1
            FROM public.inventory_skus
            WHERE sku = NEW.sku
              AND product_id = NEW.id
              AND variant_id IS NULL
        ) THEN
            RAISE EXCEPTION 'SKU already belongs to another inventory item'
                USING ERRCODE = 'unique_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER products_inventory_sku_sync_trigger
    AFTER INSERT OR UPDATE OF sku OR DELETE
    ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_product_inventory_sku();


-- Variant SKU synchronization.
CREATE OR REPLACE FUNCTION public.sync_variant_inventory_sku()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.inventory_skus
        WHERE variant_id = OLD.id
          AND sku = OLD.sku;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.sku IS DISTINCT FROM NEW.sku THEN
        DELETE FROM public.inventory_skus
        WHERE variant_id = OLD.id
          AND sku = OLD.sku;
    END IF;

    INSERT INTO public.inventory_skus (sku, variant_id)
    VALUES (NEW.sku, NEW.id)
    ON CONFLICT (sku) DO UPDATE
        SET variant_id = EXCLUDED.variant_id,
            product_id = NULL
        WHERE public.inventory_skus.variant_id = EXCLUDED.variant_id;

    IF NOT EXISTS (
        SELECT 1
        FROM public.inventory_skus
        WHERE sku = NEW.sku
          AND variant_id = NEW.id
          AND product_id IS NULL
    ) THEN
        RAISE EXCEPTION 'SKU already belongs to another inventory item'
            USING ERRCODE = 'unique_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER product_variants_inventory_sku_sync_trigger
    AFTER INSERT OR UPDATE OF sku OR DELETE
    ON public.product_variants
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_variant_inventory_sku();


-- IMPORTANT REVIEW NOTE:
-- Trigger functions above are SECURITY INVOKER. Their execution requires
-- the invoking database role to have the necessary registry privileges.
-- The final RPC execution model must be tested with the actual function
-- owner and role. Do not solve privilege failures by granting registry
-- writes to anon/authenticated. If a SECURITY DEFINER trigger function
-- is considered, it requires a separate security review and fixed
-- search_path before approval.


-- ============================================================
-- SECTION 4: STOCK MOVEMENTS — VARIANT-AWARE AUDIT
-- ============================================================

-- This section assumes stock_movements is created by the reviewed
-- Order & Stock migration draft. If it already exists, inspect it first.
-- Do not run this section blindly against an unknown live schema.

ALTER TABLE public.stock_movements
    ADD COLUMN variant_id UUID NULL
        REFERENCES public.product_variants(id)
        ON DELETE RESTRICT;

-- Product-level legacy movement: variant_id IS NULL.
-- Variant-level movement: variant_id identifies the exact variant.
--
-- Enforce that the selected variant belongs to product_id.
CREATE OR REPLACE FUNCTION public.validate_stock_movement_variant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.variant_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM public.product_variants pv
           WHERE pv.id = NEW.variant_id
             AND pv.product_id = NEW.product_id
       ) THEN
        RAISE EXCEPTION 'Variant does not belong to the specified product'
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER stock_movements_variant_consistency_trigger
    BEFORE INSERT OR UPDATE OF product_id, variant_id
    ON public.stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_stock_movement_variant();


-- Replace product-only uniqueness with separate partial unique indexes.
-- The split indexes distinguish legacy product stock from variant stock.
DROP INDEX IF EXISTS public.stock_movements_order_reserved_key;

CREATE UNIQUE INDEX stock_movements_order_reserved_product_key
    ON public.stock_movements(order_id, product_id)
    WHERE movement_type = 'order_reserved'
      AND variant_id IS NULL;

CREATE UNIQUE INDEX stock_movements_order_reserved_variant_key
    ON public.stock_movements(order_id, product_id, variant_id)
    WHERE movement_type = 'order_reserved'
      AND variant_id IS NOT NULL;


DROP INDEX IF EXISTS public.stock_movements_order_cancelled_key;

CREATE UNIQUE INDEX stock_movements_order_cancelled_product_key
    ON public.stock_movements(order_id, product_id)
    WHERE movement_type = 'order_cancelled'
      AND variant_id IS NULL;

CREATE UNIQUE INDEX stock_movements_order_cancelled_variant_key
    ON public.stock_movements(order_id, product_id, variant_id)
    WHERE movement_type = 'order_cancelled'
      AND variant_id IS NOT NULL;

CREATE INDEX stock_movements_variant_created_at_idx
    ON public.stock_movements(variant_id, created_at DESC)
    WHERE variant_id IS NOT NULL;


-- ============================================================
-- SECTION 5: ROW LEVEL SECURITY AND PRIVILEGES
-- ============================================================

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_skus ENABLE ROW LEVEL SECURITY;

-- stock_movements is expected to have RLS enabled by the base
-- Order & Stock migration. Verify rather than assume in live DB.

REVOKE ALL ON TABLE public.product_variants
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.inventory_skus
    FROM PUBLIC, anon, authenticated;

-- Public catalogue reads should be exposed through a deliberately
-- designed policy for active variants of active products, if needed.
-- No public policy is created in this draft.
--
-- Trusted backend access only. Actual RPC owner/function paths must
-- be tested before finalizing these grants.

REVOKE ALL ON TABLE public.product_variants FROM service_role;
REVOKE ALL ON TABLE public.inventory_skus FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.product_variants
    TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.inventory_skus
    TO service_role;

-- stock_movements service_role grants are defined in the base
-- Order & Stock draft. Reconcile final grants in the combined migration.


-- ============================================================
-- SECTION 6: APPLICATION / RPC CONTRACT — NOT IMPLEMENTED HERE
-- ============================================================

-- Product without variants:
--   - Existing products.price, products.stock and products.sku remain
--     the sellable inventory fields.
--   - Existing product-only cart and order flows remain supported.
--
-- Product with variants:
--   - Product-level price/stock/SKU must not be used as the sellable
--     variant inventory source.
--   - Each active variant has its own SKU, price and stock.
--   - Variant selection is required before add-to-cart / checkout.
--   - Product page must display only active variants.
--   - Server must re-read price and stock from the database.
--
-- Order item snapshot for a variant (illustrative contract):
-- {
--   "id": "product-uuid",
--   "variant_id": "variant-uuid",
--   "sku": "BABY-LOT-100",
--   "name": "Baby Lotion",
--   "variant_name": "100ml",
--   "attributes": {"size":"100ml"},
--   "quantity": 2,
--   "price": 250
-- }
--
-- Legacy product-only snapshot remains valid:
-- {
--   "id": "product-uuid",
--   "name": "Existing product",
--   "quantity": 1,
--   "price": 100
-- }
--
-- Required RPC changes (separate reviewed draft):
--   1. create_order_atomic accepts product_id + optional variant_id.
--   2. Aggregate duplicate lines by (product_id, variant_id), not product.
--   3. Lock the correct product/variant rows in deterministic order.
--   4. Validate active state, server price and stock.
--   5. Decrement variant stock for variant lines; product stock for legacy.
--   6. Store immutable order item snapshots.
--   7. Record stock movements with matching variant_id.
--   8. Cancellation compares reservations by (product_id, variant_id).
--   9. Cancellation restores the exact variant stock or legacy product stock.
--  10. Idempotency hash includes variant_id and quantity.
--  11. Existing idempotency retries must not silently change their payload.
--  12. Product editing must never overwrite stock; stock adjustment is
--      a separate audited operation.
--
-- Application changes (separate implementation steps):
--   - Product Management: variant CRUD and stock adjustment workflow.
--   - Product Details: variant selector and variant-specific price/stock.
--   - Cart: composite line identity (product_id + variant_id).
--   - Checkout: submit variant_id and preserve pending-request retry data.
--   - create-order Edge Function: validate composite identities and
--     server-calculated totals.
--   - Admin order/cancellation views: show variant snapshots.
--   - Demo seed: 10 products across at least 5 categories, variants for
--     selected products; development database only.


-- ============================================================
-- SECTION 7: KNOWN GAPS / REQUIRED DESIGN DECISIONS
-- ============================================================

-- 1. Trigger privilege model:
--    The SKU synchronization triggers above are SECURITY INVOKER.
--    Confirm the actual role used by product/variant writes and RPCs.
--    The final design must not grant direct registry mutation to browser
--    roles. A separately reviewed SECURITY DEFINER option may be needed.
--
-- 2. SKU normalization:
--    This draft enforces exact string uniqueness. Decide whether SKU
--    uniqueness should ignore case and whitespace before implementation.
--
-- 3. Product deletion:
--    Confirm existing deletion behavior and all referencing tables.
--    This draft uses RESTRICT from variants to products and CASCADE from
--    registry to its owner. Do not change this without reviewing order
--    history and existing product deletion workflows.
--
-- 4. Variant lifecycle:
--    Decide whether variants with historical stock movements may be
--    hard-deleted. RESTRICT from stock_movements prevents deletion once
--    audited movements exist; prefer deactivation.
--
-- 5. Variant selection:
--    Define whether every product with one variant still requires an
--    explicit selection. Recommended: yes, if variants exist.
--
-- 6. Stock semantics:
--    Define whether products.stock is ignored, maintained as aggregate,
--    or required to be zero for variant-managed products. Do not allow
--    two competing stock sources. Recommended: variants are authoritative;
--    product stock is not decremented for variant lines.
--
-- 7. Category / product public visibility:
--    Design a read policy or safe RPC for active variants. This draft
--    intentionally creates no public RLS policies.
--
-- 8. Existing stock movements:
--    Before adding variant_id, confirm the base table and index names
--    exactly match the reviewed Order & Stock draft.
--
-- 9. Trigger function privileges and RLS:
--    Verify whether service_role bypasses RLS in the target project and
--    test all trigger paths under the real execution role.
--
-- 10. Migration atomicity / rollback:
--     Review transaction boundaries, lock duration, backfill behavior,
--     and rollback implications. Do not remove historical SKU values.
--
-- 11. Reconcile status-history field naming:
--     Customer Journey architecture says note; its SQL draft uses
--     internal_note. Resolve before the combined migration.
--
-- 12. Reconcile all draft files into one ordered implementation plan.
--     Do not execute this file independently.


-- ============================================================
-- SECTION 8: REQUIRED TESTS BEFORE ANY EXECUTION
-- ============================================================

-- [ ] Fresh disposable database setup from verified schema evidence.
-- [ ] Existing product-only catalogue reads still work.
-- [ ] Existing product-only cart and checkout still work.
-- [ ] Existing product-only order creation still works.
-- [ ] Existing product-only cancellation restores product stock.
-- [ ] Product SKU backfill succeeds without cross-owner conflicts.
-- [ ] Duplicate product SKU is rejected.
-- [ ] Duplicate variant SKU is rejected.
-- [ ] Product SKU matching a variant SKU is rejected.
-- [ ] Variant SKU matching a product SKU is rejected.
-- [ ] SKU update synchronizes registry atomically.
-- [ ] SKU update collision rolls back the source-row update.
-- [ ] Product/variant deletion does not leave orphan registry rows.
-- [ ] Variant must belong to the specified product in stock movements.
-- [ ] Same product can have separate order lines for different variants.
-- [ ] Same variant duplicate lines aggregate correctly.
-- [ ] Variant price and stock are validated server-side.
-- [ ] Variant stock reservation is atomic under concurrent orders.
-- [ ] Variant cancellation restores only the correct variant.
-- [ ] Duplicate cancellation cannot restore stock twice.
-- [ ] Idempotent retry with same payload returns original result.
-- [ ] Same idempotency key with changed variant/quantity is rejected.
-- [ ] Browser roles cannot write variants, registry or stock movements.
-- [ ] Public product/variant reads expose only approved fields.
-- [ ] No service_role secret reaches browser code or logs.
-- [ ] RLS, grants, triggers and function execution permissions verified.
-- [ ] Rollback tested in disposable database.

-- ============================================================
-- FINAL STATUS: REVIEW DRAFT ONLY — DO NOT EXECUTE
-- No database changes have been made by this file.
-- ============================================================
