-- ============================================================
-- ROYAL SHOP: ATOMIC ORDER & CANCELLATION FUNCTIONS (V2)
-- Date: 2026-11-04
-- STATUS: REVIEW DRAFT ONLY — DO NOT EXECUTE
--
-- Dependencies:
--   public.orders
--   public.products
--   public.order_idempotency
--   public.stock_movements
--
-- This file is a design draft. It has NOT been run against the
-- Supabase database and is NOT approved for production.
-- ============================================================


-- ============================================================
-- FUNCTION 1: ATOMIC ORDER CREATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_idempotency_key UUID,
    p_request_hash TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_address TEXT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
    v_inserted INTEGER;
    v_existing_hash TEXT;
    v_existing_order_id UUID;
    v_existing_response JSONB;

    v_item JSONB;
    v_item_id_text TEXT;
    v_quantity_text TEXT;
    v_quantity INTEGER;

    v_line RECORD;
    v_product RECORD;
    v_movement RECORD;

    v_order_id UUID;
    v_order_number TEXT;

    v_verified_items JSONB := '[]'::JSONB;
    v_movement_rows JSONB := '[]'::JSONB;
    v_response JSONB;

    v_item_count INTEGER := 0;
    v_subtotal NUMERIC := 0;

    v_stock_before INTEGER;
    v_stock_after INTEGER;
