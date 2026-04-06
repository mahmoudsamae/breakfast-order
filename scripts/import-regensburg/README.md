# Regensburg breakfast data — read-only import (old DB → new DB)

This process **only reads** from the legacy database and **writes** to the new multi-branch database.  
The old database is never modified, deleted, or altered.

**Which path to use**

| Situation | Use |
|-----------|-----|
| Your machine can connect to **both** OLD and NEW reliably | `import-breakfast-data.mjs` (live SELECT on OLD → INSERT on NEW). |
| **OLD** times out or refuses from your network (common with Supabase + strict networks) | **CSV export from OLD** (Dashboard or any host that can reach OLD), then `import-from-export.mjs` — connects **only to NEW**. |

## A) Import plan

1. **Connection model**
   - **OLD**: PostgreSQL connection string with a user that has **SELECT** only (recommended: read-only role on the old instance).
   - **NEW**: Connection string with permission to **INSERT** into `products`, `menus`, `menu_items`, `orders`, `order_items`, `daily_order_counters` (e.g. Supabase **service role** or a migration user).

2. **Branch targeting**
   - All copied rows are attached to the existing **Regensburg** branch: `branches.id` resolved by `slug` (default `regensburg`, configurable).

3. **ID strategy (recommended: mapping, not preserving old IDs)**
   - **Do not** `INSERT … OVERRIDING SYSTEM VALUE` by default.
   - Insert catalog and orders **without** primary keys; build **old_id → new_id** maps in memory for `products`, `menus`, `orders`.
   - Remap foreign keys in `menu_items` and `order_items` to the **new** IDs.
   - **Why**: avoids collisions with demo/test rows or Hannover data already in NEW; keeps `GENERATED … AS IDENTITY` sequences consistent.

4. **Optional: preserve old numeric IDs** (advanced, only if NEW is empty / isolated)
   - Possible only if you guarantee **no PK overlap** on each table in NEW. Requires `INSERT … OVERRIDING SYSTEM VALUE` and manual `setval()` on identity sequences afterward.  
   - The provided script uses **mapping** by default.

5. **Conflicts with existing Regensburg data in NEW**
   - Running a second import without clearing would **duplicate** catalog and can break uniqueness (`orders` per branch/day/number).
   - **Recommended**: use `--clear-regensburg` once (see script) to remove **only** rows for Regensburg’s `branch_id` in NEW (in FK-safe order). This touches **only the new DB**, never the old one.
   - **Alternative**: import into a **new** branch row (new slug) if you must keep existing Regensburg demo rows — then adjust `REGENSBURG_SLUG` / create branch first.

6. **Old schema variance**
   - If the old DB has **no** `branch_id` (single-tenant), the script reads all rows from the listed tables.
   - If `products.category` is missing, rows are inserted with `'backwaren'`.
   - If `orders.status` lacks `not_picked_up`, values are mapped to the new check constraint.
   - If `menu_items` is missing in the old DB, that step is skipped.

7. **Repeatability**
   - Same command with `--clear-regensburg` + same OLD snapshot → deterministic outcome on NEW.
   - Use **dry-run** to validate counts without writing.

---

## B) Files

| File | Purpose |
|------|---------|
| `scripts/import-regensburg/README.md` | This plan + verification |
| `scripts/import-regensburg/import-breakfast-data.mjs` | Live import (OLD + NEW) |
| `scripts/import-regensburg/import-from-export.mjs` | Import from CSV files in `export/` (NEW only) |
| `scripts/import-regensburg/export/README.md` | How to export the six tables from OLD |
| `scripts/import-regensburg/env.import.example` | Copy to `env.import` (gitignored) |

---

## C) How the old DB stays untouched

- Only **`SELECT`** (and optional `BEGIN READ ONLY` / read-only transaction) on OLD.
- No `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER`, or DDL on OLD.
- Use a **read-only** database role for OLD in production.

---

## D) How the new DB is populated

1. Resolve `branch_id` for Regensburg.
2. Optionally **delete** existing data for that branch only in NEW (`--clear-regensburg`).
3. Copy **products** → map IDs.
4. Copy **menus** → map IDs.
5. Copy **menu_items** with remapped `menu_id` / `product_id`.
6. Copy **orders** with `branch_id` set → map IDs.
7. Copy **order_items** with remapped `order_id`, `product_id`, `menu_id`.
8. Copy **daily_order_counters** with `branch_id` set.

All writes run in a **single transaction** on NEW (commit on success, rollback on error).

---

## E) Verification checklist (after import)

