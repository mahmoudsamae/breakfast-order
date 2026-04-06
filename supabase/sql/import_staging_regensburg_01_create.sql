-- -----------------------------------------------------------------------------
-- Staging: ALL columns are TEXT so Supabase CSV import never type-checks cells.
-- Legacy exports often contain "", "NULL", quoted nulls — those are not valid for
-- bigint / timestamptz at import time.
--
-- import_staging.clean_csv_cell() normalizes values during promote (02_promote.sql).
-- Run this whole file to DROP and recreate import_staging (staging data is wiped).
-- Import CSVs into import_staging.* only — never into public.* from the UI.
-- -----------------------------------------------------------------------------

DROP SCHEMA IF EXISTS import_staging CASCADE;

CREATE SCHEMA import_staging;

COMMENT ON SCHEMA import_staging IS 'CSV staging: every column text; normalize in promote via clean_csv_cell().';

-- Normalizes: NULL, '', whitespace, literal "null" / NULL (any case), optional "..." quotes.
CREATE OR REPLACE FUNCTION import_staging.clean_csv_cell(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
BEGIN
  IF input IS NULL THEN
    RETURN NULL;
  END IF;
  v := trim(input);
  IF length(v) >= 2 AND substring(v, 1, 1) = '"' AND substring(v, length(v), 1) = '"' THEN
    v := trim(substring(v, 2, length(v) - 2));
  END IF;
  IF v = '' OR lower(v) = 'null' THEN
    RETURN NULL;
  END IF;
  RETURN v;
END;
$$;

COMMENT ON FUNCTION import_staging.clean_csv_cell(text) IS 'CSV cell → NULL if empty/NULL-ish; else trimmed string for ::bigint/::timestamptz/::date casts.';

-- Every column TEXT (including ids / FKs) — Table Editor import is always valid.
CREATE TABLE import_staging.products (
  id text NOT NULL,
  branch_id text,
  name text NOT NULL,
  price text,
  image_url text,
  is_active text,
  archived_at text,
  created_at text,
  category text,
  CONSTRAINT import_staging_products_pkey PRIMARY KEY (id)
);

CREATE TABLE import_staging.menus (
  id text NOT NULL,
  branch_id text,
  name text NOT NULL,
  description text,
  price text,
  image_url text,
  is_active text,
  archived_at text,
  created_at text,
  CONSTRAINT import_staging_menus_pkey PRIMARY KEY (id)
);

CREATE TABLE import_staging.menu_items (
  id text NOT NULL,
  menu_id text NOT NULL,
  product_id text NOT NULL,
  quantity text,
  created_at text,
  CONSTRAINT import_staging_menu_items_pkey PRIMARY KEY (id)
);

CREATE TABLE import_staging.orders (
  id text NOT NULL,
  branch_id text,
  order_number text NOT NULL,
  customer_name text NOT NULL,
  pickup_date text NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  total_amount text,
  created_at text,
  delivered_at text,
  CONSTRAINT import_staging_orders_pkey PRIMARY KEY (id)
);

CREATE TABLE import_staging.order_items (
  id text NOT NULL,
  order_id text NOT NULL,
  product_id text,
  menu_id text,
  quantity text,
  unit_price text,
  CONSTRAINT import_staging_order_items_pkey PRIMARY KEY (id)
);

CREATE TABLE import_staging.daily_order_counters (
  branch_id text NOT NULL,
  pickup_date text NOT NULL,
  last_number text,
  CONSTRAINT import_staging_daily_order_counters_pkey PRIMARY KEY (branch_id, pickup_date)
);
