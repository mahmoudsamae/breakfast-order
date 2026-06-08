import { NextResponse } from "next/server";
import { requireRootSession } from "@/lib/api-root-guard";
import { getRegistrationEnabled, setRegistrationEnabled } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error: authErr } = await requireRootSession();
  if (authErr) return authErr;

  const registrationEnabled = await getRegistrationEnabled();
  return NextResponse.json({ registrationEnabled });
}

export async function PATCH(req) {
  const { error: authErr } = await requireRootSession();
  if (authErr) return authErr;

  try {
    const body = await req.json();
    if (typeof body.registrationEnabled !== "boolean") {
      return NextResponse.json({ error: "registrationEnabled (boolean) erforderlich." }, { status: 400 });
    }

    await setRegistrationEnabled(body.registrationEnabled);
    return NextResponse.json({ ok: true, registrationEnabled: body.registrationEnabled });
  } catch (e) {
    const status = Number(e?.status) || 500;
    return NextResponse.json({ error: String(e?.message || e) }, { status });
  }
}
