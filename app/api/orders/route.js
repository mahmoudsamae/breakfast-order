import { NextResponse } from "next/server";
import { fetchBranchBySlug } from "@/lib/branch-server";
import { DUPLICATE_ORDER_CODE, placeCustomerOrder } from "@/lib/place-customer-order";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Legacy POST /api/orders — uses NEXT_PUBLIC_DEFAULT_BRANCH_SLUG. Prefer POST /api/branches/[slug]/orders.
 */
export async function POST(req) {
  try {
    const defaultSlug = process.env.NEXT_PUBLIC_DEFAULT_BRANCH_SLUG;
    if (!defaultSlug) {
      return NextResponse.json(
        { error: "Bitte die Bestellseite über einen Standort-Link (/b/...) nutzen." },
        { status: 400 }
      );
    }

    const { branch, error: brErr } = await fetchBranchBySlug(defaultSlug);
    if (brErr || !branch) {
      return NextResponse.json({ error: "Standort nicht konfiguriert." }, { status: 404 });
    }

    const body = await req.json();
    const supabase = getSupabaseServerClient();
    const result = await placeCustomerOrder(supabase, { branchId: branch.id, body });

    if (!result.ok) {
      if (result.code === DUPLICATE_ORDER_CODE) {
        return NextResponse.json(
          {
            error: result.message,
            code: result.code,
            existingOrderNumber: result.existingOrderNumber,
            pickupDate: result.pickupDate
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ orderNumber: result.orderNumber, orderId: result.orderId });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
