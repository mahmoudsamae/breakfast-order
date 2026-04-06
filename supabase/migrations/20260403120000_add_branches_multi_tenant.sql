-- =============================================================================
-- Incremental migration: multi-branch (bigint IDs preserved, existing rows kept)
-- Apply on the CURRENT database only. Review constraint/index names in prod if needed.
-- =============================================================================
-- Prerequisites (verify in production before running):
-- - public.create_order(...) exists (see replacement below)
-- - daily_order_counters has PRIMARY KEY (pickup_date)
-- - orders has UNIQUE (pickup_date, order_number) — name may differ; see STEP 5
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- STEP 1: Branch registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT branches_slug_nonempty CHECK (length(trim(slug)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS branches_slug_lower_idx ON public.branches (lower(slug));

-- One row for all existing data (rename via UPDATE later if you wish)
INSERT INTO public.branches (name, slug, is_active)
SELECT 'Default', 'default', true
WHERE NOT EXISTS (SELECT 1 FROM public.branches);

-- -----------------------------------------------------------------------------
-- STEP 2: branch_id on catalog and orders (backfill single branch)
-- -----------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS branch_id bigint REFERENCES public.branches (id) ON DELETE RESTRICT;

ALTER TABLE public.menus
  ADD COLUMN IF NOT EXISTS branch_id bigint REFERENCES public.branches (id) ON DELETE RESTRICT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS branch_id bigint REFERENCES public.branches (id) ON DELETE RESTRICT;

UPDATE public.products SET branch_id = (SELECT id FROM public.branches ORDER BY id LIMIT 1) WHERE branch_id IS NULL;
UPDATE public.menus SET branch_id = (SELECT id FROM public.branches ORDER BY id LIMIT 1) WHERE branch_id IS NULL;
UPDATE public.orders SET branch_id = (SELECT id FROM public.branches ORDER BY id LIMIT 1) WHERE branch_id IS NULL;

ALTER TABLE public.products ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE public.menus ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN branch_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS products_branch_id_idx ON public.products (branch_id);
CREATE INDEX IF NOT EXISTS menus_branch_id_idx ON public.menus (branch_id);
CREATE INDEX IF NOT EXISTS orders_branch_id_idx ON public.orders (branch_id);

-- -----------------------------------------------------------------------------
-- STEP 3: products.category (app expects it; add only if missing)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'category'
  ) THEN
    ALTER TABLE public.products ADD COLUMN category text;
    UPDATE public.products SET category = 'backwaren' WHERE category IS NULL;
    ALTER TABLE public.products ALTER COLUMN category SET NOT NULL;
    ALTER TABLE public.products ALTER COLUMN category SET DEFAULT 'backwaren';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 4: daily_order_counters — PK (pickup_date) -> (branch_id, pickup_date)
-- -----------------------------------------------------------------------------
ALTER TABLE public.daily_order_counters
  ADD COLUMN IF NOT EXISTS branch_id bigint REFERENCES public.branches (id) ON DELETE CASCADE;

UPDATE public.daily_order_counters
SET branch_id = (SELECT id FROM public.branches ORDER BY id LIMIT 1)
WHERE branch_id IS NULL;

ALTER TABLE public.daily_order_counters ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.daily_order_counters DROP CONSTRAINT IF EXISTS daily_order_counters_pkey;

ALTER TABLE public.daily_order_counters
  ADD PRIMARY KEY (branch_id, pickup_date);

-- -----------------------------------------------------------------------------
-- STEP 5: orders — unique order numbers per branch per day
-- -----------------------------------------------------------------------------
-- Unique may exist as INDEX (migrations) or CONSTRAINT (pg default names). Drop both if present.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_pickup_date_order_number_key;
DROP INDEX IF EXISTS orders_pickup_date_order_number_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS orders_branch_pickup_order_number_uniq
  ON public.orders (branch_id, pickup_date, order_number);

-- -----------------------------------------------------------------------------
-- STEP 6: create_order — branch-aware; optional p_branch_id defaults to first branch
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name text,
  p_pickup_date date,
  p_source text,
  p_items jsonb,
  p_total_amount numeric DEFAULT 0,
  p_branch_id bigint DEFAULT NULL
)
RETURNS TABLE (order_id bigint, order_number int)
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_number int;
  v_order_id bigint;
  v_item jsonb;
  v_branch_id bigint;
BEGIN
  v_branch_id := COALESCE(
    p_branch_id,
    (SELECT id FROM public.branches WHERE is_active = true ORDER BY id LIMIT 1)
  );
  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'No active branch configured';
  END IF;

  INSERT INTO public.daily_order_counters (branch_id, pickup_date, last_number)
  VALUES (v_branch_id, p_pickup_date, 0)
  ON CONFLICT (branch_id, pickup_date) DO NOTHING;

  UPDATE public.daily_order_counters
  SET last_number = last_number + 1
  WHERE branch_id = v_branch_id AND pickup_date = p_pickup_date
  RETURNING last_number INTO v_next_number;

  INSERT INTO public.orders (
    branch_id,
    order_number,
    customer_name,
    pickup_date,
    status,
    source,
    total_amount
  )
  VALUES (
    v_branch_id,
    v_next_number,
    p_customer_name,
    p_pickup_date,
    'pending',
    COALESCE(p_source, 'qr'),
    COALESCE(p_total_amount, 0)
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    INSERT INTO public.order_items (order_id, product_id, menu_id, quantity, unit_price)
    VALUES (
      v_order_id,
      NULLIF(v_item->>'product_id', '')::bigint,
      NULLIF(v_item->>'menu_id', '')::bigint,
      GREATEST(1, COALESCE((v_item->>'quantity')::int, 1)),
      COALESCE((v_item->>'unit_price')::numeric, 0)
    );
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_next_number;
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 7 (optional): menu_items same-branch guard — only if menu_items exists
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'menu_items'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'enforce_menu_items_same_branch'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.enforce_menu_items_same_branch()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $body$
      DECLARE
        mb bigint;
        pb bigint;
      BEGIN
        SELECT branch_id INTO mb FROM public.menus WHERE id = NEW.menu_id;
        SELECT branch_id INTO pb FROM public.products WHERE id = NEW.product_id;
        IF mb IS DISTINCT FROM pb THEN
          RAISE EXCEPTION 'menu_items: menu and product must belong to the same branch';
        END IF;
        RETURN NEW;
      END;
      $body$;
    $fn$;
    DROP TRIGGER IF EXISTS menu_items_same_branch ON public.menu_items;
    CREATE TRIGGER menu_items_same_branch
      BEFORE INSERT OR UPDATE OF menu_id, product_id ON public.menu_items
      FOR EACH ROW
      EXECUTE PROCEDURE public.enforce_menu_items_same_branch();
  END IF;
END $$;

COMMIT;
