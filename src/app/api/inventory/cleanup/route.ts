import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    console.log('🧹 Manual cleanup of expired inventory reservations triggered');
    
    // Clean up expired reservations (older than 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('inventory_reservations')
      .delete()
      .lt('created_at', fifteenMinutesAgo.toISOString())
      .select('id, product_id, quantity');

    if (error) {
      console.error('Error cleaning up reservations:', error);
      return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
    }

    const cleanedCount = data?.length || 0;
    const freedInventory = data?.reduce((acc: Record<number, number>, reservation: any) => {
      acc[reservation.product_id] = (acc[reservation.product_id] || 0) + reservation.quantity;
      return acc;
    }, {}) || {};

    console.log(`✅ Cleaned up ${cleanedCount} expired reservations`);
    console.log('📦 Freed inventory:', freedInventory);

    return NextResponse.json({
      success: true,
      cleanedReservations: cleanedCount,
      freedInventory
    });
  } catch (error) {
    console.error('Cleanup API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Get current reservations status
    const { data: reservations, error } = await supabase
      .from('inventory_reservations')
      .select('product_id, quantity, created_at, user_email')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
    }

    // Group by product
    const reservationsByProduct = reservations?.reduce((acc: Record<number, any>, res: any) => {
      if (!acc[res.product_id]) {
        acc[res.product_id] = {
          totalReserved: 0,
          reservations: []
        };
      }
      acc[res.product_id].totalReserved += res.quantity;
      acc[res.product_id].reservations.push({
        quantity: res.quantity,
        createdAt: res.created_at,
        userEmail: res.user_email
      });
      return acc;
    }, {}) || {};

    return NextResponse.json({
      totalActiveReservations: reservations?.length || 0,
      reservationsByProduct
    });
  } catch (error) {
    console.error('Reservations status API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 