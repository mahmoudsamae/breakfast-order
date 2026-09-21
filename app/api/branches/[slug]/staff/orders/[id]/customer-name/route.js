import { NextResponse } from "next/server";
import { requireStaffOverride } from "@/lib/api-staff-override-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const EM_SUFFIX = " · EM:";

/**
 * Rename customer (display name only). Preserves „Eigenes Menü“ suffix in customer_name if present.
 * Requires staff session + override PIN cookie.
 */
export async function PATCH(req, { params }) {
  const { error: guardErr } = await requireStaffOverride(params.slug);
  if (guardErr) return guardErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ungültige Bestell-ID." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const nextClean = String(body.customerName || "").trim();
    if (!nextClean) {
      return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });
    }
    if (nextClean.length > 120) {
      return NextResponse.json({ error: "Name ist zu lang." }, { status: 400 });
    }
    if (nextClean.includes(EM_SUFFIX)) {
      return NextResponse.json({ error: "Ungültiger Name." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: order, error: loadErr } = await supabase
      .from("orders")
      .select("id,customer_name")
      .eq("id", id)
      .eq("branch_id", branch.id)
      .maybeSingle();

    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
    if (!order) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });

    const current = String(order.customer_name || "");
    const emIdx = current.indexOf(EM_SUFFIX);
    const emTail = emIdx >= 0 ? current.slice(emIdx) : "";
    const customer_name = `${nextClean}${emTail}`;

    const { error: updErr } = await supabase
      .from("orders")
      .update({ customer_name })
      .eq("id", id)
      .eq("branch_id", branch.id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, customerName: customer_name });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
