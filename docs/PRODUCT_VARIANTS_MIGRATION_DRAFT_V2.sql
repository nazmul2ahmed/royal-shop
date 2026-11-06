-- ============================================================
-- ROYAL SHOP: PRODUCT VARIANTS + INVENTORY — REVIEW DRAFT V2
-- Date: 2026-11-05
-- STATUS: REVIEW DRAFT ONLY — DO NOT EXECUTE
--
-- Supersedes the design of PRODUCT_VARIANTS_MIGRATION_DRAFT.sql
-- for review purposes. The V1 file is intentionally preserved.
--
-- This V2 draft is more self-contained: it defines the proposed
-- product_variants, inventory_skus, order_idempotency and
-- stock_movements structures together, avoiding an ALTER TABLE
-- against a table that may not exist yet.
--
-- IMPORTANT:
--   - Not approved for execution.
--   - Historical migration recovery is incomplete.
--   - The live database has NOT been re-inspected by this draft.
--   - Do not paste this file into Supabase SQL Editor.
--   - Do not deploy RPCs, Edge Functions or frontend changes from it.
--   - Reconcile with Customer Journey drafts and verified live schema.
-- ============================================================


-- ============================================================
-- SECTION 0: PRE-FLIGHT / EXECUTION BLOCKERS
-- ============================================================

-- 1. Re-inspect the live database immediately before implementation:
--      public.products
--      public.categories
--      public.orders
--      public.admin_users
--    Also inspect all existing tables, constraints, indexes, policies,
--    grants, triggers, functions and function owners.
--
-- 2. Confirm whether order_idempotency or stock_movements already exist.
--    This draft proposes creating them. Never run CREATE TABLE blindly
--    against a database where the objects may already exist.
--
-- 3. Confirm PostgreSQL version, Supabase role behavior and RLS behavior.
--
-- 4. Inspect all existing products.sku values for:
--      - leading/trailing whitespace;
--      - blank strings;
--      - case-insensitive duplicates;
--      - values longer than the proposed 100-character limit.
--    Resolve conflicts before any registry backfill.
--
-- 5. This design treats SKU identity as case-insensitive and trims
--    whitespace for uniqueness. The stored SKU itself must be trimmed.
--    For example, "baby-100" and "BABY-100" collide.
--
-- 6. Confirm the actual admin policy convention. The policy below assumes
--    authenticated admin membership is represented by
--    public.admin_users.user_id = auth.uid().
--
-- 7. Confirm the actual owner role available for SECURITY DEFINER trigger
--    functions. The functions must be owned by a trusted non-login
--    database role (normally the migration/database owner), not by an
--    application user. Verify ownership after creation.
--
-- 8. Reconcile order snapshot shape and RPC function signatures with:
--      docs/DATABASE_ORDER_STOCK_ARCHITECTURE.md
--      docs/DATABASE_ORDER_STOCK_FUNCTIONS_DRAFT_V4.sql
--      docs/CUSTOMER_JOURNEY_ARCHITECTURE.md
--      docs/CUSTOMER_JOURNEY_MIGRATION_DRAFT.sql
--
-- 9. Test on a disposable database reconstructed from verified evidence.
--    No baseline schema or migration history may be fabricated.


-- ============================================================
-- SECTION 1: PRODUCT VARIANTS
-- ============================================================

CREATE TABLE public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id UUID NOT NULL
        REFERENCES public.products(id)
        ON DELETE RESTRICT,

    name TEXT NOT NULL,

    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,

    sku TEXT NOT NULL,

    price NUMERIC NOT NULL,

    compare_at_price NUMERIC NULL,

    stock INTEGER NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT true,

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT product_variants_name_check
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),

    CONSTRAINT product_variants_sku_check
        CHECK (
            sku = btrim(sku)
            AND char_length(sku) BETWEEN 1 AND 100
        ),

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

    CONSTRAINT product_variants_product_name_key
        UNIQUE (product_id, name),

    -- Supports the composite stock_movements foreign key below.
    CONSTRAINT product_variants_id_product_key
        UNIQUE (id, product_id)
);

CREATE INDEX product_variants_product_active_sort_idx
    ON public.product_variants(product_id, is_active, sort_order, name);


-- Timestamp trigger. Before execution, verify that this shared function
-- still exists with the expected behavior and trusted ownership.
CREATE TRIGGER product_variants_updated_at_trigger
    BEFORE UPDATE ON public.product_variants
    FOR EACH ROW
    EXECUTE FUNCTION public.set_products_updated_at();


