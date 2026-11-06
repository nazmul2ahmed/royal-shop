-- ============================================================
-- ROYAL SHOP: CUSTOMER JOURNEY MIGRATION DRAFT
-- Date: 2026-11-05
-- STATUS: REVIEW DRAFT ONLY — DO NOT EXECUTE
--
-- Purpose:
-- 1. Secure customer order tracking tokens.
-- 2. Maintain append-only order status history.
-- 3. Record customer WhatsApp acknowledgements.
--
-- This file is a proposal. It must be reviewed alongside
-- CUSTOMER_JOURNEY_ARCHITECTURE.md and the RPC function draft.
-- ============================================================


-- ============================================================
-- SECTION 1: ORDER TRACKING TOKENS
-- ============================================================

CREATE TABLE public.order_tracking_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES public.orders(id)
        ON DELETE RESTRICT,

    token_hash TEXT NOT NULL,

    -- AES-256-GCM encrypted envelope.
    -- Expected JSON keys:
    -- format, envelope_version, nonce, ciphertext, tag.
    -- Never store the plaintext tracking token here.
    encrypted_token JSONB NOT NULL,

    key_version INTEGER NOT NULL,

    expires_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT order_tracking_tokens_hash_check
        CHECK (token_hash ~ '^[0-9a-f]{64}$'),

    CONSTRAINT order_tracking_tokens_key_version_check
        CHECK (key_version > 0),

    CONSTRAINT order_tracking_tokens_envelope_check
        CHECK (
            jsonb_typeof(encrypted_token) = 'object'
            AND encrypted_token ? 'format'
            AND encrypted_token ? 'envelope_version'
            AND encrypted_token ? 'nonce'
            AND encrypted_token ? 'ciphertext'
            AND encrypted_token ? 'tag'
            AND encrypted_token->>'format' = 'A256GCM'
            AND encrypted_token->>'envelope_version' = '1'
            AND jsonb_typeof(encrypted_token->'nonce') = 'string'
            AND jsonb_typeof(encrypted_token->'ciphertext') = 'string'
            AND jsonb_typeof(encrypted_token->'tag') = 'string'
            AND length(encrypted_token->>'nonce') = 16
            AND length(encrypted_token->>'tag') = 24
            AND length(encrypted_token->>'ciphertext') > 0
            AND length(encrypted_token->>'ciphertext') % 4 = 0
            AND encrypted_token->>'nonce' ~ '^[A-Za-z0-9+/]{16}$'
            AND encrypted_token->>'tag' ~ '^[A-Za-z0-9+/]{22}==$'
            AND encrypted_token->>'ciphertext' ~ '^[A-Za-z0-9+/]+={0,2}$'
        )
);

CREATE UNIQUE INDEX order_tracking_tokens_token_hash_key
    ON public.order_tracking_tokens(token_hash);

-- An order may have historical revoked tokens,
-- but only one active token at a time.
CREATE UNIQUE INDEX order_tracking_tokens_one_active_per_order
    ON public.order_tracking_tokens(order_id)
    WHERE revoked_at IS NULL;

CREATE INDEX order_tracking_tokens_order_id_idx
    ON public.order_tracking_tokens(order_id);


-- ============================================================
-- SECTION 2: ORDER STATUS HISTORY
-- ============================================================

CREATE TABLE public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES public.orders(id)
        ON DELETE RESTRICT,

    old_status TEXT NULL,
    new_status TEXT NOT NULL,

    actor_type TEXT NOT NULL,
    changed_by UUID NULL,

    -- Internal administrative note.
    -- Never include this field in public tracking responses.
    internal_note TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT order_status_history_old_status_check
        CHECK (
            old_status IS NULL
            OR old_status IN (
                'pending',
                'confirmed',
                'processing',
                'shipped',
                'delivered',
                'cancelled'
            )
        ),

    CONSTRAINT order_status_history_new_status_check
        CHECK (
            new_status IN (
                'pending',
                'confirmed',
                'processing',
                'shipped',
                'delivered',
                'cancelled'
            )
        ),

    CONSTRAINT order_status_history_transition_check
        CHECK (
            old_status IS NULL
            OR old_status <> new_status
        ),

    CONSTRAINT order_status_history_actor_type_check
        CHECK (actor_type IN ('system', 'admin')),

    CONSTRAINT order_status_history_actor_identity_check
        CHECK (
            (actor_type = 'system' AND changed_by IS NULL)
            OR
            (actor_type = 'admin' AND changed_by IS NOT NULL)
        ),

    CONSTRAINT order_status_history_initial_status_check
        CHECK (
            old_status IS NOT NULL
            OR (
                new_status = 'pending'
                AND actor_type = 'system'
                AND changed_by IS NULL
            )
        ),

    CONSTRAINT order_status_history_note_length_check
        CHECK (
            internal_note IS NULL
            OR char_length(internal_note) <= 1000
        )
);

