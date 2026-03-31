import { NextResponse } from "next/server";
import { requireAdminCookie } from "@/lib/admin-api-guard";
import { getSupabaseServerClient } from "@/lib/supabase";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "breakfast-images";

export async function POST(req) {
  const unauthorized = requireAdminCookie();
  if (unauthorized) return unauthorized;
  const form = await req.formData();
  const file = form.get("file");
  const folder = form.get("folder") || "misc";
  if (!file || typeof file === "string") return NextResponse.json({ error: "Keine Datei." }, { status: 400 });

  const safeFolder = ["products", "menus"].includes(String(folder)) ? folder : "misc";
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: file.type || "application/octet-stream", upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
