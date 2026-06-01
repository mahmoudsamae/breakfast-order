import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { hideDoneOrdersFromStaffList } from "@/lib/staff-orders-list";
import { pickupDateForService } from "@/lib/staff-orders-shared";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["team", "admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  try {
    const body = await req.json().catch(() => ({}));
    const pickupDate = String(body.pickupDate || pickupDateForService(body.service || "today"));

    const supabase = getSupabaseServerClient();
    const { hiddenCount } = await hideDoneOrdersFromStaffList(supabase, {
      branchId: branch.id,
      pickupDate
    });

    return NextResponse.json({
      ok: true,
      hiddenCount,
      message:
        hiddenCount > 0
          ? `${hiddenCount} erledigte Bestellung(en) aus der Team-Liste entfernt. Daten bleiben gespeichert.`
          : "Keine erledigten Bestellungen zum Entfernen."
    });
  } catch (e) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ error: String(e?.message || e) }, { status });
  }
}