CREATE INDEX order_status_history_order_created_idx
    ON public.order_status_history(order_id, created_at, id);


-- ============================================================
-- SECTION 3: CUSTOMER ACKNOWLEDGEMENTS
-- ============================================================

CREATE TABLE public.order_customer_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES public.orders(id)
        ON DELETE RESTRICT,

    acknowledgement_type TEXT NOT NULL,
    channel TEXT NOT NULL,

    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT order_customer_acknowledgements_type_check
        CHECK (
            acknowledgement_type = 'whatsapp_message_sent'
        ),

    CONSTRAINT order_customer_acknowledgements_channel_check
        CHECK (channel = 'whatsapp'),

    -- One acknowledgement of this type per order.
    -- Concurrent duplicate submissions must return the existing row.
    CONSTRAINT order_customer_acknowledgements_unique
        UNIQUE (order_id, acknowledgement_type)
);


-- ============================================================
-- SECTION 4: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.order_tracking_tokens
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.order_status_history
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.order_customer_acknowledgements
    ENABLE ROW LEVEL SECURITY;

-- No anon or authenticated policies are proposed.
-- Public access must go through verified Edge Functions.
-- Do not expose service_role credentials to browser code.


-- ============================================================
-- SECTION 5: TABLE PRIVILEGES — PROPOSAL
-- ============================================================

REVOKE ALL ON TABLE public.order_tracking_tokens
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.order_status_history
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.order_customer_acknowledgements
    FROM PUBLIC, anon, authenticated;

-- Trusted backend access only.
-- Remove any pre-existing direct grants before applying least privilege.

REVOKE ALL ON TABLE public.order_tracking_tokens
    FROM service_role;

REVOKE ALL ON TABLE public.order_status_history
    FROM service_role;

REVOKE ALL ON TABLE public.order_customer_acknowledgements
    FROM service_role;

-- Token lifecycle requires SELECT, INSERT and UPDATE.
GRANT SELECT, INSERT, UPDATE
    ON TABLE public.order_tracking_tokens
    TO service_role;

-- Status history is append-only for application workflows.
GRANT SELECT, INSERT
    ON TABLE public.order_status_history
    TO service_role;

-- Acknowledgements are also append-only.
GRANT SELECT, INSERT
    ON TABLE public.order_customer_acknowledgements
    TO service_role;


-- ============================================================
-- SECTION 6: REQUIRED REVIEW BEFORE ANY EXECUTION
-- ============================================================

-- 1. Confirm actual orders table constraints and deletion behavior.
-- 2. Confirm the AES-256-GCM envelope format and key rotation contract.
-- 3. Verify token hash generation and constant-time verification
--    in the trusted backend implementation.
-- 4. Ensure token revocation and replacement occur atomically.
-- 5. Ensure revoked tokens can never become active again.
-- 6. Ensure order creation and initial pending history insertion
--    occur in the same database transaction.
-- 7. Ensure every status update and history insertion are atomic.
-- 8. Ensure history rows cannot be updated or deleted by application
--    workflows. Review privileged database-owner access separately.
-- 9. Ensure acknowledgement token verification and insertion are
--    atomic, including concurrent revocation scenarios.
-- 10. Ensure duplicate acknowledgements return the existing record.
-- 11. Review service_role grants against final RPC execution paths.
-- 12. Test constraints, rollback, concurrency and permissions in a
--     disposable database before any production consideration.
-- 13. This draft does not create policies, triggers, RPC functions,
--     or execute any database changes.

-- STATUS: REVIEW DRAFT ONLY — DO NOT EXECUTE
-- ============================================================


