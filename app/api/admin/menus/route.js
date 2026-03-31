import { NextResponse } from "next/server";
import { requireAdminCookie } from "@/lib/admin-api-guard";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const unauthorized = requireAdminCookie();
  if (unauthorized) return unauthorized;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("menus").select("*").order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ menus: data || [] });
}

export async function POST(req) {
  const unauthorized = requireAdminCookie();
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const { name, description, price, image_url, is_active } = body;
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("menus").insert({
    name,
    description: description || null,
    price: Number(price || 0),
    image_url: image_url || null,
    is_active: is_active !== false
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req) {
  const unauthorized = requireAdminCookie();
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const { id, name, description, price, image_url, is_active } = body;
  if (!id) return NextResponse.json({ error: "ID fehlt." }, { status: 400 });
  const payload = {};
  if (name !== undefined) payload.name = name;
  if (description !== undefined) payload.description = description;
  if (price !== undefined) payload.price = Number(price);
  if (image_url !== undefined) payload.image_url = image_url || null;
  if (is_active !== undefined) {
    payload.is_active = is_active;
    payload.archived_at = is_active ? null : new Date().toISOString();
  }
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("menus").update(payload).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const unauthorized = requireAdminCookie();
  if (unauthorized) return unauthorized;
  const body = await req.json().catch(() => ({}));
  const id = body.id ?? new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID fehlt." }, { status: 400 });
  const supabase = getSupabaseServerClient();
  const { count, error: cntErr } = await supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("menu_id", id);
  if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 500 });
  if ((count || 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Dieses Menü wurde bereits bestellt und kann nicht endgültig gelöscht werden. Bitte „Ausblenden“ (Archivieren) nutzen.",
        code: "HAS_ORDER_HISTORY"
      },
      { status: 409 }
    );
  }
  const { error } = await supabase.from("menus").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
