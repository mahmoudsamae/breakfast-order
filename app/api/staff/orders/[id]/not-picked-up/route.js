import { NextResponse } from "next/server";
import { normalizeNotPickedUpReason } from "@/lib/not-picked-up-reasons";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function PATCH(req, { params }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Ungültige Bestell-ID." }, { status: 400 });

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const reason = normalizeNotPickedUpReason(body.reason);
  if (!reason) return NextResponse.json({ error: "Ungültiger Grund für 'nicht abgeholt'." }, { status: 400 });
  const noteRaw = body.note != null ? String(body.note) : "";
  const note = noteRaw.trim().slice(0, 2000) || null;

  const supabase = getSupabaseServerClient();
  const updateWithReason = await supabase
    .from("orders")
    .update({
      status: "not_picked_up",
      not_picked_up_reason: reason,
      not_picked_up_note: note
    })
    .eq("id", id)
    .eq("status", "pending");

  if (!updateWithReason.error) return NextResponse.json({ ok: true, reasonSaved: true });

  const missingReasonCols =
    updateWithReason.error.code === "42703" ||
    String(updateWithReason.error.message || "").includes("not_picked_up_reason") ||
    String(updateWithReason.error.message || "").includes("not_picked_up_note");
  if (!missingReasonCols) return NextResponse.json({ error: updateWithReason.error.message }, { status: 500 });

  const fallback = await supabase
    .from("orders")
    .update({ status: "not_picked_up" })
    .eq("id", id)
    .eq("status", "pending");
  if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
