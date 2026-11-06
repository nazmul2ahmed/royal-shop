-- ============================================================
-- ROYAL SHOP: ATOMIC ORDER & CANCELLATION FUNCTIONS
-- Date: 2026-11-04
-- STATUS: DRAFT ONLY — DO NOT EXECUTE
--
-- Dependencies:
--   public.orders
--   public.products
--   public.order_idempotency
--   public.stock_movements
--
-- This draft requires independent SQL review and testing.
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

    v_line RECORD;
    v_product RECORD;

    v_order_id UUID;
    v_order_number TEXT;

    v_verified_items JSONB := '[]'::JSONB;
    v_response JSONB;

    v_item_count INTEGER := 0;
    v_subtotal NUMERIC := 0;

    v_stock_before INTEGER;
    v_stock_after INTEGER;
BEGIN

    -- Basic request validation.
    IF p_idempotency_key IS NULL
       OR p_request_hash !~ '^[0-9a-f]{64}$'
       OR p_customer_name IS NULL
       OR length(btrim(p_customer_name)) = 0
       OR length(p_customer_name) > 100
       OR p_customer_phone !~ '^01[3-9][0-9]{8}$'
       OR p_address IS NULL
       OR length(btrim(p_address)) = 0
       OR length(p_address) > 500
       OR jsonb_typeof(p_items) <> 'array'
       OR jsonb_array_length(p_items) < 1
       OR jsonb_array_length(p_items) > 20
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'INVALID_ORDER_REQUEST';
    END IF;


    -- Validate each submitted item.
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_items) AS item(value)
        WHERE
            jsonb_typeof(item.value) <> 'object'
            OR (item.value ->> 'id') !~
                '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            OR (item.value ->> 'quantity') !~ '^[0-9]+$'
            OR (item.value ->> 'quantity')::INTEGER NOT BETWEEN 1 AND 20
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'INVALID_ORDER_ITEM';
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

        IF v_existing_hash <> p_request_hash THEN
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


    -- Process unique products in deterministic UUID order.
    -- This reduces deadlock risk between concurrent orders.
    FOR v_line IN
        SELECT
            (item.value ->> 'id')::UUID AS product_id,
            SUM((item.value ->> 'quantity')::INTEGER)::INTEGER AS quantity
        FROM jsonb_array_elements(p_items) AS item(value)
        GROUP BY (item.value ->> 'id')::UUID
        ORDER BY (item.value ->> 'id')::UUID
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

        IF v_line.quantity > 20 THEN
            RAISE EXCEPTION USING
                ERRCODE = '22023',
                MESSAGE = 'PRODUCT_QUANTITY_LIMIT_EXCEEDED';
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

        v_subtotal :=
            v_subtotal +
            (v_product.price * v_line.quantity);


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
            v_product.id,
            NULL,
            'order_reserved',
            -v_line.quantity,
            v_stock_before,
            v_stock_after,
            'Stock reserved for new order'
        );

    END LOOP;


    -- Create the order.
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
                    gen_random_uuid()::TEXT,
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


    -- Attach the order ID to the reservation audit records.
    UPDATE public.stock_movements
    SET order_id = v_order_id
    WHERE order_id IS NULL
      AND movement_type = 'order_reserved'
      AND created_at >= transaction_timestamp();


    -- Build the exact response to be replayed on retry.
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


    -- Lock the order so concurrent cancellation requests
    -- cannot restore stock more than once.
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


    -- Idempotent cancellation response.
    IF v_order.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'alreadyCancelled', TRUE,
            'orderNumber', v_order.order_number
        );
    END IF;


    -- Only pending and confirmed orders may be cancelled.
    IF v_order.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'ORDER_STATUS_NOT_CANCELLABLE';
    END IF;


    IF jsonb_typeof(v_order.items) <> 'array'
       OR jsonb_array_length(v_order.items) = 0
    THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'INVALID_STORED_ORDER_ITEMS';
    END IF;


    -- Restore products in deterministic UUID order.
    FOR v_line IN
        SELECT
            (item.value ->> 'id')::UUID AS product_id,
            SUM((item.value ->> 'quantity')::INTEGER)::INTEGER AS quantity
        FROM jsonb_array_elements(v_order.items) AS item(value)
        GROUP BY (item.value ->> 'id')::UUID
        ORDER BY (item.value ->> 'id')::UUID
    LOOP

        IF v_line.quantity IS NULL OR v_line.quantity < 1 THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'INVALID_STORED_ORDER_QUANTITY';
        END IF;


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


    -- Change order status only after successful restoration.
    UPDATE public.orders
    SET
        status = 'cancelled',
        updated_at = now()
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
-- SECTION 3: FUNCTION EXECUTION PERMISSIONS
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


-- ============================================================
-- IMPORTANT REVIEW ITEMS — NOT IMPLEMENTED HERE
-- ============================================================
--
-- 1. The order_reserved INSERT currently uses order_id NULL,
--    then associates rows by timestamp. This association method
--    MUST be replaced with a safer transaction-local design
--    before approval. Do not execute this draft.
--
-- 2. Edge Function must verify store_settings before calling
--    create_order_atomic.
--
-- 3. Edge Function must generate a canonical request hash and
--    preserve the same idempotency key on retry.
--
-- 4. Cancellation Edge Function must authenticate the admin,
--    verify admin_users membership, and pass the verified user ID.
--
-- 5. Product hard deletion can prevent later stock restoration.
--    Product deletion behavior needs a separate review.
--
-- 6. Product stock adjustment must use a separate atomic,
--    audited function.
--
-- 7. Error mapping, concurrent-request tests, rollback tests,
--    and security review are required before implementation.
--
-- 8. No existing policies, grants, triggers, or functions
--    are modified by this draft.
--
-- STATUS: NOT APPROVED — DO NOT EXECUTE
-- ============================================================
