import { NextResponse } from "next/server";
import { requireBranchSession } from "@/lib/api-branch-guard";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const INTAKE_SELECT =
  "id,branch_id,registration_number,arrival_date,departure_date,first_name,last_name,birth_date,country,street,postcode,city,id_number,phone,email,license_plate,adults_count,children_count,infants_count,dogs_count,other_pets_count,payment_method,notes,created_at,expires_at";

const ANALYTICS_DONE_SELECT =
  "id,branch_id,registration_number,arrival_date,departure_date,stay_nights,country,adults_count,children_count,infants_count,dogs_count,other_pets_count,has_vehicle,has_email,has_phone,breakfast_ordered,created_at,processed_at";

export async function GET(_, { params }) {
  const { error: authErr } = await requireBranchSession(params.slug, ["team", "admin"]);
  if (authErr) return authErr;

  const { branch, error: brErr } = await fetchBranchBySlug(params.slug);
  if (brErr || !branch) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

  const supabase = getSupabaseServerClient();

  const [{ data: pending, error: pErr }, { data: completed, error: cErr }] = await Promise.all([
    supabase
      .from("registrations_intake")
      .select(INTAKE_SELECT)
      .eq("branch_id", branch.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("registrations_analytics")
      .select(ANALYTICS_DONE_SELECT)
      .eq("branch_id", branch.id)
      .not("processed_at", "is", null)
      .order("processed_at", { ascending: false })
      .limit(200)
  ]);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  return NextResponse.json({
    pending: pending || [],
    completed: completed || []
  });
}
