/**
 * Import breakfast data from CSV files (exported from OLD Supabase) into NEW only.
 * - Does not connect to OLD — place exports under scripts/import-regensburg/export/
 * - COPY semantics: inserts into NEW; OLD is never touched.
 *
 * Usage:
 *   node scripts/import-regensburg/import-from-export.mjs [--dry-run] [--clear-regensburg]
 *
 * Env: scripts/import-regensburg/env.import — needs NEW_DATABASE_URL (and REGENSBURG_SLUG).
 * Optional: EXPORT_DIR=absolute-or-relative path (default: scripts/import-regensburg/export)
 */

import dns from "node:dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import pg from "pg";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function maskConnectionUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "(could not parse URL)";
  }
}

function isLocalHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function buildPgClientConfig(connectionString, roleLabel) {
  let url = String(connectionString || "").trim();
  if (!url) throw new Error(`Empty connection string for ${roleLabel}`);

  let hostname = "";
  let port = "";
  try {
    const u = new URL(url);
    hostname = u.hostname;
    port = u.port || (u.protocol === "postgresql:" || u.protocol === "postgres:" ? "5432" : "");
  } catch {
    throw new Error(`${roleLabel}: invalid connection URL`);
  }

  const local = isLocalHost(hostname);
  const sslDisabledByEnv = process.env.PGSSLMODE === "disable" || process.env[`${roleLabel}_PGSSLMODE`] === "disable";

  if (!local && !sslDisabledByEnv && !/[?&]sslmode=/i.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "sslmode=require";
  }

  const useSsl = !local && !sslDisabledByEnv;

  const isPooler6543 = port === "6543" || url.includes(":6543/");
  const isTransactionPooler = isPooler6543 || /[?&]pgbouncer=true/i.test(url);

  if (isTransactionPooler) {
    console.warn(
      `[WARN] ${roleLabel}: URL looks like transaction pooler (port 6543 and/or pgbouncer=true). ` +
        "Prefer Session pooler or Direct on port 5432 for long transactions."
    );
  }

  const config = {
    connectionString: url,
    application_name: "breakfast-import-from-csv",
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 60000),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  };

  if (useSsl) {
    config.ssl = {
      rejectUnauthorized: process.env.SUPABASE_SSL_STRICT === "1"
    };
  }

  console.log(`[config] ${roleLabel}: ${maskConnectionUrl(url)}`);
  if (useSsl) {
    console.log(
      `[config] ${roleLabel}: TLS (rejectUnauthorized=${config.ssl.rejectUnauthorized}; SUPABASE_SSL_STRICT=1 for strict verify)`
    );
  }

  return config;
}

async function connectNew(pgModule, config) {
  const client = new pgModule.Client(config);
  console.log("\nConnecting NEW database (import target) (NEW_DATABASE_URL) …");
  try {
    await client.connect();
    console.log("[OK] NEW database — connected successfully.");
    return client;
  } catch (err) {
    console.error("\n[FAIL] NEW database (import target) (NEW_DATABASE_URL)");
    console.error(`  ${err.code || err.name || "Error"}: ${err.message}`);
    throw err;
  }
}

function loadEnvFile() {
  const p = path.join(__dirname, "env.import");
  if (!fs.existsSync(p)) {
    console.error("Missing scripts/import-regensburg/env.import — copy from env.import.example");
    process.exit(1);
  }
  const raw = fs.readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

function getCell(row, col) {
  if (!row || typeof row !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(row, col)) return row[col];
  const lc = col.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === lc) return row[k];
  }
  return undefined;
}

function emptyToNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === "" || s === "\\N") return null;
  return v;
}

function parseBool(v, defaultVal = true) {
  if (v === "" || v === undefined || v === null) return defaultVal;
  const s = String(v).toLowerCase().trim();
  if (s === "true" || s === "t" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "f" || s === "0" || s === "no") return false;
  return defaultVal;
}

function readCsvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) return [];
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true
  });
}

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const CLEAR = args.has("--clear-regensburg");

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase();
  if (v === "pending" || v === "delivered" || v === "not_picked_up") return v;
  return "pending";
}

function normalizeSource(s) {
  const v = String(s || "qr").toLowerCase();
  if (v === "staff" || v === "admin") return v;
  return "qr";
}