- [ ] Row counts: compare OLD vs NEW (per table, accounting for branch filter on NEW).
- [ ] `SELECT COUNT(*) FROM orders WHERE branch_id = <regensburg>` matches old `orders` count.
- [ ] Spot-check: order totals, a few `order_items` lines, menu composition.
- [ ] Uniqueness: `orders (branch_id, pickup_date, order_number)` has no duplicates.
- [ ] `daily_order_counters`: for each `pickup_date`, `last_number` ≥ max `order_number` that day for that branch (or matches legacy semantics).
- [ ] App: open `/b/regensburg/order` (or your slug) and confirm catalog + staff order list looks correct.
- [ ] Confirm OLD DB still unchanged (re-run row counts on OLD; compare to a pre-import snapshot if you took one).

---

## F) CSV export + `import-from-export.mjs` (when OLD is unreachable locally)

Use this for **small** datasets (your case: ~2 days of data). It avoids any runtime connection to OLD from your PC.

1. In the **OLD** Supabase project, open **Table Editor** and export each required table as **CSV** (see `export/README.md` for exact filenames).
2. Copy the six files into `scripts/import-regensburg/export/`.
3. In `env.import`, set **`NEW_DATABASE_URL`** and **`REGENSBURG_SLUG`** (and optionally leave `OLD_DATABASE_URL` unset — it is ignored).
4. Run:

```bash
node scripts/import-regensburg/import-from-export.mjs --dry-run
node scripts/import-regensburg/import-from-export.mjs --clear-regensburg
```

Semantics match the live importer: ID mapping, Regensburg `branch_id`, optional `--clear-regensburg`, single transaction on NEW. Requires dev dependency **`csv-parse`** (`npm install`).

---

## Connection URLs (Supabase & legacy)

This script runs **one long transaction** on NEW (many statements, then commit). Use a connection mode that supports that.

| Mode | Typical port | Use with this importer |
|------|----------------|-------------------------|
| **Direct** (database host `db.<project>.supabase.co`) | **5432** | **Recommended** — full PostgreSQL features, best for long transactions. |
| **Session pooler** (pooler host, session mode) | **5432** | **OK** — behaves like a normal session for most workloads; use if direct is blocked. |
| **Transaction pooler** (often `…:6543` or `pgbouncer=true`) | **6543** | **Avoid** for NEW — transaction pooling can break or degrade long multi-statement transactions. The script prints a warning if the URL looks like transaction mode. |

**OLD_DATABASE_URL** — use whatever reaches your legacy server (local Postgres, LAN, or cloud). For **localhost**, the script does not force SSL. For a remote OLD server that requires TLS, put `sslmode=require` in the URL (or rely on host detection: remote non-localhost gets `sslmode=require` appended when missing). To force **no** SSL for an unusual setup, set `PGSSLMODE=disable` or `OLD_PGSSLMODE=disable` in `env.import`.

**NEW_DATABASE_URL** — copy the **URI** from Supabase **Project Settings → Database** (password from the same page). Prefer **Direct** or **Session** on **port 5432**. Ensure the string includes `sslmode=require` or let the script append it for non-localhost hosts.

**IPv6 / ECONNREFUSED** — if your network resolves the Supabase hostname to IPv6 but your route/firewall only allows IPv4, you can get refused or odd timeouts. This script calls `dns.setDefaultResultOrder("ipv4first")` so Node prefers **IPv4** when both address families exist. If problems persist, check Supabase **Network restrictions**, **IPv4 add-on** if applicable, VPN/firewall rules, and that the host/port match the dashboard.

Optional `env.import` keys:

- `PG_CONNECT_TIMEOUT_MS` — connection timeout (default 60000).
- `SUPABASE_SSL_STRICT=1` — verify server TLS certificate strictly (`rejectUnauthorized: true`).
- `PGSSLMODE=disable` or `OLD_PGSSLMODE=disable` / `NEW_PGSSLMODE=disable` — disable SSL for that side (e.g. local OLD only).

---

## Run

```bash
cd "path/to/Frühstück_Bestellen - Kopie"
npm install
# Create scripts/import-regensburg/env.import from env.import.example

# Live OLD → NEW (needs stable OLD_DATABASE_URL):
node scripts/import-regensburg/import-breakfast-data.mjs --dry-run
node scripts/import-regensburg/import-breakfast-data.mjs --clear-regensburg

# CSV files in export/ → NEW only (needs NEW_DATABASE_URL; see section F):
node scripts/import-regensburg/import-from-export.mjs --dry-run
node scripts/import-regensburg/import-from-export.mjs --clear-regensburg
```

Environment file: for live import, set `OLD_DATABASE_URL` and `NEW_DATABASE_URL`. For CSV import, **`NEW_DATABASE_URL`** (and `REGENSBURG_SLUG`) only. Optional `EXPORT_DIR` if CSVs are not in `scripts/import-regensburg/export/`.
