import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

console.log("[API] SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("[API] SUPABASE_SERVICE_ROLE_KEY present:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("SERVICE ROLE KEY VALUE:", process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log("[API] GET /api/products called");
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("id", { ascending: true });
    console.log("[API] Supabase data:", data);
    console.log("[API] Supabase error:", error);
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "Error fetching products", details: error }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const product = await request.json();
    const { data, error } = await supabase
      .from("products")
      .insert([product])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ error: "Error creating product" }, { status: 500 });
  }
} 