-- =============================================================================
-- FRESH REBUILD — TEST DATABASE ONLY (Supabase SQL Editor)
-- Multi-branch breakfast ordering, bigint identity IDs (matches current app).
-- Drops existing public breakfast objects, recreates schema + create_order + seed.
-- Wrapped in a single transaction (BEGIN/COMMIT).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0) Drop existing objects (tables first — CASCADE removes triggers; then functions)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.menu_items CASCADE;
DROP TABLE IF EXISTS public.menus CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.daily_order_counters CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;

DROP FUNCTION IF EXISTS public.enforce_menu_items_same_branch() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_order_items_same_branch() CASCADE;

DROP FUNCTION IF EXISTS public.create_order(text, date, text, jsonb, numeric, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.create_order(text, date, text, jsonb, numeric) CASCADE;

-- -----------------------------------------------------------------------------
-- 1) Tenant root
-- -----------------------------------------------------------------------------
CREATE TABLE public.branches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT branches_name_nonempty CHECK (length(trim(name)) > 0),
  CONSTRAINT branches_slug_nonempty CHECK (length(trim(slug)) > 0)
);

CREATE UNIQUE INDEX branches_slug_lower_idx ON public.branches (lower(slug));

COMMENT ON TABLE public.branches IS 'Tenant root; all operational data is scoped by branch_id.';

-- -----------------------------------------------------------------------------
-- 2) Catalog
-- -----------------------------------------------------------------------------
CREATE TABLE public.products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  name text NOT NULL,
  price numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL DEFAULT 'backwaren'
    CHECK (category IN ('backwaren', 'getraenke', 'extras')),
  CONSTRAINT products_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX products_branch_id_idx ON public.products (branch_id);
CREATE INDEX products_branch_active_idx
  ON public.products (branch_id)
  WHERE is_active = true AND archived_at IS NULL;

CREATE TABLE public.menus (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  price numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menus_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX menus_branch_id_idx ON public.menus (branch_id);

CREATE TABLE public.menu_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  menu_id bigint NOT NULL REFERENCES public.menus (id) ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_items_menu_product_uq UNIQUE (menu_id, product_id)
);

CREATE INDEX menu_items_menu_id_idx ON public.menu_items (menu_id);
CREATE INDEX menu_items_product_id_idx ON public.menu_items (product_id);

-- -----------------------------------------------------------------------------
-- 3) Counters & orders
-- -----------------------------------------------------------------------------
CREATE TABLE public.daily_order_counters (
  branch_id bigint NOT NULL REFERENCES public.branches (id) ON DELETE CASCADE,
  pickup_date date NOT NULL,
  last_number integer NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  PRIMARY KEY (branch_id, pickup_date)
);

COMMENT ON TABLE public.daily_order_counters IS 'Per-branch per-day sequence for orders.order_number.';

CREATE TABLE public.orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  order_number integer NOT NULL CHECK (order_number > 0),
  customer_name text NOT NULL,
  pickup_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'not_picked_up')),
  source text NOT NULL DEFAULT 'qr'
    CHECK (source IN ('qr', 'staff', 'admin')),
  total_amount numeric(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  CONSTRAINT orders_customer_name_nonempty CHECK (length(trim(customer_name)) > 0),
  CONSTRAINT orders_branch_pickup_order_number_uq UNIQUE (branch_id, pickup_date, order_number)
);

CREATE INDEX orders_branch_pickup_idx ON public.orders (branch_id, pickup_date);
CREATE INDEX orders_branch_status_idx ON public.orders (branch_id, status);
CREATE INDEX orders_branch_created_idx ON public.orders (branch_id, created_at DESC);

CREATE TABLE public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  product_id bigint REFERENCES public.products (id) ON DELETE RESTRICT,
  menu_id bigint REFERENCES public.menus (id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  CONSTRAINT order_items_exactly_one_ref CHECK (
    ((product_id IS NOT NULL)::integer + (menu_id IS NOT NULL)::integer) = 1
  )
);

CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX order_items_product_id_idx ON public.order_items (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX order_items_menu_id_idx ON public.order_items (menu_id) WHERE menu_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4) Integrity triggers (branch alignment)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_menu_items_same_branch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  mb bigint;
  pb bigint;
BEGIN
  SELECT m.branch_id INTO mb FROM public.menus m WHERE m.id = NEW.menu_id;
  SELECT p.branch_id INTO pb FROM public.products p WHERE p.id = NEW.product_id;
  IF mb IS NULL THEN
    RAISE EXCEPTION 'menu % not found', NEW.menu_id;
  END IF;
  IF pb IS NULL THEN
    RAISE EXCEPTION 'product % not found', NEW.product_id;
  END IF;
  IF mb IS DISTINCT FROM pb THEN
    RAISE EXCEPTION 'menu_items: menu and product must belong to the same branch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER menu_items_same_branch
  BEFORE INSERT OR UPDATE OF menu_id, product_id ON public.menu_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_menu_items_same_branch();

CREATE OR REPLACE FUNCTION public.enforce_order_items_same_branch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ob bigint;
  pb bigint;
  mb bigint;
BEGIN
  SELECT o.branch_id INTO ob FROM public.orders o WHERE o.id = NEW.order_id;
  IF ob IS NULL THEN
    RAISE EXCEPTION 'order % not found', NEW.order_id;
  END IF;
  IF NEW.product_id IS NOT NULL THEN
    SELECT p.branch_id INTO pb FROM public.products p WHERE p.id = NEW.product_id;
    IF pb IS NULL THEN
      RAISE EXCEPTION 'product % not found', NEW.product_id;
    END IF;
    IF pb IS DISTINCT FROM ob THEN
      RAISE EXCEPTION 'order_items: product does not belong to order branch';
    END IF;
  END IF;
  IF NEW.menu_id IS NOT NULL THEN
    SELECT m.branch_id INTO mb FROM public.menus m WHERE m.id = NEW.menu_id;
    IF mb IS NULL THEN
      RAISE EXCEPTION 'menu % not found', NEW.menu_id;
    END IF;
    IF mb IS DISTINCT FROM ob THEN
      RAISE EXCEPTION 'order_items: menu does not belong to order branch';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_items_same_branch
  BEFORE INSERT OR UPDATE OF order_id, product_id, menu_id ON public.order_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_order_items_same_branch();

