/**
 * Read-only import: OLD PostgreSQL → NEW multi-branch PostgreSQL (Regensburg branch).
 * - Never writes to OLD (SELECT only + READ ONLY transaction).
 * - Inserts into NEW with ID mapping (no OVERRIDING SYSTEM VALUE).
 *
 * Usage:
 *   node scripts/import-regensburg/import-breakfast-data.mjs [--dry-run] [--clear-regensburg]
 *
 * Env file: scripts/import-regensburg/env.import (see env.import.example)
 */

import dns from "node:dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

/** Prefer IPv4 when both A and AAAA exist (reduces ECONNREFUSED on misconfigured IPv6 routes). */
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Mask password in URLs for safe logging. */
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

/**
 * Build pg.Client config for Supabase and generic PostgreSQL.
 * - Remote hosts: SSL enabled (Supabase requires TLS). Default rejectUnauthorized: false unless SUPABASE_SSL_STRICT=1.
 * - localhost: no SSL unless sslmode is already in the URL.
 * - Appends sslmode=require for remote when missing.
 * - Longer timeouts for slow networks / pooler handshake.
 * - dns.setDefaultResultOrder("ipv4first") at module load prefers IPv4 when both A and AAAA exist.
 */
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
        "Long transactions can be unreliable in transaction mode. Prefer Session pooler or Direct connection on port 5432 for this importer — see README."
    );
  }

  const config = {
    connectionString: url,
    application_name: `breakfast-import-${roleLabel.toLowerCase()}`,
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
      `[config] ${roleLabel}: TLS enabled (rejectUnauthorized=${config.ssl.rejectUnauthorized}; set SUPABASE_SSL_STRICT=1 for strict cert verify)`
    );
  }

  return config;
}

