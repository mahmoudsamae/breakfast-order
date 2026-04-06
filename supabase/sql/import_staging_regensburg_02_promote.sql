-- -----------------------------------------------------------------------------
-- Promote import_staging -> public for Regensburg.
-- - Resolves branch_id once from public.branches (slug='regensburg') and reuses it.
-- - Does NOT trust staging.branch_id.
-- - Uses legacy IDs only for mapping old->new IDs (public IDs remain generated).
-- - Safe for multi-branch: all inserted branch-scoped rows use resolved v_branch_id.
-- -----------------------------------------------------------------------------

BEGIN;

CREATE TEMP TABLE _map_products (old_id bigint PRIMARY KEY, new_id bigint NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE _map_menus (old_id bigint PRIMARY KEY, new_id bigint NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE _map_orders (old_id bigint PRIMARY KEY, new_id bigint NOT NULL) ON COMMIT DROP;

DO $$
DECLARE
  v_branch_id bigint;
  r record;
  v_old_id bigint;
  v_new_id bigint;
  v_menu_new_id bigint;
  v_product_new_id bigint;
  v_order_new_id bigint;
BEGIN
  SELECT b.id
    INTO v_branch_id
  FROM public.branches b
  WHERE lower(b.slug) = lower('regensburg')
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Branch slug "regensburg" not found in public.branches';
  END IF;

  -- products
  FOR r IN
    SELECT *
    FROM import_staging.products
    WHERE import_staging.clean_csv_cell(id) IS NOT NULL
    ORDER BY import_staging.clean_csv_cell(id)::bigint
  LOOP
    v_old_id := import_staging.clean_csv_cell(r.id)::bigint;

    INSERT INTO public.products (
      branch_id,
      name,
      price,
      image_url,
      is_active,
      archived_at,
      created_at,
      category
    )
    VALUES (
      v_branch_id,
      COALESCE(import_staging.clean_csv_cell(r.name), '(product)'),
      COALESCE(import_staging.clean_csv_cell(r.price)::numeric(10, 2), 0),
      import_staging.clean_csv_cell(r.image_url),
      CASE
        WHEN import_staging.clean_csv_cell(r.is_active) IS NULL THEN true
        WHEN lower(import_staging.clean_csv_cell(r.is_active)) IN ('t', 'true', '1', 'yes') THEN true
        WHEN lower(import_staging.clean_csv_cell(r.is_active)) IN ('f', 'false', '0', 'no') THEN false
        ELSE true
      END,
      import_staging.clean_csv_cell(r.archived_at)::timestamptz,
      COALESCE(import_staging.clean_csv_cell(r.created_at)::timestamptz, now()),
      CASE
        WHEN lower(COALESCE(import_staging.clean_csv_cell(r.category), '')) IN ('backwaren', 'getraenke', 'extras')
          THEN lower(import_staging.clean_csv_cell(r.category))
        ELSE 'backwaren'
      END
    )
    RETURNING id INTO v_new_id;

    INSERT INTO _map_products (old_id, new_id) VALUES (v_old_id, v_new_id);
  END LOOP;

  -- menus
  FOR r IN
    SELECT *
    FROM import_staging.menus
    WHERE import_staging.clean_csv_cell(id) IS NOT NULL
    ORDER BY import_staging.clean_csv_cell(id)::bigint
  LOOP
    v_old_id := import_staging.clean_csv_cell(r.id)::bigint;

    INSERT INTO public.menus (
      branch_id,
      name,
      description,
      price,
      image_url,
      is_active,
      archived_at,
      created_at
    )
    VALUES (
      v_branch_id,
      COALESCE(import_staging.clean_csv_cell(r.name), '(menu)'),
      import_staging.clean_csv_cell(r.description),
      COALESCE(import_staging.clean_csv_cell(r.price)::numeric(10, 2), 0),
      import_staging.clean_csv_cell(r.image_url),
      CASE
        WHEN import_staging.clean_csv_cell(r.is_active) IS NULL THEN true
        WHEN lower(import_staging.clean_csv_cell(r.is_active)) IN ('t', 'true', '1', 'yes') THEN true
        WHEN lower(import_staging.clean_csv_cell(r.is_active)) IN ('f', 'false', '0', 'no') THEN false
        ELSE true
      END,
      import_staging.clean_csv_cell(r.archived_at)::timestamptz,
      COALESCE(import_staging.clean_csv_cell(r.created_at)::timestamptz, now())
    )
    RETURNING id INTO v_new_id;

    INSERT INTO _map_menus (old_id, new_id) VALUES (v_old_id, v_new_id);
  END LOOP;

  -- menu_items (mapped menu/product ids)
  FOR r IN
    SELECT *
    FROM import_staging.menu_items
    WHERE import_staging.clean_csv_cell(id) IS NOT NULL
      AND import_staging.clean_csv_cell(menu_id) IS NOT NULL
      AND import_staging.clean_csv_cell(product_id) IS NOT NULL
    ORDER BY import_staging.clean_csv_cell(id)::bigint
  LOOP
    SELECT m.new_id INTO v_menu_new_id
    FROM _map_menus m
    WHERE m.old_id = import_staging.clean_csv_cell(r.menu_id)::bigint;

    SELECT p.new_id INTO v_product_new_id
    FROM _map_products p
    WHERE p.old_id = import_staging.clean_csv_cell(r.product_id)::bigint;

    IF v_menu_new_id IS NULL OR v_product_new_id IS NULL THEN
      RAISE EXCEPTION 'menu_items mapping missing for old menu_id=% old product_id=%',
        import_staging.clean_csv_cell(r.menu_id), import_staging.clean_csv_cell(r.product_id);
    END IF;

    INSERT INTO public.menu_items (menu_id, product_id, quantity, created_at)
    VALUES (
      v_menu_new_id,
      v_product_new_id,
      GREATEST(1, COALESCE(import_staging.clean_csv_cell(r.quantity)::integer, 1)),
      COALESCE(import_staging.clean_csv_cell(r.created_at)::timestamptz, now())
    )
    ON CONFLICT (menu_id, product_id) DO NOTHING;
  END LOOP;

  -- orders
  FOR r IN
    SELECT *
    FROM import_staging.orders
    WHERE import_staging.clean_csv_cell(id) IS NOT NULL
    ORDER BY import_staging.clean_csv_cell(id)::bigint
  LOOP
    v_old_id := import_staging.clean_csv_cell(r.id)::bigint;

    INSERT INTO public.orders (
      branch_id,
      order_number,
      customer_name,
      pickup_date,
      status,
      source,
      total_amount,
      created_at,
      delivered_at
    )
    VALUES (
      v_branch_id,
      GREATEST(1, COALESCE(import_staging.clean_csv_cell(r.order_number)::integer, 1)),
      COALESCE(import_staging.clean_csv_cell(r.customer_name), '(customer)'),
      COALESCE(import_staging.clean_csv_cell(r.pickup_date)::date, CURRENT_DATE),
      CASE
        WHEN lower(COALESCE(import_staging.clean_csv_cell(r.status), '')) IN ('pending', 'delivered', 'not_picked_up')
          THEN lower(import_staging.clean_csv_cell(r.status))
        ELSE 'pending'
      END,
      CASE
        WHEN lower(COALESCE(import_staging.clean_csv_cell(r.source), '')) IN ('qr', 'staff', 'admin')
          THEN lower(import_staging.clean_csv_cell(r.source))
        ELSE 'qr'
      END,
      COALESCE(import_staging.clean_csv_cell(r.total_amount)::numeric(10, 2), 0),
      COALESCE(import_staging.clean_csv_cell(r.created_at)::timestamptz, now()),
      import_staging.clean_csv_cell(r.delivered_at)::timestamptz
    )
    RETURNING id INTO v_new_id;

    INSERT INTO _map_orders (old_id, new_id) VALUES (v_old_id, v_new_id);
  END LOOP;

  -- order_items (mapped order/product/menu ids)
  FOR r IN
    SELECT *
    FROM import_staging.order_items
    WHERE import_staging.clean_csv_cell(id) IS NOT NULL
      AND import_staging.clean_csv_cell(order_id) IS NOT NULL
    ORDER BY import_staging.clean_csv_cell(id)::bigint
  LOOP
    SELECT o.new_id INTO v_order_new_id
    FROM _map_orders o
    WHERE o.old_id = import_staging.clean_csv_cell(r.order_id)::bigint;

    IF v_order_new_id IS NULL THEN
      RAISE EXCEPTION 'order_items mapping missing for old order_id=%', import_staging.clean_csv_cell(r.order_id);
    END IF;

    v_product_new_id := NULL;
    v_menu_new_id := NULL;

    IF import_staging.clean_csv_cell(r.product_id) IS NOT NULL THEN
      SELECT p.new_id INTO v_product_new_id
      FROM _map_products p
      WHERE p.old_id = import_staging.clean_csv_cell(r.product_id)::bigint;
    END IF;

    IF import_staging.clean_csv_cell(r.menu_id) IS NOT NULL THEN
      SELECT m.new_id INTO v_menu_new_id
      FROM _map_menus m
      WHERE m.old_id = import_staging.clean_csv_cell(r.menu_id)::bigint;
    END IF;

    -- Must reference exactly one line item type.
    IF (v_product_new_id IS NULL AND v_menu_new_id IS NULL) OR (v_product_new_id IS NOT NULL AND v_menu_new_id IS NOT NULL) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.order_items (order_id, product_id, menu_id, quantity, unit_price)
    VALUES (
      v_order_new_id,
      v_product_new_id,
      v_menu_new_id,
      GREATEST(1, COALESCE(import_staging.clean_csv_cell(r.quantity)::integer, 1)),
      COALESCE(import_staging.clean_csv_cell(r.unit_price)::numeric(10, 2), 0)
    );
  END LOOP;

  -- daily_order_counters: always assign resolved branch_id, never staging branch_id
  INSERT INTO public.daily_order_counters (branch_id, pickup_date, last_number)
  SELECT
    v_branch_id,
    import_staging.clean_csv_cell(s.pickup_date)::date,
    GREATEST(0, COALESCE(import_staging.clean_csv_cell(s.last_number)::integer, 0))
  FROM import_staging.daily_order_counters s
  WHERE import_staging.clean_csv_cell(s.pickup_date) IS NOT NULL
  ON CONFLICT (branch_id, pickup_date) DO UPDATE
  SET last_number = GREATEST(public.daily_order_counters.last_number, EXCLUDED.last_number);
END $$;

COMMIT;
