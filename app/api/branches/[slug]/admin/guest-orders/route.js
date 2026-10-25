import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getGuestOrdersPaused, setGuestOrdersPaused } from "@/lib/guest-orders-paused";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const supabase = getSupabaseServerClient();
  const { paused, missingColumn } = await getGuestOrdersPaused(supabase, branch.id);
  return NextResponse.json({ paused, missingColumn });
}

export async function PATCH(req, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  try {
    const body = await req.json();
    if (typeof body.paused !== "boolean") {
      return NextResponse.json({ error: "paused (boolean) erforderlich." }, { status: 400 });
    }
    const supabase = getSupabaseServerClient();
    const result = await setGuestOrdersPaused(supabase, branch.id, body.paused);
    return NextResponse.json({ ok: true, paused: result.paused });
  } catch (e) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ error: String(e.message || e) }, { status });
  }
}