-- ============================================================
-- SECTION 2: GLOBAL SKU REGISTRY
-- ============================================================

-- Exactly one owner per SKU:
--   product_id set, variant_id NULL  => product SKU
--   product_id NULL, variant_id set  => variant SKU
--
-- sku_key is the normalized uniqueness key. The visible SKU is retained
-- in sku. Case and surrounding whitespace do not create a second SKU.
--
-- Separate FKs enforce real ownership. XOR CHECK prevents zero/two owners.

CREATE TABLE public.inventory_skus (
    sku TEXT NOT NULL,

    sku_key TEXT GENERATED ALWAYS AS (lower(btrim(sku))) STORED,

    product_id UUID NULL
        REFERENCES public.products(id)
        ON DELETE CASCADE,

    variant_id UUID NULL
        REFERENCES public.product_variants(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT inventory_skus_sku_key
        PRIMARY KEY (sku_key),

    CONSTRAINT inventory_skus_sku_check
        CHECK (
            sku = btrim(sku)
            AND char_length(sku) BETWEEN 1 AND 100
        ),

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


-- Backfill existing non-NULL product SKUs.
-- This intentionally fails on case/whitespace-normalized collisions.
INSERT INTO public.inventory_skus (sku, product_id)
SELECT sku, id
FROM public.products
WHERE sku IS NOT NULL;


-- ============================================================
-- SECTION 3: TRUSTED SKU SYNCHRONIZATION TRIGGERS
-- ============================================================

-- SECURITY DEFINER is used only for these narrowly scoped trigger
-- functions so authenticated admins do not need direct write access to
-- inventory_skus. The fixed search_path contains only pg_catalog and
-- every application object is schema-qualified.
--
-- Before approval:
--   - assign each function to a trusted database-owner role;
--   - verify the owner is not an application login;
--   - verify the owner has only the required table privileges;
--   - revoke direct EXECUTE from PUBLIC/anon/authenticated after trigger
--     creation, and test that trigger execution still works;
--   - do not grant browser roles direct inventory_skus write privileges.

CREATE OR REPLACE FUNCTION public.sync_product_inventory_sku()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_existing_product_id UUID;
    v_existing_variant_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.sku IS NOT NULL THEN
            DELETE FROM public.inventory_skus
            WHERE product_id = OLD.id;
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.sku IS NOT NULL THEN
        IF NEW.sku <> btrim(NEW.sku)
           OR char_length(NEW.sku) NOT BETWEEN 1 AND 100 THEN
            RAISE EXCEPTION 'SKU must be trimmed and between 1 and 100 characters'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.sku IS DISTINCT FROM NEW.sku THEN
        DELETE FROM public.inventory_skus
        WHERE product_id = OLD.id;
    END IF;

    IF NEW.sku IS NOT NULL THEN
        INSERT INTO public.inventory_skus (sku, product_id)
        VALUES (NEW.sku, NEW.id)
        ON CONFLICT (sku_key) DO NOTHING;

        SELECT product_id, variant_id
        INTO v_existing_product_id, v_existing_variant_id
        FROM public.inventory_skus
        WHERE sku_key = lower(btrim(NEW.sku));

        IF v_existing_product_id IS DISTINCT FROM NEW.id
           OR v_existing_variant_id IS NOT NULL THEN
            RAISE EXCEPTION 'SKU already belongs to another inventory item'
                USING ERRCODE = 'unique_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.sync_variant_inventory_sku()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_existing_product_id UUID;
    v_existing_variant_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.inventory_skus
        WHERE variant_id = OLD.id;
        RETURN OLD;
    END IF;

    IF NEW.sku <> btrim(NEW.sku)
       OR char_length(NEW.sku) NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION 'SKU must be trimmed and between 1 and 100 characters'
            USING ERRCODE = 'check_violation';
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.sku IS DISTINCT FROM NEW.sku THEN
        DELETE FROM public.inventory_skus
        WHERE variant_id = OLD.id;
    END IF;

    INSERT INTO public.inventory_skus (sku, variant_id)
    VALUES (NEW.sku, NEW.id)
    ON CONFLICT (sku_key) DO NOTHING;

    SELECT product_id, variant_id
    INTO v_existing_product_id, v_existing_variant_id
    FROM public.inventory_skus
    WHERE sku_key = lower(btrim(NEW.sku));

    IF v_existing_product_id IS NOT NULL
       OR v_existing_variant_id IS DISTINCT FROM NEW.id THEN
        RAISE EXCEPTION 'SKU already belongs to another inventory item'
            USING ERRCODE = 'unique_violation';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER products_inventory_sku_sync_trigger
    AFTER INSERT OR UPDATE OF sku OR DELETE
    ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_product_inventory_sku();

CREATE TRIGGER product_variants_inventory_sku_sync_trigger
    AFTER INSERT OR UPDATE OF sku OR DELETE
    ON public.product_variants
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_variant_inventory_sku();


-- Restrict direct invocation. Trigger execution must be tested with the
-- actual migration owner and runtime roles before approving these revokes.
REVOKE ALL ON FUNCTION public.sync_product_inventory_sku()
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.sync_variant_inventory_sku()
    FROM PUBLIC, anon, authenticated;


-- ============================================================
-- SECTION 4: ORDER IDEMPOTENCY
-- ============================================================

CREATE TABLE public.order_idempotency (
    idempotency_key UUID PRIMARY KEY,

    request_hash TEXT NOT NULL,

    order_id UUID NULL
        REFERENCES public.orders(id)
        ON DELETE RESTRICT,

    response JSONB NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT order_idempotency_request_hash_check
        CHECK (request_hash ~ '^[0-9a-f]{64}$'),

    CONSTRAINT order_idempotency_response_object_check
        CHECK (
            response IS NULL
            OR jsonb_typeof(response) = 'object'
        ),

    CONSTRAINT order_idempotency_order_response_check
        CHECK (
            (order_id IS NULL AND response IS NULL)
            OR
            (order_id IS NOT NULL AND response IS NOT NULL)
        )
);

CREATE UNIQUE INDEX order_idempotency_order_id_key
    ON public.order_idempotency(order_id)
    WHERE order_id IS NOT NULL;


-- ============================================================
-- SECTION 5: VARIANT-AWARE STOCK MOVEMENTS
-- ============================================================

CREATE TABLE public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id UUID NOT NULL
        REFERENCES public.products(id)
        ON DELETE RESTRICT,

    variant_id UUID NULL,

    order_id UUID NULL
        REFERENCES public.orders(id)
        ON DELETE RESTRICT,

    movement_type TEXT NOT NULL,

    quantity_delta INTEGER NOT NULL,

    stock_before INTEGER NOT NULL,

    stock_after INTEGER NOT NULL,

    reason TEXT NULL,

    actor_user_id UUID NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT stock_movements_variant_product_fkey
        FOREIGN KEY (variant_id, product_id)
        REFERENCES public.product_variants(id, product_id)
        ON DELETE RESTRICT,

    CONSTRAINT stock_movements_type_check
        CHECK (
            movement_type IN (
                'order_reserved',
                'order_cancelled',
                'admin_adjustment'
            )
        ),

    CONSTRAINT stock_movements_quantity_check
        CHECK (quantity_delta <> 0),

    CONSTRAINT stock_movements_before_check
        CHECK (stock_before >= 0),

    CONSTRAINT stock_movements_after_check
        CHECK (stock_after >= 0),

    CONSTRAINT stock_movements_balance_check
        CHECK (stock_after = stock_before + quantity_delta),

    CONSTRAINT stock_movements_order_type_check
        CHECK (
            (
                movement_type = 'admin_adjustment'
                AND order_id IS NULL
            )
            OR
            (
                movement_type IN ('order_reserved', 'order_cancelled')
                AND order_id IS NOT NULL
            )
        )
);


-- One reservation per sellable inventory item per order.
-- Separate partial indexes preserve product-only legacy lines.
CREATE UNIQUE INDEX stock_movements_order_reserved_product_key
    ON public.stock_movements(order_id, product_id)
    WHERE movement_type = 'order_reserved'
      AND variant_id IS NULL;

CREATE UNIQUE INDEX stock_movements_order_reserved_variant_key
    ON public.stock_movements(order_id, product_id, variant_id)
    WHERE movement_type = 'order_reserved'
      AND variant_id IS NOT NULL;


CREATE UNIQUE INDEX stock_movements_order_cancelled_product_key
    ON public.stock_movements(order_id, product_id)
    WHERE movement_type = 'order_cancelled'
      AND variant_id IS NULL;

CREATE UNIQUE INDEX stock_movements_order_cancelled_variant_key
    ON public.stock_movements(order_id, product_id, variant_id)
    WHERE movement_type = 'order_cancelled'
      AND variant_id IS NOT NULL;


CREATE INDEX stock_movements_product_created_at_idx
    ON public.stock_movements(product_id, created_at DESC);

CREATE INDEX stock_movements_variant_created_at_idx
    ON public.stock_movements(variant_id, created_at DESC)
    WHERE variant_id IS NOT NULL;

CREATE INDEX stock_movements_order_id_idx
    ON public.stock_movements(order_id)
    WHERE order_id IS NOT NULL;


-- ============================================================
-- SECTION 6: RLS, POLICIES AND TABLE PRIVILEGES
-- ============================================================

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;


-- Product variants:
-- Public/anonymous users can read active variants only when their parent
-- product is active. This policy does not grant write access.
CREATE POLICY product_variants_public_active_select
    ON public.product_variants
    FOR SELECT
    TO anon, authenticated
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1
            FROM public.products p
            WHERE p.id = product_variants.product_id
              AND p.is_active = true
        )
    );


