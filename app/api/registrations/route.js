import { NextResponse } from "next/server";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { normalizeBranchSlug } from "@/lib/branch-slug";
import { buildRegistrationAnalyticsInsert } from "@/lib/registration-analytics-payload";
import { hasTruthyText, stayNightsFromIsoDates, trimOrNull } from "@/lib/registration-helpers";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isYmd(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

function parseNonNegInt(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return fallback;
  return n;
}

function parsePosInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

/** Public: create intake + analytics for an active branch. */
export async function POST(req) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
    }

    const slug = normalizeBranchSlug(String(body.slug || ""));
    const arrival_date = String(body.arrival_date || "").trim();
    const departure_date = String(body.departure_date || "").trim();
    const source = String(body.source || "qr").slice(0, 64) || "qr";

    const first_name = trimOrNull(body.first_name, 200);
    const last_name = trimOrNull(body.last_name, 200);
    if (!first_name || !last_name) {
      return NextResponse.json({ error: "Vor- und Nachname sind erforderlich." }, { status: 400 });
    }
    const birthRaw = trimOrNull(body.birth_date, 32);
    const birthYmd = birthRaw && isYmd(birthRaw) ? birthRaw : null;
    if (!birthYmd) {
      return NextResponse.json({ error: "Geburtsdatum ist erforderlich (JJJJ-MM-TT)." }, { status: 400 });
    }
    const country = trimOrNull(body.country, 100);
    const street = trimOrNull(body.street, 500);
    const postcode = trimOrNull(body.postcode, 32);
    const city = trimOrNull(body.city, 200);
    const id_number = trimOrNull(body.id_number, 128);
    const phone = trimOrNull(body.phone, 64);
    const email = trimOrNull(body.email, 320);
    const license_plate = trimOrNull(body.license_plate, 32);
    const payment_method = trimOrNull(body.payment_method, 64);
    const notesRaw = body.notes != null ? String(body.notes) : "";
    const notes = trimOrNull(notesRaw, 4000);

    const adults_count = parsePosInt(body.adults_count, 0, 500, 0);
    const children_count = parsePosInt(body.children_count, 0, 500, 0);
    const infants_count = parsePosInt(body.infants_count, 0, 500, 0);
    const dogs_count = parsePosInt(body.dogs_count, 0, 100, 0);
    const other_pets_count = parsePosInt(body.other_pets_count, 0, 100, 0);

    const retentionDays = Math.min(
      365,
      Math.max(1, parseNonNegInt(process.env.REGISTRATION_INTAKE_RETENTION_DAYS, 30) || 30)
    );
    const expires_at = new Date(Date.now() + retentionDays * 86400000).toISOString();

    if (!slug) {
      return NextResponse.json({ error: "Standort fehlt." }, { status: 400 });
    }
    if (!isYmd(arrival_date) || !isYmd(departure_date)) {
      return NextResponse.json({ error: "Datum bitte als JJJJ-MM-TT angeben." }, { status: 400 });
    }
    if (departure_date < arrival_date) {
      return NextResponse.json({ error: "Abreise darf nicht vor Anreise liegen." }, { status: 400 });
    }
    const guests = adults_count + children_count + infants_count;
    if (guests < 1 || guests > 500) {
      return NextResponse.json(
        { error: "Bitte mindestens eine Person (Erwachsene/Kinder/Kleinkinder) angeben." },
        { status: 400 }
      );
    }

    const { branch, error: brErr } = await fetchBranchBySlug(slug);
    if (brErr || !branch) {
      return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });
    }

    const stay_nights = stayNightsFromIsoDates(arrival_date, departure_date);
    const has_vehicle = hasTruthyText(license_plate);
    const has_email = hasTruthyText(email);
    const has_phone = hasTruthyText(phone);

    const supabase = getSupabaseServerClient();

    /** Full operational / PII — registrations_intake only (deleted on purge or expiry). */
    const intakeRow = {
      branch_id: branch.id,
      arrival_date,
      departure_date,
      first_name,
      last_name,
      birth_date: birthYmd,
      country,
      street,
      postcode,
      city,
      id_number,
      phone,
      email,
      license_plate,
      adults_count,
      children_count,
      infants_count,
      dogs_count,
      other_pets_count,
      payment_method,
      notes,
      expires_at
    };

    const { data: intake, error: intakeErr } = await supabase
      .from("registrations_intake")
      .insert(intakeRow)
      .select("id,registration_number,arrival_date,departure_date")
      .single();

    if (intakeErr) {
      return NextResponse.json({ error: intakeErr.message }, { status: 500 });
    }

    const registration_number = intake?.registration_number;
    if (registration_number == null) {
      await supabase.from("registrations_intake").delete().eq("id", intake?.id);
      return NextResponse.json({ error: "Anmeldenummer konnte nicht vergeben werden." }, { status: 500 });
    }

    const analyticsRow = buildRegistrationAnalyticsInsert({
      branch_id: branch.id,
      registration_number,
      arrival_date,
      departure_date,
      stay_nights,
      country,
      adults_count,
      children_count,
      infants_count,
      dogs_count,
      other_pets_count,
      has_vehicle,
      has_email,
      has_phone
    });

    const { error: analyticsErr } = await supabase.from("registrations_analytics").insert(analyticsRow);

    if (analyticsErr) {
      await supabase.from("registrations_intake").delete().eq("id", intake.id);
      return NextResponse.json({ error: analyticsErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id: intake.id,
      registration_number,
      arrival_date: intake.arrival_date,
      departure_date: intake.departure_date,
      source
    });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
