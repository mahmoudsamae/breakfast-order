# Supabase-only import (staging → Regensburg)

Use this when **local PostgreSQL connections fail** (ETIMEDOUT / ECONNREFUSED). Everything runs in the **Supabase SQL Editor** and **Table Editor** for the **NEW** project.

---

## Troubleshooting: `GENERATED ALWAYS`, `22P02` (bigint), `22007` (timestamptz)

- **`GENERATED ALWAYS` on `id`**: CSV was imported into **`public.*`**, not **`import_staging.*`** — use schema **`import_staging`** in Table Editor.
- **`invalid input syntax for type bigint: '"NULL"'`** / **empty timestamp**: Staging must store **all** values as **`text`** (including **`id`** and FK columns). Run **`import_staging_regensburg_01_create.sql`** and re-import. Promotion uses **`import_staging.clean_csv_cell()`** then casts to **`bigint` / `timestamptz` / …**.

---

## A) Create or recreate staging tables

1. Open **Supabase** → your **NEW** project.
2. **SQL Editor** → New query.
3. Paste and run the **entire** file:

**`supabase/sql/import_staging_regensburg_01_create.sql`**

This **`DROP SCHEMA IF EXISTS import_staging CASCADE`** and recreates:

- **`import_staging.clean_csv_cell(text)`** — turns **`""`**, **`NULL`**, **`"NULL"`** (quoted) into SQL **`NULL`**; otherwise returns trimmed text for casting.
- **Every column on every staging table is `text`** (including **`id`**, **`menu_id`**, **`product_id`**, **`order_id`**) so the Table Editor never rejects legacy cells.
- **`daily_order_counters`**: **`PRIMARY KEY (branch_id, pickup_date)`** as **text**; **`public`** still gets Regensburg **`branch_id`** from **`branches`** on promote.

---

## B) Upload CSV files (Supabase UI)

1. **Table Editor** → schema **`import_staging`** (not **`public`**).
2. Import each file; **do not remove** **`id`** or timestamp columns from the CSV.

| Staging table (`import_staging`) | CSV file | Notes |
|----------------------------------|----------|--------|
| `products` | `products.csv` | All legacy columns including **`id`**, **`created_at`**, **`archived_at`** |
| `menus` | `menus.csv` | Same |
| `menu_items` | `menu_items.csv` | **`id`**, **`created_at`** |
| `orders` | `orders.csv` | **`id`**, **`created_at`**, **`delivered_at`** |
| `order_items` | `order_items.csv` | **`id`** |
| `daily_order_counters` | `daily_order_counters.csv` | **`branch_id`**, **`pickup_date`**, **`last_number`** |

3. On **promote**, **`branch_id`** on products/menus/orders/counters in **`public`** is set from **`branches.slug = 'regensburg'`**. Staging still holds the **legacy** `branch_id` values for reference; counters use legacy `(branch_id, pickup_date)` as the staging primary key.

4. **`order_items`**: Rows where **both** `product_id` and `menu_id` clean to **`NULL`**, or **both** non-null, are **skipped** (must match **`public.order_items`** check: exactly one line type).

5. **`public`** uses **`COALESCE(clean(created_at), now())`** where a **`NOT NULL`** timestamp is required.

---

## C) Move data into production tables

1. Optional: **`import_staging_regensburg_00_optional_clear_regensburg.sql`** if you must replace existing Regensburg rows.

2. Run **`import_staging_regensburg_02_promote.sql`**

   This inserts into **`public`** with **`OVERRIDING SYSTEM VALUE`** so **legacy `id` values** are preserved on identity columns, then **`setval`** updates sequences to **`MAX(id)`** per table.

3. Edit **`'regensburg'`** in **`00`** / **`02`** if your slug differs.

---

## D) Clean staging after success

**`import_staging_regensburg_03_cleanup_staging.sql`** — truncates staging tables. Optional: **`DROP SCHEMA import_staging CASCADE`** (comment in file).

---

## E) Verify success

See previous verification queries on **`public`** for the Regensburg branch. Compare **`id`** and timestamps to your CSVs as needed.

---

## Safety notes

- **ID collisions**: If **`public`** already contains the **same numeric `id`** in `products` / `menus` / … as your legacy rows (e.g. another branch), the insert can fail. Clear Regensburg only (**`00`**) or resolve conflicts before promoting.
- **Triggers**: Same-branch rules are satisfied because all promoted rows use the same Regensburg **`branch_id`**.
