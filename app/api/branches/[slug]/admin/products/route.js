import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { normalizeProductCategorySlug } from "@/lib/product-category";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("branch_id", branch.id)
    .order("id", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data || [] });
}

export async function POST(req, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const body = await req.json();
  const { name, price, image_url, is_active, category } = body;
  if (!name || !String(name).trim()) return NextResponse.json({ error: "Name fehlt." }, { status: 400 });
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("products").insert({
    branch_id: branch.id,
    name: String(name).trim(),
    price: Number(price || 0),
    image_url: image_url || null,
    is_active: is_active !== false,
    category: normalizeProductCategorySlug(category)
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const body = await req.json();
  const { id, name, price, image_url, is_active, category } = body;
  if (!id) return NextResponse.json({ error: "ID fehlt." }, { status: 400 });
  const supabase = getSupabaseServerClient();
  const payload = {};
  if (name !== undefined) payload.name = name;
  if (price !== undefined) payload.price = Number(price);
  if (image_url !== undefined) payload.image_url = image_url || null;
  if (category !== undefined) payload.category = normalizeProductCategorySlug(category);
  if (is_active !== undefined) {
    payload.is_active = is_active;
    payload.archived_at = is_active ? null : new Date().toISOString();
  }
  const { error } = await supabase.from("products").update(payload).eq("id", id).eq("branch_id", branch.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const id = body.id ?? new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID fehlt." }, { status: 400 });
  const supabase = getSupabaseServerClient();

  const { data: productRow, error: pErr } = await supabase
    .from("products")
    .select("id")
    .eq("id", id)
    .eq("branch_id", branch.id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!productRow) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });

  const { count, error: cntErr } = await supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);
  if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 500 });
  if ((count || 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Dieses Produkt wurde bereits bestellt und kann nicht endgültig gelöscht werden. Bitte „Ausblenden“ (Archivieren) nutzen.",
        code: "HAS_ORDER_HISTORY"
      },
      { status: 409 }
    );
  }
  const { error } = await supabase.from("products").delete().eq("id", id).eq("branch_id", branch.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
