import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  // Update all products to published: true
  const { error } = await supabase
    .from("products")
    .update({ published: true })
    .neq("published", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the updated product list
  const { data, error: fetchError } = await supabase
    .from("products")
    .select("*")
    .order("id", { ascending: true });

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  return NextResponse.json(data);
} 