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
      .select("id, weight_oz, price")
      .in("id", items.map((i) => i.id));

    if (error) throw error;

    const productMap = new Map<number, { weight_oz: number; price: number }>();
    products?.forEach((p) => productMap.set(p.id, { weight_oz: p.weight_oz || 0, price: p.price }));

    // Calculate total order value
    let totalOrderValue = 0;
    let totalWeightOz = 0;
    
    for (const i of items) {
      const product = productMap.get(i.id);
      if (!product) {
        return NextResponse.json({ error: `Product ${i.id} not found` }, { status: 400 });
      }
      totalOrderValue += product.price * i.quantity;
      totalWeightOz += product.weight_oz * i.quantity;
    }

    // Free shipping on orders $100+
    if (totalOrderValue >= 100) {
      return NextResponse.json({
        rateId: "free_shipping",
        provider: "Free Shipping",
        service: "Free Shipping on Orders $100+",
        amount: 0,
        currency: "USD"
      });
    }

    // Fallback to dynamic shipping for orders under $100
    const rate = await getCheapestRate(totalWeightOz, address);
    return NextResponse.json(rate);
  } catch (err: unknown) {
    console.error("Shipping quote error", err);
    const msg = (err as Error).message || "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
} 