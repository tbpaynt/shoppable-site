import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "go_live_time")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goLiveTime: data?.value });
}

export async function POST(request: Request) {
  const { goLiveTime } = await request.json();
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "go_live_time", value: goLiveTime });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
} 