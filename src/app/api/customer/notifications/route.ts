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

    // Fetch notification preferences for user's orders
    const { data: prefs, error } = await supabase
      .from('notification_preferences')
      .select('order_id, email_notifications')
      .in('order_id', 
        supabase
          .from('orders')
          .select('id')
          .eq('user_email', session.user.email)
      );

    if (error) {
      console.error('Error fetching notification preferences:', error);
      return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
    }

    // Convert to the expected format
    const prefsMap = (prefs || []).reduce((acc: Record<string, boolean>, pref: { order_id: string, email_notifications: boolean }) => {
      acc[pref.order_id] = pref.email_notifications;
      return acc;
    }, {});

    return NextResponse.json(prefsMap);
  } catch (error) {
    console.error('Error in notification preferences API:', error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}