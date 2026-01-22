import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Get the authenticated session
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First get the user's order IDs
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('user_email', session.user.email);

    if (ordersError) {
      console.error('Error fetching user orders:', ordersError);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({});
    }

    const orderIds = orders.map(order => order.id);

    // Then fetch notification preferences for those orders
    const { data: prefs, error } = await supabase
      .from('notification_preferences')
      .select('order_id, email_notifications')
      .in('order_id', orderIds);

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

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated session
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, enabled } = body;

    if (!orderId || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: "Invalid request. orderId and enabled (boolean) are required." }, { status: 400 });
    }

    // Verify the order belongs to this user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .eq('user_email', session.user.email)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found or access denied" }, { status: 404 });
    }

    // Upsert notification preference
    // First try to find existing preference
    const { data: existing, error: findError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_email', session.user.email)
      .eq('order_id', orderId)
      .maybeSingle();

    let data, error;
    
    if (findError) {
      console.error('Error finding notification preference:', {
        message: findError.message,
        details: findError.details,
        hint: findError.hint,
        code: findError.code
      });
      
      // Check if table doesn't exist
      if (findError.code === '42P01' || findError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Notification preferences table does not exist. Please run database migrations.',
          code: findError.code
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: `Database error: ${findError.message || findError.code || 'Unknown error'}`,
        code: findError.code
      }, { status: 500 });
    }

    if (existing) {
      // Update existing
      const { data: updated, error: updateError } = await supabase
        .from('notification_preferences')
        .update({ email_notifications: enabled })
        .eq('user_email', session.user.email)
        .eq('order_id', orderId)
        .select()
        .single();
      data = updated;
      error = updateError;
    } else {
      // Insert new
      const { data: inserted, error: insertError } = await supabase
        .from('notification_preferences')
        .insert({
          user_email: session.user.email,
          order_id: orderId,
          email_notifications: enabled
        })
        .select()
        .single();
      data = inserted;
      error = insertError;
    }

    if (error) {
      console.error('Error upserting notification preference:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      let errorMessage = 'Failed to update notification preference';
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        errorMessage = 'Notification preferences table does not exist. Please run database migrations.';
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.details) {
        errorMessage = error.details;
      } else if (error.code) {
        errorMessage = `Database error (${error.code})`;
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        code: error.code,
        details: error.details
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      preference: data 
    });
  } catch (error: any) {
    console.error('Error in notification preferences POST API:', error);
    return NextResponse.json({ 
      error: error?.message || "Server error" 
    }, { status: 500 });
  }
}