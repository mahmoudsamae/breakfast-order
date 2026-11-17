-- Indexes for the Verwaltung summary window and the team day list.
-- Not applied by the app. Run it in Supabase when you are ready.

CREATE INDEX IF NOT EXISTS order_items_order_id_idx
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS menu_items_menu_id_idx
  ON public.menu_items (menu_id);

CREATE INDEX IF NOT EXISTS orders_branch_created_idx
  ON public.orders (branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_branch_pickup_status_idx
  ON public.orders (branch_id, pickup_date, status);

CREATE INDEX IF NOT EXISTS orders_branch_pickup_visible_done_idx
  ON public.orders (branch_id, pickup_date)
  WHERE staff_hidden_at IS NULL
    AND status IN ('delivered', 'not_picked_up');
