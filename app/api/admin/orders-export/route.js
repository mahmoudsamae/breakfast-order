import { NextResponse } from "next/server";
import { requireAdminCookie } from "@/lib/admin-api-guard";
import { fetchAllOrdersForExport } from "@/lib/fetch-orders-for-export";
import { mapOrdersForExcel, resolveExportDate, isOrderOnBerlinDate } from "@/lib/order-export-rows";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
/** Large exports: allow enough time for paginated DB reads (Vercel / serverless). */
export const maxDuration = 120;

export async function GET(req) {
  const unauthorized = requireAdminCookie();
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const exportDate = resolveExportDate(url.searchParams.get("date"));
  const exportAll = url.searchParams.get("all") === "1";
  const statusFilter = String(url.searchParams.get("status") || "").trim();

  try {
    const supabase = getSupabaseServerClient();
    const { orders: fetched, fetchedPages } = await fetchAllOrdersForExport(supabase);

    let rows = fetched;
    if (!exportAll) rows = rows.filter((o) => isOrderOnBerlinDate(o, exportDate));
    if (statusFilter) rows = rows.filter((o) => String(o.status || "") === statusFilter);

    return NextResponse.json({
      date: exportDate,
      rows: mapOrdersForExcel(rows),
      meta: {
        exportAll,
        ordersFetched: fetched.length,
        ordersExported: rows.length,
        fetchedPages,
        statusFilter: statusFilter || null
      }
    });
  } catch (e) {
    const message = String(e?.message || e);
    const status = e?.code === "EXPORT_LIMIT" ? 413 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