-- -----------------------------------------------------------------------------
-- 5) create_order — SECURITY DEFINER so EXECUTE-only roles need no table DML
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name text,
  p_pickup_date date,
  p_source text,
  p_items jsonb,
  p_total_amount numeric DEFAULT NULL,
  p_branch_id bigint DEFAULT NULL
)
RETURNS TABLE (order_id bigint, order_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_branch_id bigint;
  v_next_number integer;
  v_order_id bigint;
  v_item jsonb;
  v_pid bigint;
  v_mid bigint;
  v_qty integer;
  v_unit numeric(10, 2);
  v_line_total numeric(10, 2);
  v_sum numeric(10, 2) := 0;
  v_has_p boolean;
  v_has_m boolean;
  v_source text;
BEGIN
  v_branch_id := COALESCE(
    p_branch_id,
    (SELECT id FROM public.branches WHERE is_active = true ORDER BY id LIMIT 1)
  );
  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'No active branch configured';
  END IF;

  IF p_customer_name IS NULL OR length(trim(p_customer_name)) = 0 THEN
    RAISE EXCEPTION 'customer_name is required';
  END IF;
  IF p_pickup_date IS NULL THEN
    RAISE EXCEPTION 'pickup_date is required';
  END IF;

  v_source := lower(trim(COALESCE(p_source, '')));
  IF v_source = '' THEN
    v_source := 'qr';
  END IF;
  IF v_source NOT IN ('qr', 'staff', 'admin') THEN
    RAISE EXCEPTION 'invalid source (allowed: qr, staff, admin): %', p_source;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items must be a non-empty JSON array';
  END IF;

  FOR v_item IN SELECT elem FROM jsonb_array_elements(p_items) AS elem
  LOOP
    v_pid := CASE
      WHEN v_item ? 'product_id' AND jsonb_typeof(v_item->'product_id') <> 'null'
      THEN (v_item->>'product_id')::bigint
      ELSE NULL
    END;
    v_mid := CASE
      WHEN v_item ? 'menu_id' AND jsonb_typeof(v_item->'menu_id') <> 'null'
      THEN (v_item->>'menu_id')::bigint
      ELSE NULL
    END;
    v_has_p := v_pid IS NOT NULL;
    v_has_m := v_mid IS NOT NULL;
    IF v_has_p = v_has_m THEN
      RAISE EXCEPTION 'each item must have exactly one of product_id or menu_id';
    END IF;

    v_qty := COALESCE((v_item->>'quantity')::integer, 0);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid quantity';
    END IF;

    v_unit := round(COALESCE((v_item->>'unit_price')::numeric, 0), 2);
    IF v_unit < 0 THEN
      RAISE EXCEPTION 'invalid unit_price';
    END IF;

    IF v_has_p THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = v_pid AND p.branch_id = v_branch_id
          AND p.is_active = true AND p.archived_at IS NULL
      ) THEN
        RAISE EXCEPTION 'invalid or inactive product % for this branch', v_pid;
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.menus m
        WHERE m.id = v_mid AND m.branch_id = v_branch_id
          AND m.is_active = true AND m.archived_at IS NULL
      ) THEN
        RAISE EXCEPTION 'invalid or inactive menu % for this branch', v_mid;
      END IF;
    END IF;

    v_line_total := round(v_unit * v_qty, 2);
    v_sum := v_sum + v_line_total;
  END LOOP;

  v_sum := round(v_sum, 2);
  IF p_total_amount IS NOT NULL
     AND round(abs(v_sum - round(p_total_amount, 2)), 2) > 0.01 THEN
    RAISE EXCEPTION 'total_amount mismatch: computed % vs provided %', v_sum, p_total_amount;
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
    trim(p_customer_name),
    p_pickup_date,
    'pending',
    v_source,
    v_sum
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT elem FROM jsonb_array_elements(p_items) AS elem
  LOOP
    v_pid := CASE
      WHEN v_item ? 'product_id' AND jsonb_typeof(v_item->'product_id') <> 'null'
      THEN (v_item->>'product_id')::bigint
      ELSE NULL
    END;
    v_mid := CASE
      WHEN v_item ? 'menu_id' AND jsonb_typeof(v_item->'menu_id') <> 'null'
      THEN (v_item->>'menu_id')::bigint
      ELSE NULL
    END;
    v_qty := COALESCE((v_item->>'quantity')::integer, 0);
    v_unit := round(COALESCE((v_item->>'unit_price')::numeric, 0), 2);

    INSERT INTO public.order_items (order_id, product_id, menu_id, quantity, unit_price)
    VALUES (
      v_order_id,
      v_pid,
      v_mid,
      v_qty,
      v_unit
    );
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_next_number;
END;
$$;

COMMENT ON FUNCTION public.create_order(text, date, text, jsonb, numeric, bigint) IS
  'SECURITY DEFINER: creates order + lines; daily order_number per (branch_id, pickup_date). source in (qr, staff, admin).';

-- -----------------------------------------------------------------------------
-- 6) Permissions — table DML for service_role only; EXECUTE on create_order for RPC
-- (create_order is SECURITY DEFINER so anon/authenticated do not need table grants.)
-- Scoped to breakfast tables only (does not touch unrelated objects in public).
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.branches, public.products, public.menus, public.menu_items,
  public.daily_order_counters, public.orders, public.order_items FROM PUBLIC;
