import { NextResponse } from "next/server";
import { requireRootSession } from "@/lib/api-root-guard";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error: authErr } = await requireRootSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("branch_credentials")
    .select("id,branch_id,username,role,is_active,created_at, branches(name,slug)")
    .order("branch_id", { ascending: true })
    .order("username", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}
