import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHECKOUT_CONTEXT_RETENTION_DAYS = 45;

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

    // Clean up old checkout contexts that already have a persisted order.
    // This keeps the helper table small without risking active checkout flows.
    const checkoutCutoff = new Date(Date.now() - CHECKOUT_CONTEXT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { data: oldContexts, error: oldContextsError } = await supabase
      .from('checkout_contexts')
      .select('order_id')
      .lt('created_at', checkoutCutoff.toISOString());

    if (oldContextsError) {
      console.error('Error finding old checkout contexts:', oldContextsError);
      return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
    }

    const oldOrderIds = (oldContexts || []).map((ctx: { order_id: string }) => ctx.order_id);
    let cleanedCheckoutContexts = 0;

    if (oldOrderIds.length > 0) {
      const { data: existingOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .in('id', oldOrderIds);

      if (ordersError) {
        console.error('Error checking existing orders for checkout context cleanup:', ordersError);
        return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
      }

      const existingOrderIds = (existingOrders || []).map((order: { id: string }) => order.id);

      if (existingOrderIds.length > 0) {
        const { data: deletedCheckoutContexts, error: deleteCheckoutContextsError } = await supabase
          .from('checkout_contexts')
          .delete()
          .in('order_id', existingOrderIds)
          .lt('created_at', checkoutCutoff.toISOString())
          .select('order_id');

        if (deleteCheckoutContextsError) {
          console.error('Error deleting old checkout contexts:', deleteCheckoutContextsError);
          return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
        }

        cleanedCheckoutContexts = deletedCheckoutContexts?.length || 0;
      }
    }

    console.log(`✅ Cleaned up ${cleanedCheckoutContexts} old checkout contexts`);

    return NextResponse.json({
      success: true,
      cleanedReservations: cleanedCount,
      freedInventory,
      cleanedCheckoutContexts,
      checkoutContextRetentionDays: CHECKOUT_CONTEXT_RETENTION_DAYS,
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

    // Preview checkout context cleanup workload
    const checkoutCutoff = new Date(Date.now() - CHECKOUT_CONTEXT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { data: oldContexts, error: oldContextsError } = await supabase
      .from('checkout_contexts')
      .select('order_id')
      .lt('created_at', checkoutCutoff.toISOString());

    if (oldContextsError) {
      return NextResponse.json({ error: 'Failed to fetch checkout context status' }, { status: 500 });
    }

    const oldOrderIds = (oldContexts || []).map((ctx: { order_id: string }) => ctx.order_id);
    let readyToDeleteCheckoutContexts = 0;

    if (oldOrderIds.length > 0) {
      const { data: existingOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .in('id', oldOrderIds);

      if (ordersError) {
        return NextResponse.json({ error: 'Failed to fetch checkout context status' }, { status: 500 });
      }

      readyToDeleteCheckoutContexts = existingOrders?.length || 0;
    }

    return NextResponse.json({
      totalActiveReservations: reservations?.length || 0,
      reservationsByProduct,
      checkoutContextCleanup: {
        retentionDays: CHECKOUT_CONTEXT_RETENTION_DAYS,
        olderThanRetention: oldOrderIds.length,
        readyToDelete: readyToDeleteCheckoutContexts,
      },
    });
  } catch (error) {
    console.error('Reservations status API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 