REVOKE ALL ON TABLE public.branches, public.products, public.menus, public.menu_items,
  public.daily_order_counters, public.orders, public.order_items FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO postgres, service_role, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.branches, public.products, public.menus,
  public.menu_items, public.daily_order_counters, public.orders, public.order_items TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT EXECUTE ON FUNCTION public.create_order(text, date, text, jsonb, numeric, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_order(text, date, text, jsonb, numeric, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.create_order(text, date, text, jsonb, numeric, bigint) TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- =============================================================================
-- === OPTIONAL SEED — comment out the block below to skip sample data =========
-- =============================================================================

INSERT INTO public.branches (name, slug, is_active)
VALUES ('AZUR Camping Regensburg (Test)', 'azur-regensburg-test', true);

WITH b AS (SELECT id AS branch_id FROM public.branches WHERE slug = 'azur-regensburg-test' LIMIT 1)
INSERT INTO public.products (branch_id, name, price, image_url, is_active, category)
SELECT
  b.branch_id, v.name, v.price, null, true, v.category
FROM b
CROSS JOIN (VALUES
  ('Knusperbrötchen', 0.50::numeric, 'backwaren'),
  ('Farmerbrötchen', 0.80::numeric, 'backwaren'),
  ('Laugenbrezel', 1.20::numeric, 'backwaren'),
  ('Buttercroissant', 1.50::numeric, 'backwaren'),
  ('Kaffee', 2.50::numeric, 'getraenke'),
  ('Cappuccino', 3.20::numeric, 'getraenke')
) AS v(name, price, category);

WITH b AS (SELECT id AS branch_id FROM public.branches WHERE slug = 'azur-regensburg-test' LIMIT 1)
INSERT INTO public.menus (branch_id, name, description, price, is_active)
SELECT
  b.branch_id,
  'Frühstücks-Set Classic',
  'Brötchen nach Wahl und Heißgetränk',
  6.90,
  true
FROM b;

INSERT INTO public.menu_items (menu_id, product_id, quantity)
SELECT m.id, p.id, 1
FROM public.menus m
JOIN public.products p ON p.branch_id = m.branch_id AND p.name IN ('Knusperbrötchen', 'Kaffee')
WHERE m.name = 'Frühstücks-Set Classic';

-- Second test tenant (isolation checks): Hannover — distinct product/menu names vs Regensburg above.
INSERT INTO public.branches (name, slug, is_active)
VALUES ('AZUR Camping Hannover (Test)', 'hannover', true);

WITH b AS (SELECT id AS branch_id FROM public.branches WHERE slug = 'hannover' LIMIT 1)
INSERT INTO public.products (branch_id, name, price, image_url, is_active, category)
SELECT
  b.branch_id, v.name, v.price, null, true, v.category
FROM b
CROSS JOIN (VALUES
  ('Vollkornbrötchen (Hannover)', 0.55::numeric, 'backwaren'),
  ('Nordstadt Sesamring', 0.95::numeric, 'backwaren'),
  ('Apfel-Zimt-Taler', 1.35::numeric, 'backwaren'),
  ('Herrenhäuser Kaffee', 2.60::numeric, 'getraenke'),
  ('Kakao (Hannover)', 2.90::numeric, 'getraenke'),
  ('Orangensaft klein', 2.20::numeric, 'getraenke')
) AS v(name, price, category);

WITH b AS (SELECT id AS branch_id FROM public.branches WHERE slug = 'hannover' LIMIT 1)
INSERT INTO public.menus (branch_id, name, description, price, is_active)
SELECT
  b.branch_id,
  'Hannover Morgen-Set (Test)',
  'Typisch Hannover: süß + Kakao — nur in diesem Test-Standort sichtbar.',
  7.40,
  true
FROM b;

INSERT INTO public.menu_items (menu_id, product_id, quantity)
SELECT m.id, p.id, 1
FROM public.menus m
JOIN public.products p ON p.branch_id = m.branch_id AND p.name IN ('Apfel-Zimt-Taler', 'Kakao (Hannover)')
WHERE m.name = 'Hannover Morgen-Set (Test)';

-- =============================================================================
-- === END OPTIONAL SEED =======================================================
-- =============================================================================

COMMIT;
