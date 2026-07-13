-- =============================================================================
-- Row Level Security — Frühstück Bestellen (Azur Camping)
-- =============================================================================
-- Auth model in this app:
--   • Next.js API routes use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
--   • Branch staff/admin: custom HMAC cookie (branch_credentials), NOT auth.uid().
--   • Root owner: custom HMAC cookie (root_admins), NOT auth.uid().
--   • Guests: no Supabase Auth user; orders go through API + create_order RPC.
--
-- This migration locks direct PostgREST access for anon/authenticated roles.
-- It does NOT map policies to auth.uid() because no user_id / owner_id columns exist.
-- TODO: When migrating to Supabase Auth, replace authenticated policies per table.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Enable RLS on every app table (skip if table missing in this environment)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'branches',
    'products',
    'menus',
    'menu_items',
    'daily_order_counters',
    'orders',
    'order_items',
    'branch_credentials',
    'root_admins',
    'platform_settings',
    'registrations_intake',
    'registrations_analytics'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Revoke broad table access from anon / authenticated (defense in depth)
--    service_role keeps full DML and bypasses RLS.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'branches',
    'products',
    'menus',
    'menu_items',
    'daily_order_counters',
    'orders',
    'order_items',
    'branch_credentials',
    'root_admins',
    'platform_settings',
    'registrations_intake',
    'registrations_analytics'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

-- Guest catalog read (optional direct client reads; app also uses service_role SSR)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'branches') THEN
    GRANT SELECT ON TABLE public.branches TO anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products') THEN
    GRANT SELECT ON TABLE public.products TO anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'menus') THEN
    GRANT SELECT ON TABLE public.menus TO anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'menu_items') THEN
    GRANT SELECT ON TABLE public.menu_items TO anon, authenticated;
  END IF;
END $$;

-- Public order placement via SECURITY DEFINER RPC (not direct table writes)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_order'
      AND pg_get_function_identity_arguments(p.oid) = 'text, date, text, jsonb, numeric, bigint'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.create_order(text, date, text, jsonb, numeric, bigint) TO anon, authenticated;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3) Drop existing policies (idempotent re-run)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'branches',
        'products',
        'menus',
        'menu_items',
        'daily_order_counters',
        'orders',
        'order_items',
        'branch_credentials',
        'root_admins',
        'platform_settings',
        'registrations_intake',
        'registrations_analytics'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4) PUBLIC READ-ONLY policies (anon + authenticated) — guest catalog only
-- -----------------------------------------------------------------------------

-- branches: active locations only (homepage / branch picker)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'branches') THEN
    CREATE POLICY branches_public_select_active
      ON public.branches
      FOR SELECT
      TO anon, authenticated
      USING (is_active = true);
    COMMENT ON POLICY branches_public_select_active ON public.branches IS
      'Guests may list active branches only. Writes are server-only (service_role).';
  END IF;
END $$;

-- products: active catalog lines for ordering UI
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products') THEN
    CREATE POLICY products_public_select_active
      ON public.products
      FOR SELECT
      TO anon, authenticated
      USING (
        is_active = true
        AND archived_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.branches b
          WHERE b.id = products.branch_id
            AND b.is_active = true
        )
      );
    COMMENT ON POLICY products_public_select_active ON public.products IS
      'Guests may read active products for active branches. No direct writes.';
  END IF;
END $$;

-- menus: active menus for active branches
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'menus') THEN
    CREATE POLICY menus_public_select_active
      ON public.menus
      FOR SELECT
      TO anon, authenticated
      USING (
        is_active = true
        AND archived_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.branches b
          WHERE b.id = menus.branch_id
            AND b.is_active = true
        )
      );
    COMMENT ON POLICY menus_public_select_active ON public.menus IS
      'Guests may read active menus for active branches. No direct writes.';
  END IF;
END $$;

-- menu_items: lines belonging to an active menu on an active branch
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'menu_items') THEN
    CREATE POLICY menu_items_public_select_active
      ON public.menu_items
      FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.menus m
          JOIN public.branches b ON b.id = m.branch_id
          WHERE m.id = menu_items.menu_id
            AND m.is_active = true
            AND m.archived_at IS NULL
            AND b.is_active = true
        )
      );
    COMMENT ON POLICY menu_items_public_select_active ON public.menu_items IS
      'Guests may read menu composition for active menus. No direct writes.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5) PRIVATE tables — no anon/authenticated policies (default DENY with RLS on)
--    App access: Next.js API + service_role only.
-- -----------------------------------------------------------------------------

-- orders: TODO — no auth.uid(); staff session is app-layer only
-- order_items: TODO — tied to orders.branch_id; no client JWT mapping
-- daily_order_counters: TODO — sequence table; must never be client-writable
-- branch_credentials: TODO — contains password_hash; never expose to client roles
-- root_admins: TODO — platform owner credentials; never expose to client roles
-- platform_settings: TODO — root toggle (registration_enabled); server-only
-- registrations_intake: TODO — PII; schema not fully versioned in repo migrations
-- registrations_analytics: TODO — aggregate registration metrics; server-only

-- Explicit deny documentation policies (optional clarity; RLS already denies without grants)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
    COMMENT ON TABLE public.orders IS
      'RLS enabled. No anon/authenticated policies — use create_order RPC or Next.js API (service_role).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'branch_credentials') THEN
    COMMENT ON TABLE public.branch_credentials IS
      'RLS enabled. No client policies. Staff auth via custom cookie + service_role API.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'root_admins') THEN
    COMMENT ON TABLE public.root_admins IS
      'RLS enabled. No client policies. Root auth via custom cookie + service_role API.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6) authenticated + auth.uid() — intentionally NO permissive policies
-- -----------------------------------------------------------------------------
-- This project does not create Supabase Auth users and has no user_id columns.
-- Adding auth.uid() policies would be misleading and unsafe to guess.
-- When Supabase Auth is adopted, add per-table policies like:
--   USING (branch_id IN (SELECT branch_id FROM branch_members WHERE user_id = (select auth.uid())))
-- -----------------------------------------------------------------------------

COMMIT;