-- Verified admins can manage variants. This assumes the existing
-- admin_users membership table and auth.uid() policy convention.
CREATE POLICY product_variants_admin_manage
    ON public.product_variants
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.admin_users au
            WHERE au.user_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.admin_users au
            WHERE au.user_id = (SELECT auth.uid())
        )
    );


-- Internal tables: no anon/authenticated policies.
-- service_role is expected to bypass RLS in Supabase; verify this in
-- the target project. Do not create browser-facing policies for these.
-- No policy is created for inventory_skus, order_idempotency or
-- stock_movements.


REVOKE ALL ON TABLE public.product_variants
    FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.product_variants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.product_variants TO authenticated;

REVOKE ALL ON TABLE public.inventory_skus
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.order_idempotency
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.stock_movements
    FROM PUBLIC, anon, authenticated;


-- Trusted backend grants. Reconcile with the final RPC ownership model.
GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.product_variants
    TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.inventory_skus
    TO service_role;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.order_idempotency
    TO service_role;

GRANT SELECT, INSERT
    ON TABLE public.stock_movements
    TO service_role;


-- Product variants admin policy requires authenticated SELECT/INSERT/
-- UPDATE/DELETE table privileges as granted above. RLS still limits
-- writes to verified admin membership. The public SELECT policy limits
-- non-admin reads to active variants of active products.


