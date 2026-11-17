import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { recordOrderEvent, rejectIfCancelled } from "@/lib/order-events";
import { updateStaffOrderItems } from "@/lib/staff-update-order-items";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  const { error: authErr, session } = await requireBranchSession(params.slug, ["team", "admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ungültige Bestell-ID." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const supabase = getSupabaseServerClient();
    const blocked = await rejectIfCancelled(supabase, { id, branchId: branch.id });
    if (blocked) return blocked;
    const result = await updateStaffOrderItems(supabase, {
      branchId: branch.id,
      orderId: id,
      lines
    });
    await recordOrderEvent(supabase, { orderId: id, branchId: branch.id, action: "items", role: session.role });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ error: String(e?.message || e) }, { status });
  }
}
