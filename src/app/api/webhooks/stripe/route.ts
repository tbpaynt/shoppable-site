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

const COMBINE_ORDERS_WINDOW_MINUTES = 30;

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

/** Normalize address for comparison (same customer, same address = combinable) */
function normalizeAddressKey(addr: { street1?: string; city?: string; state?: string; zip?: string } | null): string {
  if (!addr) return '';
  const s = (v: string | undefined) => String(v ?? '').trim().toLowerCase();
  return [s(addr.street1), s(addr.city), s(addr.state), s(addr.zip)].join('|');
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

  // Create Shippo order (single or combined with other recent orders to same address)
  const parsedAddress = address_to ? JSON.parse(address_to) as { name?: string; street1: string; city: string; state: string; zip: string; country?: string } : null;
  try {
    if (!parsedAddress) {
      console.log('❌ WEBHOOK: No address_to provided, skipping Shippo order creation');
    } else {
      const addressKey = normalizeAddressKey(parsedAddress);
      const thirtyMinutesAgo = new Date(Date.now() - COMBINE_ORDERS_WINDOW_MINUTES * 60 * 1000).toISOString();

      // Find paid orders for this customer with no Shippo order yet, within the time window
      const { data: candidateOrders, error: fetchErr } = await supabase
        .from('orders')
        .select('id, address_to, total_amount, ship_cost, tax_amount')
        .eq('user_email', userEmail)
        .eq('status', 'paid')
        .is('shippo_order_id', null)
        .gte('created_at', thirtyMinutesAgo);

      if (fetchErr) {
        console.error('Error fetching combinable orders:', fetchErr);
        throw fetchErr;
      }

      // Same address only: compare normalized street/city/state/zip
      const combinableOrders = (candidateOrders || []).filter((o) => {
        const addr = typeof o.address_to === 'string' ? JSON.parse(o.address_to) : o.address_to;
        return normalizeAddressKey(addr) === addressKey;
      });

      const orderIds = combinableOrders.map((o: { id: string }) => o.id);
      const isCombined = orderIds.length > 1;

      let lineItems: { title: string; quantity: number; total_price: string; currency: string; weight: number; weight_unit: string }[];
      let totalPrice: number;
      let totalShipCost: number | undefined;
      let totalTaxAmount: number | undefined;

      if (isCombined) {
        // Fetch all order_items for combinable orders
        const { data: allItems, error: itemsErr } = await supabase
          .from('order_items')
          .select('order_id, product_id, name, price, quantity')
          .in('order_id', orderIds);

        if (itemsErr || !allItems?.length) {
          console.error('Error fetching order items for combined order:', itemsErr);
          throw new Error('Failed to fetch order items for combined shipment');
        }

        const productIds = [...new Set(allItems.map((i: { product_id: number }) => i.product_id))];
        const { data: combinedProducts } = await supabase
          .from('products')
          .select('id, weight_oz')
          .in('id', productIds);
        const weightMap = new Map<number, number>();
        (combinedProducts || []).forEach((p: { id: number; weight_oz: number | null }) => weightMap.set(p.id, p.weight_oz ?? 4));

        // Aggregate by product_id: same product from multiple orders -> one line
        const byProduct = new Map<number, { name: string; quantity: number; totalPrice: number; weight: number }>();
        for (const row of allItems as { product_id: number; name: string; price: number; quantity: number }[]) {
          const existing = byProduct.get(row.product_id);
          const qty = row.quantity;
          const lineTotal = row.price * qty;
          const weight = weightMap.get(row.product_id) ?? 4;
          if (existing) {
            existing.quantity += qty;
            existing.totalPrice += lineTotal;
          } else {
            byProduct.set(row.product_id, { name: row.name, quantity: qty, totalPrice: lineTotal, weight });
          }
        }

        lineItems = Array.from(byProduct.entries()).map(([, v]) => ({
          title: v.name,
          quantity: v.quantity,
          total_price: v.totalPrice.toFixed(2),
          currency: 'USD',
          weight: v.weight,
          weight_unit: 'oz',
        }));

        totalPrice = combinableOrders.reduce((sum: number, o: { total_amount?: number }) => sum + (Number(o.total_amount) || 0), 0);
        totalShipCost = combinableOrders.reduce((sum: number, o: { ship_cost?: number | null }) => sum + (Number(o.ship_cost) || 0), 0) || undefined;
        totalTaxAmount = combinableOrders.reduce((sum: number, o: { tax_amount?: number | null }) => sum + (Number(o.tax_amount) || 0), 0) || undefined;

        console.log('🔥 WEBHOOK: Combining', orderIds.length, 'orders into one Shippo order:', orderIds);
      } else {
        // Single order: use current payment data
        lineItems = orderItems.map((item) => {
          const weight = productMap.get(item.id)?.weight_oz ?? 4;
          return {
            title: item.name,
            quantity: item.quantity,
            total_price: (item.price * item.quantity).toFixed(2),
            currency: 'USD',
            weight: weight,
            weight_unit: 'oz',
          };
        });
        totalPrice = paymentIntent.amount / 100;
        totalShipCost = ship_cost ? Number(ship_cost) : undefined;
        totalTaxAmount = tax_amount ? Number(tax_amount) : undefined;
      }

      const orderNumber = isCombined ? `combined-${orderIds.join('-')}` : orderId.toString();
      console.log('🔥 WEBHOOK: Creating Shippo order:', { orderNumber, lineItemsCount: lineItems.length, totalPrice, orderIds });

      const shippoResult = await createShippoOrder({
        orderNumber,
        addressTo: parsedAddress,
        lineItems,
        totalPrice,
        shippingCost: totalShipCost,
        taxAmount: totalTaxAmount,
      });

      const shippoOrderId = (shippoResult as { object_id?: string })?.object_id;
      if (shippoOrderId) {
        const { error: updateErr } = await supabase
          .from('orders')
          .update({ shippo_order_id: shippoOrderId })
          .in('id', orderIds);
        if (updateErr) {
          console.error('Failed to set shippo_order_id on orders:', updateErr);
        } else {
          console.log('✅ Set shippo_order_id on orders:', orderIds.length, orderIds);
        }
      }

      console.log('✅ Shippo order created:', shippoOrderId || 'created', isCombined ? '(combined)' : '');
    }
  } catch (e) {
    console.error('❌ Failed to create Shippo order:', e);
  }

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