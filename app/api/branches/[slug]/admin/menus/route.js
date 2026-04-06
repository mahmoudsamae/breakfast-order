import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeMenuItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  const merged = new Map();
  for (const row of rawItems) {
    const productId = Number(row?.product_id);
    const qty = Number(row?.quantity);
    if (!Number.isInteger(productId) || productId <= 0) continue;
    if (!Number.isInteger(qty) || qty <= 0) continue;
    merged.set(productId, (merged.get(productId) || 0) + qty);
  }
  return [...merged.entries()].map(([product_id, quantity]) => ({ product_id, quantity }));
}

export async function GET(_, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("menus")
    .select("*,menu_items(id,product_id,quantity,products(name,category))")
    .eq("branch_id", branch.id)
    .order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ menus: data || [] });
}

export async function POST(req, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const body = await req.json();
  const { name, description, price, image_url, is_active, menu_items } = body;
  const supabase = getSupabaseServerClient();
  const normalizedItems = normalizeMenuItems(menu_items);
  const { data: created, error } = await supabase
    .from("menus")
    .insert({
      branch_id: branch.id,
      name,
      description: description || null,
      price: Number(price || 0),
      image_url: image_url || null,
      is_active: is_active !== false
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (created?.id && normalizedItems.length > 0) {
    const { error: miErr } = await supabase.from("menu_items").insert(
      normalizedItems.map((x) => ({ menu_id: created.id, product_id: x.product_id, quantity: x.quantity }))
    );
    if (miErr) return NextResponse.json({ error: miErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const body = await req.json();
  const { id, name, description, price, image_url, is_active, menu_items } = body;
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
  const { error } = await supabase.from("menus").update(payload).eq("id", id).eq("branch_id", branch.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (menu_items !== undefined) {
    const normalizedItems = normalizeMenuItems(menu_items);
    const { error: delErr } = await supabase.from("menu_items").delete().eq("menu_id", id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    if (normalizedItems.length > 0) {
      const { error: miErr } = await supabase.from("menu_items").insert(
        normalizedItems.map((x) => ({ menu_id: Number(id), product_id: x.product_id, quantity: x.quantity }))
      );
      if (miErr) return NextResponse.json({ error: miErr.message }, { status: 500 });
    }
  }
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

  const { data: menuRow, error: mErr } = await supabase
    .from("menus")
    .select("id")
    .eq("id", id)
    .eq("branch_id", branch.id)
    .maybeSingle();
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
  if (!menuRow) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });

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
  const { error } = await supabase.from("menus").delete().eq("id", id).eq("branch_id", branch.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
