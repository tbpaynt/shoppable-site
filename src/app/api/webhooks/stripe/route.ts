import { NextRequest, NextResponse } from 'next/server';
import { getStripeServer } from '../../../../utils/stripe';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createShippoOrder } from '../../../../utils/shippo';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

export async function POST(request: NextRequest) {
  const stripe = getStripeServer();
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig!, endpointSecret);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Webhook signature verification failed:', error.message);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log('🔥 WEBHOOK: Processing payment success for:', paymentIntent.id);
  console.log('🔥 WEBHOOK: Full metadata:', paymentIntent.metadata);
  
  const {
    orderId,
    userEmail,
    items,
    ship_cost,
    tax_amount,
    address_to,
    reservationId,
  } = paymentIntent.metadata as any;
  
  console.log('🔥 WEBHOOK: Parsed metadata:', { orderId, userEmail, items: !!items, address_to: !!address_to });
  
  if (!userEmail || !items || !orderId) {
    console.error('❌ WEBHOOK: Missing required metadata in payment intent');
    return;
  }
  
  // Parse items from metadata
  const orderItems: OrderItem[] = JSON.parse(items);
  
  // Insert order record
  const { error: orderErr } = await supabase
    .from('orders')
    .insert({
      id: orderId,
      user_email: userEmail,
      total_amount: paymentIntent.amount / 100,
      ship_cost: ship_cost ? Number(ship_cost) : null,
      tax_amount: tax_amount ? Number(tax_amount) : null,
      status: 'paid',
      address_to: address_to ? JSON.parse(address_to) : null,
    });
  if (orderErr) {
    console.error('Insert order error', orderErr);
  }

  // Create order items
  const orderItemsData = orderItems.map((item: OrderItem) => ({
    order_id: orderId,
    product_id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemsData);

  if (itemsError) throw itemsError;

  // **CRITICAL: Final stock validation before processing**
  // Fetch all needed product info in a single query (stock + weight)
  const { data: productsData, error: productsErr } = await supabase
    .from('products')
    .select('id, stock, weight_oz')
    .in('id', orderItems.map((it) => it.id));

  if (productsErr) {
    console.error('Error fetching products data', productsErr);
    throw new Error('Failed to fetch product data');
  }

  const productMap = new Map<number, { stock: number | null; weight_oz: number | null }>();
  (productsData || []).forEach((p) => productMap.set(p.id, { stock: p.stock, weight_oz: p.weight_oz }));
  
  // Final stock validation - reject payment if insufficient stock
  for (const item of orderItems) {
    const prodInfo = productMap.get(item.id);
    const currentStock = prodInfo?.stock ?? 0;
    if (currentStock < item.quantity) {
      console.error(`❌ CRITICAL: Insufficient stock for product ${item.id}. Available: ${currentStock}, Requested: ${item.quantity}`);
      throw new Error(`Insufficient stock for product ${item.id}`);
    }
  }

  // Update stock atomically
  for (const item of orderItems) {
    const prodInfo = productMap.get(item.id);
    const currentStock = prodInfo?.stock ?? 0;
    const newStock = Math.max(currentStock - item.quantity, 0);
    
    const { error: stockError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', item.id);

    if (stockError) {
      console.error('Error updating stock for product:', item.id, stockError);
      throw new Error(`Failed to update stock for product ${item.id}`);
    }
  }

  // Clean up inventory reservations after successful stock decrement
  if (reservationId) {
    const { error: cleanupError } = await supabase
      .from('inventory_reservations')
      .delete()
      .eq('reservation_group_id', reservationId);
    
    if (cleanupError) {
      console.error('Error cleaning up reservations:', cleanupError);
      // Don't throw here as the main payment already succeeded
    } else {
      console.log('✅ Cleaned up inventory reservations for:', reservationId);
    }
  }

  // Create Shippo order so it shows up in Shippo dashboard
  console.log('🔥 WEBHOOK: About to create Shippo order, address_to:', address_to);
  try {
    if (address_to) {
      console.log('🔥 WEBHOOK: Creating Shippo order...');
      const parsedAddress = JSON.parse(address_to);
      console.log('🔥 WEBHOOK: Parsed address:', parsedAddress);
      
      const lineItems = orderItems.map((item) => {
        const prodInfo = productMap.get(item.id);
        const weight = prodInfo?.weight_oz ?? 4; // Default to 4 oz if no weight specified
        const lineItem = {
          title: item.name,
          quantity: item.quantity,
          total_price: (item.price * item.quantity).toFixed(2), // Fix: multiply by quantity
          currency: 'USD',
          weight: weight,
          weight_unit: 'oz',
        };
        console.log('🔥 WEBHOOK: Line item:', lineItem);
        return lineItem;
      });

      console.log('🔥 WEBHOOK: About to call createShippoOrder with:', {
        orderNumber: orderId.toString(),
        addressTo: parsedAddress,
        lineItemsCount: lineItems.length,
        totalPrice: paymentIntent.amount / 100,
        shippingCost: ship_cost ? Number(ship_cost) : undefined,
        taxAmount: tax_amount ? Number(tax_amount) : undefined,
      });

      const shippoResult = await createShippoOrder({
        orderNumber: orderId.toString(),
        addressTo: parsedAddress,
        lineItems,
        totalPrice: paymentIntent.amount / 100,
        shippingCost: ship_cost ? Number(ship_cost) : undefined,
        taxAmount: tax_amount ? Number(tax_amount) : undefined,
      });
      
      console.log('✅ Shippo order created successfully:', shippoResult?.object_id || 'created');
      console.log('✅ Full Shippo result:', JSON.stringify(shippoResult, null, 2));
    } else {
      console.log('❌ WEBHOOK: No address_to provided, skipping Shippo order creation');
    }
  } catch (e) {
    console.error('❌ Failed to create Shippo order - Full error:', e);
    console.error('❌ Error message:', (e as Error)?.message);
    console.error('❌ Error stack:', (e as Error)?.stack);
  }

  // Note: Automatic label purchasing disabled - orders will appear in Shippo dashboard
  // for manual label creation. To re-enable automatic labels, uncomment the section below.
  console.log('✅ Order created in Shippo for manual label processing:', orderId);

  console.log(`Payment succeeded for order ${orderId}`);
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log(`❌ Payment failed for payment intent ${paymentIntent.id}`);
  
  const { reservationId } = paymentIntent.metadata as any;
  
  // Clean up inventory reservations on payment failure
  if (reservationId) {
    const { error: cleanupError } = await supabase
      .from('inventory_reservations')
      .delete()
      .eq('reservation_group_id', reservationId);
    
    if (cleanupError) {
      console.error('Error cleaning up failed payment reservations:', cleanupError);
    } else {
      console.log('✅ Cleaned up reservations for failed payment:', reservationId);
    }
  }
  
  // You can add additional logic here like sending failure notifications
} 