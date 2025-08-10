import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Clean up old views first
    await supabase.rpc('cleanup_old_product_views');

    // Get current view counts for all products
    const { data, error } = await supabase
      .from('product_views')
      .select('product_id')
      .gte('last_seen', new Date(Date.now() - 10 * 60 * 1000).toISOString()); // Last 10 minutes

    if (error) {
      console.error('Error fetching view counts:', error);
      return NextResponse.json({ error: "Failed to fetch view counts" }, { status: 500 });
    }

    // Count views per product
    const viewCounts: Record<number, number> = {};
    data?.forEach(view => {
      const productId = view.product_id;
      viewCounts[productId] = (viewCounts[productId] || 0) + 1;
    });

    return NextResponse.json(viewCounts);
  } catch (error) {
    console.error('Error in view counts API:', error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}