-- ============================================================
-- SECTION 7: ORDER / CART / API CONTRACT — NOT IMPLEMENTED HERE
-- ============================================================

-- Variant line identity is (product_id, variant_id).
-- Legacy product-only line identity is (product_id, NULL).
--
-- Variant order snapshot example:
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
-- Legacy product-only snapshot remains supported:
-- {
--   "id": "product-uuid",
--   "name": "Existing product",
--   "quantity": 1,
--   "price": 100
-- }
--
-- Required separate RPC changes:
--   1. Accept product_id and optional variant_id per order line.
--   2. Aggregate by the composite identity, not product_id alone.
--   3. Reject a line that supplies a variant belonging to another product.
--   4. Lock product/variant inventory rows in deterministic order.
--   5. Re-read active state, price and stock from the database.
--   6. Variant lines decrement product_variants.stock.
--   7. Legacy lines decrement products.stock.
--   8. Build immutable server-calculated order snapshots.
--   9. Record matching stock_movements rows in the same transaction.
--  10. Cancellation reconciles and restores by (product_id, variant_id).
--  11. Idempotency hash includes variant_id and quantity.
--  12. Repeated cancellation must never restore stock twice.
--  13. Product edit must not overwrite stock; stock adjustment is a
--      separate audited workflow.
--
-- Required frontend changes:
--   - Product management: variant CRUD; no stock edit in general product
--     form; separate audited stock adjustment.
--   - Product details: active variant selector; variant-specific price,
--     SKU and stock; selection required whenever variants exist.
--   - Cart: line key is product_id + variant_id; preserve legacy cart rows.
--   - Checkout: send variant_id; persist it in pending retry payload.
--   - create-order Edge Function: validate composite line identities.
--   - Admin order UI: display immutable variant snapshot.
--   - Demo seed: 10 demo products across at least 5 categories, selected
--     products with 2-3 variants; development environment only.


