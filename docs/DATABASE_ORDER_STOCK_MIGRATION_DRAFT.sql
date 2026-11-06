-- ============================================================
-- ROYAL SHOP: ORDER & STOCK MIGRATION DRAFT
-- Date: 2026-11-04
-- STATUS: DRAFT ONLY — DO NOT EXECUTE
--
-- This file is a proposal, not an approved production migration.
-- Review every statement before any database execution.
-- ============================================================

-- ============================================================
-- SECTION 1: IDEMPOTENCY TABLE
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
-- SECTION 2: STOCK MOVEMENT AUDIT TABLE
-- ============================================================

CREATE TABLE public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id UUID NOT NULL
        REFERENCES public.products(id)
        ON DELETE RESTRICT,

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
                movement_type IN (
                    'order_reserved',
                    'order_cancelled'
                )
                AND order_id IS NOT NULL
            )
        )
);


-- One reservation per product per order.
CREATE UNIQUE INDEX stock_movements_order_reserved_key
    ON public.stock_movements(order_id, product_id)
    WHERE movement_type = 'order_reserved';


-- One restoration per product per order.
CREATE UNIQUE INDEX stock_movements_order_cancelled_key
    ON public.stock_movements(order_id, product_id)
    WHERE movement_type = 'order_cancelled';


-- Useful for product stock history.
CREATE INDEX stock_movements_product_created_at_idx
    ON public.stock_movements(product_id, created_at DESC);


-- Useful for order stock history.
CREATE INDEX stock_movements_order_id_idx
    ON public.stock_movements(order_id)
    WHERE order_id IS NOT NULL;


-- ============================================================
-- SECTION 3: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.order_idempotency
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stock_movements
    ENABLE ROW LEVEL SECURITY;


-- No anon or authenticated policies are proposed here.
-- Backend-only access is intended.
-- service_role access and RPC execution must be reviewed separately.


-- ============================================================
-- SECTION 4: TABLE PRIVILEGES — PROPOSAL
-- ============================================================

REVOKE ALL ON TABLE public.order_idempotency
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.stock_movements
    FROM PUBLIC, anon, authenticated;


-- Backend service role needs access for trusted RPC execution.
-- Do not expose the service_role key to browser code.

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.order_idempotency
    TO service_role;

GRANT SELECT, INSERT
    ON TABLE public.stock_movements
    TO service_role;


-- ============================================================
-- END OF DRAFT SECTION 1
-- RPC functions are intentionally not included yet.
-- ============================================================
