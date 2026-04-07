import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { mapOrdersForExcel, resolveExportDate, isOrderOnBerlinDate } from "@/lib/order-export-rows";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const url = new URL(req.url);
  const exportDate = resolveExportDate(url.searchParams.get("date"));
  const exportAll = url.searchParams.get("all") === "1";
  const statusFilter = String(url.searchParams.get("status") || "").trim();

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*,order_items(quantity,products(name),menus(name))")
    .eq("branch_id", branch.id)
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
