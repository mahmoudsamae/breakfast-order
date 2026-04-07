import { NextResponse } from "next/server";
import { requireAdminCookie } from "@/lib/admin-api-guard";
import { getSupabaseServerClient } from "@/lib/supabase";
import { mapOrdersForExcel, resolveExportDate, isOrderOnBerlinDate } from "@/lib/order-export-rows";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  const unauthorized = requireAdminCookie();
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const exportDate = resolveExportDate(url.searchParams.get("date"));
  const exportAll = url.searchParams.get("all") === "1";
  const statusFilter = String(url.searchParams.get("status") || "").trim();

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*,order_items(quantity,products(name),menus(name))")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = data || [];
  if (!exportAll) rows = rows.filter((o) => isOrderOnBerlinDate(o, exportDate));
  if (statusFilter) rows = rows.filter((o) => String(o.status || "") === statusFilter);

  return NextResponse.json({
    date: exportDate,
    rows: mapOrdersForExcel(rows)
  });
}
