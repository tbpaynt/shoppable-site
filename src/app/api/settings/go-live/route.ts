import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const [goLiveData, messageData] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "go_live_time").single(),
    supabase.from("settings").select("value").eq("key", "countdown_message").single()
  ]);
  
  if (goLiveData.error) return NextResponse.json({ error: goLiveData.error.message }, { status: 500 });
  
  return NextResponse.json({ 
    goLiveTime: goLiveData.data?.value,
    countdownMessage: messageData.data?.value || ""
  });
}

export async function POST(request: Request) {
  const { goLiveTime, countdownMessage } = await request.json();
  
  const promises = [];
  
  if (goLiveTime !== undefined) {
    promises.push(
      supabase.from("settings").upsert({ key: "go_live_time", value: goLiveTime })
    );
  }
  
  if (countdownMessage !== undefined) {
    promises.push(
      supabase.from("settings").upsert({ key: "countdown_message", value: countdownMessage || "" })
    );
  }
  
  const results = await Promise.all(promises);
  const errors = results.filter(r => r.error);
  
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].error?.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true });
} 