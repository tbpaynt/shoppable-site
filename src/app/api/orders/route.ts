import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, created_at, total_amount, status, user_email, order_items(id, name, quantity, price)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
} 