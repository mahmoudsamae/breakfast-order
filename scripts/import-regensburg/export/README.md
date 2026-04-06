# CSV exports from OLD Supabase (read-only)

Place **six** CSV files here with **exact** names:

| File | Table |
|------|--------|
| `products.csv` | `public.products` |
| `menus.csv` | `public.menus` |
| `menu_items.csv` | `public.menu_items` |
| `orders.csv` | `public.orders` |
| `order_items.csv` | `public.order_items` |
| `daily_order_counters.csv` | `public.daily_order_counters` |

Exports must include a **header row** (column names). Data is read-only from OLD; nothing in this folder is written back to OLD.

If the legacy database has **`branch_id`** and multiple branches, export **only Regensburg rows** (filter in SQL or Table Editor) so you do not import another tenant’s data.

## Recommended export method (most reliable if your PC cannot reach OLD)

Use the **OLD** Supabase project in the browser (runs against the database from Supabase’s side, not your network):

1. Open **Table Editor** for the OLD project.
2. Open each table above.
3. Use **Export** → **CSV** (or equivalent). Save/download.
4. Rename files to match the table names above and copy them into this `export/` folder.

If a table is empty, still provide a CSV with **headers only** (or one header line) so the file exists.

## Alternative: one-off `pg_dump` / `psql` from a working network

If you can run Postgres client tools from **any** machine or CI that **can** reach OLD (VPN, cloud shell, colleague’s network):

```bash
# Example: data-only custom format, then extract — or use CSV COPY per table.
# Simplest for small data: export CSV from Dashboard as above.
```

## After exports are in place

From the repo root:

```bash
node scripts/import-regensburg/import-from-export.mjs --dry-run
node scripts/import-regensburg/import-from-export.mjs --clear-regensburg
```

`NEW_DATABASE_URL` and `REGENSBURG_SLUG` go in `scripts/import-regensburg/env.import`.  
`OLD_DATABASE_URL` is **not** required for this path.

Optional: `EXPORT_DIR` if you keep CSVs elsewhere (absolute or relative path).