async function connectClient(pgModule, config, humanLabel, envVarName) {
  const client = new pgModule.Client(config);
  console.log(`\nConnecting ${humanLabel} (${envVarName}) …`);
  try {
    await client.connect();
    console.log(`[OK] ${humanLabel} — connected successfully.`);
    return client;
  } catch (err) {
    console.error(`\n[FAIL] ${humanLabel} (${envVarName})`);
    console.error(`  ${err.code || err.name || "Error"}: ${err.message}`);
    if (err.code === "ECONNREFUSED") {
      console.error("  Hint: Connection refused — wrong host/port, local firewall, or DB not listening on that interface.");
      console.error("  Supabase: Dashboard → Settings → Database → check host, use pooler or direct as documented.");
    } else if (err.code === "ETIMEDOUT" || err.code === "ESOCKETTIMEDOUT") {
      console.error("  Hint: Timeout — network path blocked; try Session pooler :5432, or enable IPv4 preference (script sets ipv4first).");
    } else if (err.message && /SSL|TLS|certificate/i.test(err.message)) {
      console.error("  Hint: TLS issue — ensure sslmode=require for remote hosts; for Supabase use connection string from Dashboard.");
    }
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

async function tableExists(client, table) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return rows.length > 0;
}

async function columnExists(client, table, col) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, col]
  );
  return rows.length > 0;
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
  const OLD_URL = process.env.OLD_DATABASE_URL;
  const NEW_URL = process.env.NEW_DATABASE_URL;
  const SLUG = (process.env.REGENSBURG_SLUG || "regensburg").toLowerCase();
  const oldBranchFilter = process.env.OLD_BRANCH_ID ? String(process.env.OLD_BRANCH_ID).trim() : "";

  if (!OLD_URL || !NEW_URL) {
    console.error("Set OLD_DATABASE_URL and NEW_DATABASE_URL in env.import");
    process.exit(1);
  }

  let oldClient;
  let newClient;

  try {
    const oldCfg = buildPgClientConfig(OLD_URL, "OLD");
    oldClient = await connectClient(pg, oldCfg, "OLD database (read-only source)", "OLD_DATABASE_URL");
  } catch {
    process.exit(1);
  }

  try {
    const newCfg = buildPgClientConfig(NEW_URL, "NEW");
    newClient = await connectClient(pg, newCfg, "NEW database (import target)", "NEW_DATABASE_URL");
  } catch {
    await oldClient.end().catch(() => {});
    process.exit(1);
  }

  try {
    await oldClient.query("BEGIN READ ONLY");

    const branchRes = await newClient.query(`SELECT id, name, slug FROM public.branches WHERE lower(slug) = lower($1) LIMIT 1`, [
      SLUG
    ]);
    if (branchRes.rows.length === 0) {
      throw new Error(`Branch with slug "${SLUG}" not found in NEW database. Create it first.`);
    }
    const branchId = branchRes.rows[0].id;
    console.log(`Target branch: ${branchRes.rows[0].name} (id=${branchId}, slug=${SLUG})`);

    const ob = oldBranchFilter ? Number(oldBranchFilter) : null;
    const pBranch = ob != null && Number.isFinite(ob) && (await columnExists(oldClient, "products", "branch_id"));
    const mBranch = ob != null && Number.isFinite(ob) && (await columnExists(oldClient, "menus", "branch_id"));
    const oBranch = ob != null && Number.isFinite(ob) && (await columnExists(oldClient, "orders", "branch_id"));

    const productsOld = (
      await oldClient.query(
        pBranch ? `SELECT * FROM public.products WHERE branch_id = $1 ORDER BY id` : `SELECT * FROM public.products ORDER BY id`,
        pBranch ? [ob] : []
      )
    ).rows;
    const menusOld = (
      await oldClient.query(
        mBranch ? `SELECT * FROM public.menus WHERE branch_id = $1 ORDER BY id` : `SELECT * FROM public.menus ORDER BY id`,
        mBranch ? [ob] : []
      )
    ).rows;

    const oldHasMenuItems = await tableExists(oldClient, "menu_items");
    let menuItemsOld = oldHasMenuItems ? (await oldClient.query(`SELECT * FROM public.menu_items ORDER BY id`)).rows : [];
    const productIdSet = new Set(productsOld.map((r) => Number(r.id)));
    const menuIdSet = new Set(menusOld.map((r) => Number(r.id)));
    menuItemsOld = menuItemsOld.filter(
      (r) => menuIdSet.has(Number(r.menu_id)) && productIdSet.has(Number(r.product_id))
    );

    const ordersOld = (
      await oldClient.query(
        oBranch ? `SELECT * FROM public.orders WHERE branch_id = $1 ORDER BY id` : `SELECT * FROM public.orders ORDER BY id`,
        oBranch ? [ob] : []
      )
    ).rows;
    const orderIdSet = new Set(ordersOld.map((r) => Number(r.id)));
    let orderItemsOld = (await oldClient.query(`SELECT * FROM public.order_items ORDER BY id`)).rows;
    orderItemsOld = orderItemsOld.filter((r) => orderIdSet.has(Number(r.order_id)));

    let countersOld = [];
    if (await tableExists(oldClient, "daily_order_counters")) {
      countersOld = (await oldClient.query(`SELECT * FROM public.daily_order_counters ORDER BY pickup_date`)).rows;
    }

    console.log(
      `OLD counts: products=${productsOld.length} menus=${menusOld.length} menu_items=${menuItemsOld.length} orders=${ordersOld.length} order_items=${orderItemsOld.length} counters=${countersOld.length}`
    );

    if (DRY) {
      console.log("Dry run — no changes to NEW database.");
      await oldClient.query("ROLLBACK");
      return;
    }

    await newClient.query("BEGIN");

    if (CLEAR) {
      console.log("Clearing existing Regensburg data in NEW database only…");
      await clearRegensburgData(newClient, branchId);
    }

    const productMap = new Map();
    for (const r of productsOld) {
      const catRaw = r.category;
      const cat =
        catRaw && ["backwaren", "getraenke", "extras"].includes(String(catRaw)) ? String(catRaw) : "backwaren";
      const ins = await newClient.query(
        `INSERT INTO public.products (branch_id, name, price, image_url, is_active, archived_at, created_at, category)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          branchId,
          r.name,
          r.price,
          r.image_url ?? null,
          r.is_active !== false,
          r.archived_at ?? null,
          r.created_at ?? new Date(),
          cat
        ]
      );
      productMap.set(Number(r.id), ins.rows[0].id);
    }

    const menuMap = new Map();
    for (const r of menusOld) {
      const ins = await newClient.query(
        `INSERT INTO public.menus (branch_id, name, description, price, image_url, is_active, archived_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          branchId,
          r.name,
          r.description ?? null,
          r.price,
          r.image_url ?? null,
          r.is_active !== false,
          r.archived_at ?? null,
          r.created_at ?? new Date()
        ]
      );
      menuMap.set(Number(r.id), ins.rows[0].id);
    }

    for (const r of menuItemsOld) {
      const mid = menuMap.get(Number(r.menu_id));
      const pid = productMap.get(Number(r.product_id));
      if (mid == null || pid == null) {
        throw new Error(`menu_items: missing menu or product mapping for old row menu_id=${r.menu_id} product_id=${r.product_id}`);
      }
      await newClient.query(
        `INSERT INTO public.menu_items (menu_id, product_id, quantity, created_at)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (menu_id, product_id) DO NOTHING`,
        [mid, pid, Math.max(1, Number(r.quantity) || 1), r.created_at ?? new Date()]
      );
    }

    const orderMap = new Map();
    for (const r of ordersOld) {
      const st = normalizeStatus(r.status);
      const ins = await newClient.query(
        `INSERT INTO public.orders (branch_id, order_number, customer_name, pickup_date, status, source, total_amount, created_at, delivered_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          branchId,
          r.order_number,
          r.customer_name,
          r.pickup_date,
          st,
          normalizeSource(r.source),
          r.total_amount ?? 0,
          r.created_at ?? new Date(),
          r.delivered_at ?? null
        ]
      );
      orderMap.set(Number(r.id), ins.rows[0].id);
    }

    for (const r of orderItemsOld) {
      const oid = orderMap.get(Number(r.order_id));
      if (oid == null) throw new Error(`order_items: unknown old order_id=${r.order_id}`);
      const pid = r.product_id != null ? productMap.get(Number(r.product_id)) ?? null : null;
      const mid = r.menu_id != null ? menuMap.get(Number(r.menu_id)) ?? null : null;
      await newClient.query(
        `INSERT INTO public.order_items (order_id, product_id, menu_id, quantity, unit_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [oid, pid, mid, r.quantity, r.unit_price ?? 0]
      );
    }

    for (const r of countersOld) {
      const pickup = r.pickup_date;
      const last = Number(r.last_number) || 0;
      await newClient.query(
        `INSERT INTO public.daily_order_counters (branch_id, pickup_date, last_number)
         VALUES ($1,$2,$3)
         ON CONFLICT (branch_id, pickup_date) DO UPDATE SET last_number = GREATEST(public.daily_order_counters.last_number, EXCLUDED.last_number)`,
        [branchId, pickup, last]
      );
    }

    await newClient.query("COMMIT");
    console.log("Import committed successfully.");
    await oldClient.query("ROLLBACK");
  } catch (e) {
    if (newClient) await newClient.query("ROLLBACK").catch(() => {});
    if (oldClient) await oldClient.query("ROLLBACK").catch(() => {});
    console.error(e);
    process.exit(1);
  } finally {
    if (newClient) await newClient.end().catch(() => {});
    if (oldClient) await oldClient.end().catch(() => {});
  }
}

main();