-- ============================================================
-- SECTION 8: IMPORTANT DESIGN LIMITATIONS / REVIEW ITEMS
-- ============================================================

-- A. Variant-managed product stock:
--    Decide whether products.stock is ignored or maintained as a derived
--    aggregate. Recommended: variant stock is authoritative; product.stock
--    must not be independently decremented for variant lines. UI must not
--    display stale product.stock as the variant product's available stock.
--
-- B. SKU trigger owner:
--    SECURITY DEFINER is a privileged boundary. Assign a trusted owner,
--    inspect owner privileges, fix search_path, schema-qualify objects,
--    revoke direct invocation, and test. Do not leave ownership implicit.
--
-- C. RLS policy interaction:
--    Existing products SELECT policy and admin policy must be checked.
--    The variant policy's parent-product EXISTS query must be tested under
--    anon and authenticated roles to ensure no unintended data exposure.
--
-- D. Function permissions:
--    The proposed SECURITY DEFINER trigger functions write inventory_skus.
--    Do not rely on service_role grants for these functions; the function
--    owner must have the exact required privileges.
--
-- E. SKU normalization:
--    This draft uses lower(btrim(sku)) as the uniqueness key. Test locale,
--    collation and existing SKU compatibility before adopting it.
--
-- F. Product deletion:
--    Product deletion is restricted while variants exist. Registry rows
--    cascade with their owner. Stock movement history restricts deletion
--    of referenced products/variants. Prefer deactivation for history.
--
-- G. Variant deletion:
--    A variant referenced by stock_movements cannot be deleted. Deactivate
--    it instead. Do not cascade-delete audit history.
--
-- H. Stock movement uniqueness:
--    These indexes permit one reservation and one cancellation per
--    sellable item per order. Verify that RPC aggregation guarantees one
--    row per composite inventory identity.
--
-- I. Status history:
--    Customer Journey architecture says note; its SQL draft uses
--    internal_note. Reconcile before creating the combined migration.
--
-- J. Migration ordering:
--    This is not a standalone baseline. It depends on verified existing
--    products, orders, categories, admin_users and set_products_updated_at.
--    Reconcile object names and existing grants/policies before execution.
--
-- K. Rollback:
--    Rollback after demo/order data exists may destroy inventory history.
--    Define a staged rollback policy. Never drop live order/stock history
--    merely to reverse a schema change.


-- ============================================================
-- SECTION 9: REQUIRED TEST CHECKLIST
-- ============================================================

-- [ ] Fresh disposable DB built from verified schema evidence.
-- [ ] Existing product-only public catalogue remains readable.
-- [ ] Existing product-only cart/checkout/order creation still works.
-- [ ] Existing product-only cancellation restores product stock.
-- [ ] SKU backfill rejects case-insensitive duplicate values.
-- [ ] SKU backfill rejects leading/trailing whitespace.
-- [ ] Product SKU cannot collide with another product SKU.
-- [ ] Variant SKU cannot collide with another variant SKU.
-- [ ] Product SKU cannot collide with a variant SKU, in either direction.
-- [ ] SKU update collision rolls back the source row update.
-- [ ] SKU trigger works for authenticated admin writes without direct
--      authenticated write access to inventory_skus.
-- [ ] Non-admin authenticated user cannot create/update/delete variants.
-- [ ] Anonymous user can read only active variants of active products.
-- [ ] Browser roles cannot access inventory_skus, order_idempotency,
--      or stock_movements directly.
-- [ ] Composite FK rejects a variant paired with the wrong product.
-- [ ] Multiple variants of one product can appear in one order.
-- [ ] Same variant duplicate lines aggregate correctly.
-- [ ] Variant price and stock are validated server-side.
-- [ ] Concurrent reservations cannot oversell variant stock.
-- [ ] Cancellation restores the exact variant stock exactly once.
-- [ ] Legacy product-only reservations/cancellations still work.
-- [ ] Idempotent retry with identical payload returns original result.
-- [ ] Same idempotency key with changed variant/quantity is rejected.
-- [ ] RLS, grants, function owners and trigger permissions verified.
-- [ ] Rollback tested in disposable DB with realistic order history.


-- ============================================================
-- FINAL STATUS: REVIEW DRAFT ONLY — DO NOT EXECUTE
-- This file has not been executed against any database.
-- ============================================================
