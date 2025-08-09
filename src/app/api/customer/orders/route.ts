import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated session
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch orders for the authenticated user using service role
    const { data, error } = await supabase
      .from('orders')
      .select('id, created_at, total_amount, ship_cost, tax_amount, status, tracking_number, label_url, order_items(id, name, price, quantity)')
      .eq('user_email', session.user.email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customer orders:', error);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in customer orders API:', error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}