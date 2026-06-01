import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { fetchAllOrdersForExport } from "@/lib/fetch-orders-for-export";
import { mapOrdersForExcel, resolveExportDate, isOrderOnBerlinDate } from "@/lib/order-export-rows";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

export async function GET(req, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const url = new URL(req.url);
  const exportDate = resolveExportDate(url.searchParams.get("date"));
  const exportAll = url.searchParams.get("all") === "1";
  const statusFilter = String(url.searchParams.get("status") || "").trim();

  try {
    const supabase = getSupabaseServerClient();
    const { orders: fetched, fetchedPages } = await fetchAllOrdersForExport(supabase, {
      branchId: branch.id
    });

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
