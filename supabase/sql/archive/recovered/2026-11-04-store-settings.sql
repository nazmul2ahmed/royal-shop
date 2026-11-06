BEGIN;

-- 1. Create the store settings table
CREATE TABLE IF NOT EXISTS public.store_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    public_order_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Insert the single settings row
INSERT INTO public.store_settings (
    id,
    public_order_enabled
)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 3. Enable Row Level Security
ALTER TABLE public.store_settings
ENABLE ROW LEVEL SECURITY;

-- 4. Remove default privileges from public roles
REVOKE ALL PRIVILEGES
ON TABLE public.store_settings
FROM anon, authenticated;

-- 5. Give authenticated users read and update permissions
GRANT SELECT, UPDATE
ON TABLE public.store_settings
TO authenticated;

-- 6. Allow service_role to access the table
GRANT ALL PRIVILEGES
ON TABLE public.store_settings
TO service_role;

-- 7. Remove old policies if they exist
DROP POLICY IF EXISTS store_settings_admin_select
ON public.store_settings;

DROP POLICY IF EXISTS store_settings_admin_update
ON public.store_settings;

-- 8. Only verified admins can read settings
CREATE POLICY store_settings_admin_select
ON public.store_settings
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE admin_users.user_id = (SELECT auth.uid())
    )
);

-- 9. Only verified admins can update settings
CREATE POLICY store_settings_admin_update
ON public.store_settings
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE admin_users.user_id = (SELECT auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE admin_users.user_id = (SELECT auth.uid())
    )
);

COMMIT;