async function clearRegensburgData(client, branchId) {
  await client.query(`DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE branch_id = $1)`, [
    branchId
  ]);
  await client.query(`DELETE FROM public.orders WHERE branch_id = $1`, [branchId]);
  await client.query(`DELETE FROM public.menu_items WHERE menu_id IN (SELECT id FROM public.menus WHERE branch_id = $1)`, [
    branchId
  ]);
  await client.query(`DELETE FROM public.menus WHERE branch_id = $1`, [branchId]);
  await client.query(`DELETE FROM public.products WHERE branch_id = $1`, [branchId]);
  await client.query(`DELETE FROM public.daily_order_counters WHERE branch_id = $1`, [branchId]);
}

async function main() {
  loadEnvFile();
  const NEW_URL = process.env.NEW_DATABASE_URL;
  const SLUG = (process.env.REGENSBURG_SLUG || "regensburg").toLowerCase();
  const exportDir = path.resolve(process.env.EXPORT_DIR || path.join(__dirname, "export"));

  if (!NEW_URL) {
    console.error("Set NEW_DATABASE_URL in env.import (OLD is not used by this script).");
    process.exit(1);
  }

  const requiredFiles = [
    "products.csv",
    "menus.csv",
    "menu_items.csv",
    "orders.csv",
    "order_items.csv",
    "daily_order_counters.csv"
  ];
  for (const f of requiredFiles) {
    const fp = path.join(exportDir, f);
    if (!fs.existsSync(fp)) {
      console.error(`Missing export file: ${fp}\nSee scripts/import-regensburg/export/README.md`);
      process.exit(1);
    }
  }

  const productsRows = readCsvFile(path.join(exportDir, "products.csv"));
  const menusRows = readCsvFile(path.join(exportDir, "menus.csv"));
  let menuItemsRows = readCsvFile(path.join(exportDir, "menu_items.csv"));
  const ordersRows = readCsvFile(path.join(exportDir, "orders.csv"));
  let orderItemsRows = readCsvFile(path.join(exportDir, "order_items.csv"));
  const countersRows = readCsvFile(path.join(exportDir, "daily_order_counters.csv"));

  console.log(
    `Export counts: products=${productsRows.length} menus=${menusRows.length} menu_items=${menuItemsRows.length} orders=${ordersRows.length} order_items=${orderItemsRows.length} counters=${countersRows.length}`
  );

  const productIdSet = new Set(productsRows.map((r) => Number(getCell(r, "id"))).filter((n) => Number.isFinite(n)));
  const menuIdSet = new Set(menusRows.map((r) => Number(getCell(r, "id"))).filter((n) => Number.isFinite(n)));
  menuItemsRows = menuItemsRows.filter((r) => {
    const mid = Number(getCell(r, "menu_id"));
    const pid = Number(getCell(r, "product_id"));
    return menuIdSet.has(mid) && productIdSet.has(pid);
  });
  const orderIdSet = new Set(ordersRows.map((r) => Number(getCell(r, "id"))).filter((n) => Number.isFinite(n)));
  orderItemsRows = orderItemsRows.filter((r) => orderIdSet.has(Number(getCell(r, "order_id"))));

  const newCfg = buildPgClientConfig(NEW_URL, "NEW");
  const newClient = await connectNew(pg, newCfg);

  try {
    const branchRes = await newClient.query(`SELECT id, name, slug FROM public.branches WHERE lower(slug) = lower($1) LIMIT 1`, [
      SLUG
    ]);
    if (branchRes.rows.length === 0) {
      throw new Error(`Branch with slug "${SLUG}" not found in NEW database. Create it first.`);
    }
    const branchId = branchRes.rows[0].id;
    console.log(`Target branch: ${branchRes.rows[0].name} (id=${branchId}, slug=${SLUG})`);

    if (DRY) {
      console.log("Dry run — no changes to NEW database.");
      return;
    }

    await newClient.query("BEGIN");

    if (CLEAR) {
      console.log("Clearing existing Regensburg data in NEW database only…");
      await clearRegensburgData(newClient, branchId);
    }

    const productMap = new Map();
    for (const r of productsRows) {
      const oldId = Number(getCell(r, "id"));
      if (!Number.isFinite(oldId)) continue;
      const catRaw = emptyToNull(getCell(r, "category"));
      const cat =
        catRaw && ["backwaren", "getraenke", "extras"].includes(String(catRaw)) ? String(catRaw) : "backwaren";
      const ins = await newClient.query(
        `INSERT INTO public.products (branch_id, name, price, image_url, is_active, archived_at, created_at, category)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          branchId,
          getCell(r, "name"),
          getCell(r, "price"),
          emptyToNull(getCell(r, "image_url")),
          parseBool(getCell(r, "is_active"), true),
          emptyToNull(getCell(r, "archived_at")),
          emptyToNull(getCell(r, "created_at")) ?? new Date(),
          cat
        ]
      );
      productMap.set(oldId, ins.rows[0].id);
    }

    const menuMap = new Map();
    for (const r of menusRows) {
      const oldId = Number(getCell(r, "id"));
      if (!Number.isFinite(oldId)) continue;
      const ins = await newClient.query(
        `INSERT INTO public.menus (branch_id, name, description, price, image_url, is_active, archived_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          branchId,
          getCell(r, "name"),
          emptyToNull(getCell(r, "description")),
          getCell(r, "price"),
          emptyToNull(getCell(r, "image_url")),
          parseBool(getCell(r, "is_active"), true),
          emptyToNull(getCell(r, "archived_at")),
          emptyToNull(getCell(r, "created_at")) ?? new Date()
        ]
      );
      menuMap.set(oldId, ins.rows[0].id);
    }

    for (const r of menuItemsRows) {
      const mid = menuMap.get(Number(getCell(r, "menu_id")));
      const pid = productMap.get(Number(getCell(r, "product_id")));
      if (mid == null || pid == null) {
        throw new Error(`menu_items: missing menu or product mapping for row menu_id=${getCell(r, "menu_id")} product_id=${getCell(r, "product_id")}`);
      }
      const q = Number(getCell(r, "quantity"));
      await newClient.query(
        `INSERT INTO public.menu_items (menu_id, product_id, quantity, created_at)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (menu_id, product_id) DO NOTHING`,
        [mid, pid, Math.max(1, Number.isFinite(q) ? q : 1), emptyToNull(getCell(r, "created_at")) ?? new Date()]
      );
    }

    const orderMap = new Map();
    for (const r of ordersRows) {
      const oldId = Number(getCell(r, "id"));
      if (!Number.isFinite(oldId)) continue;
      const ins = await newClient.query(
        `INSERT INTO public.orders (branch_id, order_number, customer_name, pickup_date, status, source, total_amount, created_at, delivered_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          branchId,
          getCell(r, "order_number"),
          getCell(r, "customer_name"),
          getCell(r, "pickup_date"),
          normalizeStatus(getCell(r, "status")),
          normalizeSource(getCell(r, "source")),
          getCell(r, "total_amount") ?? 0,
          emptyToNull(getCell(r, "created_at")) ?? new Date(),
          emptyToNull(getCell(r, "delivered_at"))
        ]
      );
      orderMap.set(oldId, ins.rows[0].id);
    }

    for (const r of orderItemsRows) {
      const oid = orderMap.get(Number(getCell(r, "order_id")));
      if (oid == null) throw new Error(`order_items: unknown order_id=${getCell(r, "order_id")}`);
      const opid = getCell(r, "product_id");
      const omid = getCell(r, "menu_id");
      const pid = opid != null && String(opid).trim() !== "" ? productMap.get(Number(opid)) ?? null : null;
      const mid = omid != null && String(omid).trim() !== "" ? menuMap.get(Number(omid)) ?? null : null;
      await newClient.query(
        `INSERT INTO public.order_items (order_id, product_id, menu_id, quantity, unit_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [oid, pid, mid, getCell(r, "quantity"), getCell(r, "unit_price") ?? 0]
      );
    }

    for (const r of countersRows) {
      const pickup = getCell(r, "pickup_date");
      const last = Number(getCell(r, "last_number")) || 0;
      await newClient.query(
        `INSERT INTO public.daily_order_counters (branch_id, pickup_date, last_number)
         VALUES ($1,$2,$3)
         ON CONFLICT (branch_id, pickup_date) DO UPDATE SET last_number = GREATEST(public.daily_order_counters.last_number, EXCLUDED.last_number)`,
        [branchId, pickup, last]
      );
    }

    await newClient.query("COMMIT");
    console.log("Import committed successfully.");
  } catch (e) {
    await newClient.query("ROLLBACK").catch(() => {});
    console.error(e);
    process.exit(1);
  } finally {
    await newClient.end().catch(() => {});
  }
}

main();
