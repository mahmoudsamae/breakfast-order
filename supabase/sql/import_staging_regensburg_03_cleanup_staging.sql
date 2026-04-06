-- -----------------------------------------------------------------------------
-- Remove data from staging tables after a successful promote (schema kept).
-- Safe: does not touch public.* or other branches.
-- -----------------------------------------------------------------------------

TRUNCATE TABLE
  import_staging.order_items,
  import_staging.menu_items,
  import_staging.orders,
  import_staging.daily_order_counters,
  import_staging.menus,
  import_staging.products;

-- If you want to drop the whole staging schema later (optional):
-- DROP SCHEMA IF EXISTS import_staging CASCADE;
