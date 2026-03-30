import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    const missing: string[] = [];
    if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    return { error: `Missing env: ${missing.join(", ")}` as const, client: null };
  }
  return { error: null as null, client: createClient(url, key) };
}

function errMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export async function GET() {
  try {
    const { error: envError, client } = getSupabaseServer();
    if (envError || !client) {
      console.error("[API] /api/products:", envError);
      return NextResponse.json({ error: "Server configuration", message: envError }, { status: 500 });
    }

    const { data, error } = await client
      .from("products")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("[API] Supabase products error:", error.message, error.code, error.details);
      return NextResponse.json(
        { error: "Database error", message: error.message, code: error.code },
        { status: 500 }
      );
    }
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Error fetching products", message: errMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { error: envError, client: supabase } = getSupabaseServer();
    if (envError || !supabase) {
      return NextResponse.json({ error: "Server configuration", message: envError }, { status: 500 });
    }
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