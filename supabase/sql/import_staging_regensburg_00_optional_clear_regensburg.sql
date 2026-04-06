-- -----------------------------------------------------------------------------
-- OPTIONAL: delete existing Regensburg rows in NEW before re-import
-- Run ONLY if you must replace catalog/orders for this branch (avoids unique violations).
-- Does NOT touch other branches.
-- Replace 'regensburg' if your slug differs.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_branch bigint;
BEGIN
  SELECT b.id
  INTO v_branch
  FROM public.branches b
  WHERE lower(b.slug) = lower('regensburg');

  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'Branch slug regensburg not found';
  END IF;

  DELETE FROM public.order_items oi
  WHERE oi.order_id IN (SELECT o.id FROM public.orders o WHERE o.branch_id = v_branch);

  DELETE FROM public.orders WHERE branch_id = v_branch;

  DELETE FROM public.menu_items mi
  WHERE mi.menu_id IN (SELECT m.id FROM public.menus m WHERE m.branch_id = v_branch);

  DELETE FROM public.menus WHERE branch_id = v_branch;

  DELETE FROM public.products WHERE branch_id = v_branch;

  DELETE FROM public.daily_order_counters WHERE branch_id = v_branch;

  RAISE NOTICE 'Cleared public data for branch_id=% (Regensburg only).', v_branch;
END $$;
