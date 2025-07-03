import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCheapestRate } from "../../../../utils/shippo";

interface CartItem {
  id: number;
  quantity: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: CartItem[] | undefined = body?.items;
    const address = { ...body?.address };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items" }, { status: 400 });
    }
    if (!address || !address.street1 || !address.city || !address.state || !address.zip) {
      return NextResponse.json({ error: "Incomplete address" }, { status: 400 });
    }

    if (!address.country) address.country = "US";

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: products, error } = await supabase
      .from("products")
      .select("id, weight_oz")
      .in("id", items.map((i) => i.id));

    if (error) throw error;

    const weightMap = new Map<number, number>();
    products?.forEach((p) => weightMap.set(p.id, p.weight_oz || 0));

    let totalWeightOz = 0;
    for (const i of items) {
      const w = weightMap.get(i.id);
      if (w === undefined) {
        return NextResponse.json({ error: `Product ${i.id} weight missing` }, { status: 400 });
      }
      totalWeightOz += w * i.quantity;
    }

    const rate = await getCheapestRate(totalWeightOz, address);
    return NextResponse.json(rate);
  } catch (err: unknown) {
    console.error("Shipping quote error", err);
    const msg = (err as Error).message || "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
} 