BEGIN
    -- Validate scalar fields explicitly, including NULL values.
    IF p_idempotency_key IS NULL
       OR p_request_hash IS NULL
       OR p_request_hash !~ '^[0-9a-f]{64}$'
       OR p_customer_name IS NULL
       OR length(btrim(p_customer_name)) = 0
       OR length(p_customer_name) > 100
       OR p_customer_phone IS NULL
       OR p_customer_phone !~ '^01[3-9][0-9]{8}$'
       OR p_address IS NULL
       OR length(btrim(p_address)) = 0
       OR length(p_address) > 500
       OR p_items IS NULL
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'INVALID_ORDER_REQUEST';
    END IF;

    -- Check JSON type and array size in separate statements so
    -- array functions are never applied to a non-array value.
    IF jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'INVALID_ORDER_ITEMS';
    END IF;

    IF jsonb_array_length(p_items) < 1
       OR jsonb_array_length(p_items) > 20
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'INVALID_ORDER_ITEM_COUNT';
    END IF;

    -- Validate each JSON element before any casts or aggregation.
    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_items)
    LOOP
        IF jsonb_typeof(v_item) <> 'object' THEN
            RAISE EXCEPTION USING
                ERRCODE = '22023',
                MESSAGE = 'INVALID_ORDER_ITEM';
        END IF;

        v_item_id_text := v_item ->> 'id';
        v_quantity_text := v_item ->> 'quantity';

        IF v_item_id_text IS NULL
           OR v_item_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           OR v_quantity_text IS NULL
           OR length(v_quantity_text) > 2
           OR v_quantity_text !~ '^[0-9]+$'
        THEN
            RAISE EXCEPTION USING
                ERRCODE = '22023',
                MESSAGE = 'INVALID_ORDER_ITEM';
        END IF;

        v_quantity := v_quantity_text::INTEGER;

        IF v_quantity NOT BETWEEN 1 AND 20 THEN
            RAISE EXCEPTION USING
                ERRCODE = '22023',
                MESSAGE = 'INVALID_ORDER_ITEM_QUANTITY';
        END IF;
    END LOOP;

    -- Aggregate duplicate product IDs and enforce the per-product
    -- maximum before reserving the idempotency key.
    IF EXISTS (
        SELECT 1
        FROM (
            SELECT
                (value ->> 'id')::UUID AS product_id,
                SUM((value ->> 'quantity')::INTEGER) AS total_quantity
            FROM jsonb_array_elements(p_items)
            GROUP BY (value ->> 'id')::UUID
        ) AS grouped_items
        WHERE grouped_items.total_quantity > 20
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'PRODUCT_QUANTITY_LIMIT_EXCEEDED';
    END IF;

    -- Reserve the idempotency key inside this transaction.
    INSERT INTO public.order_idempotency (
        idempotency_key,
        request_hash
    )
    VALUES (
        p_idempotency_key,
        p_request_hash
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    -- A previous request with this key already committed.
    IF v_inserted = 0 THEN
        SELECT
            request_hash,
            order_id,
            response
        INTO
            v_existing_hash,
            v_existing_order_id,
            v_existing_response
        FROM public.order_idempotency
        WHERE idempotency_key = p_idempotency_key
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'IDEMPOTENCY_RECORD_NOT_FOUND';
        END IF;

        IF v_existing_hash IS DISTINCT FROM p_request_hash THEN
            RAISE EXCEPTION USING
                ERRCODE = '22023',
                MESSAGE = 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST';
        END IF;

        IF v_existing_order_id IS NULL
           OR v_existing_response IS NULL
        THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'INCOMPLETE_IDEMPOTENCY_RECORD';
        END IF;

        RETURN v_existing_response;
    END IF;

    -- Lock unique products in deterministic UUID order. The same
    -- order is used by cancellation to reduce deadlock risk.
    FOR v_line IN
        SELECT
            (value ->> 'id')::UUID AS product_id,
            SUM((value ->> 'quantity')::INTEGER)::INTEGER AS quantity
        FROM jsonb_array_elements(p_items)
        GROUP BY (value ->> 'id')::UUID
        ORDER BY (value ->> 'id')::UUID
    LOOP
        SELECT
            id,
            name,
            price,
            stock,
            is_active
        INTO v_product
        FROM public.products
        WHERE id = v_line.product_id
        FOR UPDATE;

        IF NOT FOUND OR v_product.is_active IS NOT TRUE THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'PRODUCT_UNAVAILABLE';
        END IF;

        IF v_product.price IS NULL
           OR v_product.price < 0
           OR v_product.stock IS NULL
           OR v_product.stock < 0
        THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'INVALID_PRODUCT_DATA';
        END IF;

        IF v_product.stock < v_line.quantity THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'INSUFFICIENT_STOCK';
        END IF;

        v_stock_before := v_product.stock;
        v_stock_after := v_stock_before - v_line.quantity;

        UPDATE public.products
        SET stock = v_stock_after
        WHERE id = v_line.product_id;

        v_verified_items :=
            v_verified_items ||
            jsonb_build_array(
                jsonb_build_object(
                    'id', v_product.id,
                    'name', v_product.name,
                    'quantity', v_line.quantity,
                    'price', v_product.price
                )
            );

        v_item_count := v_item_count + v_line.quantity;
        v_subtotal := v_subtotal + (v_product.price * v_line.quantity);

        -- Buffer audit facts in this function's local variable.
        -- No NULL order_id rows are written to stock_movements.
        v_movement_rows :=
            v_movement_rows ||
            jsonb_build_array(
                jsonb_build_object(
                    'product_id', v_product.id,
                    'quantity', v_line.quantity,
                    'stock_before', v_stock_before,
                    'stock_after', v_stock_after
                )
            );
    END LOOP;

    v_order_number :=
        'RS-' ||
        pg_catalog.to_char(
            pg_catalog.clock_timestamp(),
            'YYYYMMDDHH24MISS'
        ) ||
        '-' ||
        pg_catalog.upper(
            pg_catalog.left(
                pg_catalog.replace(
                    pg_catalog.gen_random_uuid()::TEXT,
                    '-',
                    ''
                ),
                8
            )
        );

    INSERT INTO public.orders (
        order_number,
        customer_name,
        customer_phone,
        district,
        upazila,
        area,
        address,
        customer_note,
        items,
        item_count,
        subtotal,
        delivery_charge,
        total,
        payment_method,
        status
    )
    VALUES (
        v_order_number,
        btrim(p_customer_name),
        p_customer_phone,
        '',
        '',
        NULL,
        btrim(p_address),
        NULL,
        v_verified_items,
        v_item_count,
        v_subtotal,
        0,
        v_subtotal,
        'COD',
        'pending'
    )
    RETURNING id INTO v_order_id;

    -- Insert audit rows only after the real order ID exists.
    -- These inserts are in the same transaction as stock updates
    -- and order creation; any error rolls the entire transaction back.
    FOR v_movement IN
        SELECT value
        FROM jsonb_array_elements(v_movement_rows)
    LOOP
        INSERT INTO public.stock_movements (
            product_id,
            order_id,
            movement_type,
            quantity_delta,
            stock_before,
            stock_after,
            reason
        )
        VALUES (
            (v_movement.value ->> 'product_id')::UUID,
            v_order_id,
            'order_reserved',
            -((v_movement.value ->> 'quantity')::INTEGER),
            (v_movement.value ->> 'stock_before')::INTEGER,
            (v_movement.value ->> 'stock_after')::INTEGER,
            'Stock reserved for new order'
        );
    END LOOP;

    v_response := jsonb_build_object(
        'success', TRUE,
        'orderNumber', v_order_number,
        'items', v_verified_items,
        'itemCount', v_item_count,
        'subtotal', v_subtotal,
        'deliveryCharge', 0,
        'total', v_subtotal,
        'message', 'Order saved successfully.'
    );

    UPDATE public.order_idempotency
    SET
        order_id = v_order_id,
        response = v_response
    WHERE idempotency_key = p_idempotency_key;

    RETURN v_response;
END;
$function$;


-- ============================================================
-- FUNCTION 2: CANCEL ORDER AND RESTORE STOCK
-- Only pending and confirmed orders are cancellable.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_order_atomic(
    p_order_number TEXT,
    p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
    v_order RECORD;
    v_item JSONB;
    v_item_id_text TEXT;
    v_quantity_text TEXT;
    v_quantity INTEGER;

    v_line RECORD;
    v_product RECORD;

    v_stock_before INTEGER;
    v_stock_after INTEGER;
BEGIN
    IF p_order_number IS NULL
       OR length(btrim(p_order_number)) = 0
       OR p_actor_user_id IS NULL
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'INVALID_CANCELLATION_REQUEST';
    END IF;

    -- Lock order first. Concurrent cancellation attempts serialize
    -- here; only the transaction changing status can restore stock.
    SELECT
        id,
        order_number,
        status,
        items
    INTO v_order
    FROM public.orders
    WHERE order_number = p_order_number
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0002',
            MESSAGE = 'ORDER_NOT_FOUND';
    END IF;

    IF v_order.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'alreadyCancelled', TRUE,
            'orderNumber', v_order.order_number
        );
    END IF;

    IF v_order.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'ORDER_STATUS_NOT_CANCELLABLE';
    END IF;

    IF v_order.items IS NULL
       OR jsonb_typeof(v_order.items) <> 'array'
       OR jsonb_array_length(v_order.items) = 0
    THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'INVALID_STORED_ORDER_ITEMS';
    END IF;

    -- Validate stored item data before UUID/integer casts.
    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(v_order.items)
    LOOP
        IF jsonb_typeof(v_item) <> 'object' THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'INVALID_STORED_ORDER_ITEM';
        END IF;

        v_item_id_text := v_item ->> 'id';
        v_quantity_text := v_item ->> 'quantity';

        IF v_item_id_text IS NULL
           OR v_item_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           OR v_quantity_text IS NULL
           OR length(v_quantity_text) > 2
           OR v_quantity_text !~ '^[0-9]+$'
        THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'INVALID_STORED_ORDER_ITEM';
        END IF;

        v_quantity := v_quantity_text::INTEGER;

        IF v_quantity NOT BETWEEN 1 AND 20 THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'INVALID_STORED_ORDER_QUANTITY';
        END IF;
    END LOOP;

    -- P0 SAFETY: Require an exact reservation audit match before restoring stock.
    -- This blocks legacy orders and any incomplete or inconsistent reservation history.

    IF EXISTS (
        SELECT 1
        FROM public.stock_movements
        WHERE order_id = v_order.id
          AND movement_type = 'order_cancelled'
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'CANCELLATION_AUDIT_ALREADY_EXISTS';
    END IF;

    IF EXISTS (
        WITH order_lines AS (
            SELECT
                (value ->> 'id')::UUID AS product_id,
                SUM((value ->> 'quantity')::INTEGER)::BIGINT AS quantity
            FROM jsonb_array_elements(v_order.items)
            GROUP BY (value ->> 'id')::UUID
        ),
        reservation_lines AS (
            SELECT
                product_id,
                COUNT(*) AS audit_count,
                SUM(quantity_delta)::BIGINT AS quantity_delta
            FROM public.stock_movements
            WHERE order_id = v_order.id
              AND movement_type = 'order_reserved'
            GROUP BY product_id
        )
        SELECT 1
        FROM order_lines o
        FULL JOIN reservation_lines r
            ON r.product_id = o.product_id
        WHERE o.product_id IS NULL
           OR r.product_id IS NULL
           OR r.audit_count <> 1
           OR r.quantity_delta <> -o.quantity
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'CANCELLATION_RESERVATION_AUDIT_MISMATCH';
    END IF;
    -- Restore products in deterministic UUID order.
    FOR v_line IN
        SELECT
            (value ->> 'id')::UUID AS product_id,
            SUM((value ->> 'quantity')::INTEGER)::INTEGER AS quantity
        FROM jsonb_array_elements(v_order.items)
        GROUP BY (value ->> 'id')::UUID
        ORDER BY (value ->> 'id')::UUID
    LOOP
        SELECT
            id,
            stock
        INTO v_product
        FROM public.products
        WHERE id = v_line.product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'ORDER_PRODUCT_NO_LONGER_EXISTS';
        END IF;

        IF v_product.stock IS NULL
           OR v_product.stock < 0
           OR v_product.stock > 2147483647 - v_line.quantity
        THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'STOCK_RESTORATION_OUT_OF_RANGE';
        END IF;

        v_stock_before := v_product.stock;
        v_stock_after := v_stock_before + v_line.quantity;

        UPDATE public.products
        SET stock = v_stock_after
        WHERE id = v_line.product_id;

        INSERT INTO public.stock_movements (
            product_id,
            order_id,
            movement_type,
            quantity_delta,
            stock_before,
            stock_after,
            reason,
            actor_user_id
        )
        VALUES (
            v_product.id,
            v_order.id,
            'order_cancelled',
            v_line.quantity,
            v_stock_before,
            v_stock_after,
            'Stock restored after order cancellation',
            p_actor_user_id
        );
    END LOOP;

    -- Status update is in the same transaction as all restorations.
    UPDATE public.orders
    SET
        status = 'cancelled',
        updated_at = pg_catalog.now()
    WHERE id = v_order.id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'alreadyCancelled', FALSE,
        'orderNumber', v_order.order_number,
        'status', 'cancelled',
        'stockRestored', TRUE
    );
END;
$function$;


-- ============================================================
-- ============================================================
-- ATOMIC ADMIN PRODUCT STOCK ADJUSTMENT
-- STATUS: REVIEW DRAFT ONLY
-- ============================================================

CREATE OR REPLACE FUNCTION public.adjust_product_stock_atomic(
    p_product_id UUID,
    p_delta INTEGER,
    p_reason TEXT,
    p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
    v_product RECORD;
    v_new_stock BIGINT;
    v_stock_before INTEGER;
    v_stock_after INTEGER;
BEGIN
    IF p_product_id IS NULL
       OR p_delta IS NULL
       OR p_delta = 0
       OR p_actor_user_id IS NULL
       OR p_reason IS NULL
       OR length(btrim(p_reason)) = 0
       OR length(btrim(p_reason)) > 500
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'INVALID_STOCK_ADJUSTMENT_REQUEST';
    END IF;

    -- Serialize adjustments and order reservations for this product.
    SELECT id, stock
    INTO v_product
    FROM public.products
    WHERE id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0002',
            MESSAGE = 'PRODUCT_NOT_FOUND';
    END IF;

    IF v_product.stock IS NULL OR v_product.stock < 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'INVALID_CURRENT_PRODUCT_STOCK';
    END IF;

    -- BIGINT arithmetic prevents INTEGER overflow during validation.
    v_new_stock :=
        v_product.stock::BIGINT + p_delta::BIGINT;

    IF v_new_stock < 0 OR v_new_stock > 2147483647 THEN
        RAISE EXCEPTION USING
            ERRCODE = '22003',
            MESSAGE = 'STOCK_ADJUSTMENT_OUT_OF_RANGE';
    END IF;

    v_stock_before := v_product.stock;
    v_stock_after := v_new_stock::INTEGER;

    UPDATE public.products
    SET stock = v_stock_after
    WHERE id = v_product.id;

    INSERT INTO public.stock_movements (
        product_id,
        order_id,
        movement_type,
        quantity_delta,
        stock_before,
        stock_after,
        reason,
        actor_user_id
    )
    VALUES (
        v_product.id,
        NULL,
        'admin_adjustment',
        p_delta,
        v_stock_before,
        v_stock_after,
        btrim(p_reason),
        p_actor_user_id
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'productId', v_product.id,
        'quantityDelta', p_delta,
        'stockBefore', v_stock_before,
        'stockAfter', v_stock_after
    );
END;
$function$;


-- FUNCTION EXECUTION PERMISSIONS
-- ============================================================

REVOKE ALL ON FUNCTION public.create_order_atomic(
    UUID, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.cancel_order_atomic(
    TEXT, UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(
    UUID, TEXT, TEXT, TEXT, TEXT, JSONB
) TO service_role;

GRANT EXECUTE ON FUNCTION public.cancel_order_atomic(
    TEXT, UUID
) TO service_role;
REVOKE ALL ON FUNCTION public.adjust_product_stock_atomic(
    UUID, INTEGER, TEXT, UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.adjust_product_stock_atomic(
    UUID, INTEGER, TEXT, UUID
) TO service_role;


-- ============================================================
-- REQUIRED REVIEW BEFORE ANY EXECUTION
-- ============================================================
-- 1. Confirm actual table constraints and grants for all four tables.
-- 2. Confirm stock_movements permits movement_type values
--    'order_reserved' and 'order_cancelled' and permits actor_user_id
--    to be NULL for order reservation rows.
-- 3. Confirm the partial unique indexes match one reservation and
--    one cancellation movement per order/product.
-- 4. The cancellation Edge Function MUST authenticate the admin,
--    verify admin_users membership server-side, and pass the verified
--    auth user ID as p_actor_user_id. This function does not itself
--    prove that the supplied UUID belongs to an admin.
-- 5. The create-order Edge Function must enforce store_settings
--    public_order_enabled, calculate a canonical SHA-256 request hash,
--    and reuse the same idempotency key for retries.
-- 6. The Edge Function must call these functions using service_role
--    only on the server. Never expose the service-role key to a browser.
-- 7. Product hard deletion can prevent cancellation restoration.
--    Review/disable hard-delete paths before enabling stock reservation.
-- 8. Existing product edit UI must not overwrite stock from a stale form.
--    Stock adjustments need a separate atomic, audited operation.
-- 9. Run rollback, concurrency, retry, cancellation, and permission tests
--    in a disposable test database before production consideration.
-- 10. This draft does not alter existing policies, triggers, or functions
--     until someone explicitly executes it.
--
-- STATUS: REVIEW DRAFT ONLY — DO NOT EXECUTE
-- ============================================================
