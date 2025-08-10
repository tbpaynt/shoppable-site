import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const productId = parseInt(resolvedParams.id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Upsert view record (insert if new, update last_seen if exists)
    const { error } = await supabase
      .from('product_views')
      .upsert({
        product_id: productId,
        session_id: sessionId,
        last_seen: new Date().toISOString()
      }, {
        onConflict: 'product_id,session_id'
      });

    if (error) {
      console.error('Error tracking product view:', error);
      return NextResponse.json({ error: "Failed to track view" }, { status: 500 });
    }

    // Clean up old views (older than 10 minutes)
    await supabase.rpc('cleanup_old_product_views');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in view tracking API:', error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}