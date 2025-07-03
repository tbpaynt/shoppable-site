import { NextRequest, NextResponse } from 'next/server';
import { getStripeServer } from '../../../../utils/stripe';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { purchaseLabel, createShippoOrder } from '../../../../utils/shippo';

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
  const {
    orderId,
    userEmail,
    items,
    shippo_rate_id,
    ship_cost,
    tax_amount,
    address_to,
  } = paymentIntent.metadata as any;
  
  if (!userEmail || !items || !orderId) {
    console.error('Missing required metadata in payment intent');
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

  // Fetch all needed product info in a single query (stock + weight)
  const { data: productsData, error: productsErr } = await supabase
    .from('products')
    .select('id, stock, weight_oz')
    .in('id', orderItems.map((it) => it.id));

  if (productsErr) {
    console.error('Error fetching products data', productsErr);
  }

  const productMap = new Map<number, { stock: number | null; weight_oz: number | null }>();
  (productsData || []).forEach((p) => productMap.set(p.id, { stock: p.stock, weight_oz: p.weight_oz }));

  for (const item of orderItems) {
    const prodInfo = productMap.get(item.id);
    const currentStock = prodInfo?.stock ?? null;
    if (currentStock !== null) {
      const newStock = Math.max(currentStock - item.quantity, 0);
      const { error: stockError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', item.id);

      if (stockError) {
        console.error('Error updating stock for product:', item.id, stockError);
      }
    }
  }

  // Create Shippo order so it shows up in Shippo dashboard
  try {
    if (address_to) {
      const lineItems = orderItems.map((item) => {
        const prodInfo = productMap.get(item.id);
        return {
          title: item.name,
          quantity: item.quantity,
          total_price: item.price.toFixed(2),
          currency: 'USD',
          weight: prodInfo?.weight_oz ?? undefined,
          weight_unit: prodInfo?.weight_oz ? 'oz' : undefined,
        } as any;
      });

      await createShippoOrder({
        orderNumber: orderId.toString(),
        addressTo: JSON.parse(address_to),
        lineItems,
        totalPrice: paymentIntent.amount / 100,
        shippingCost: ship_cost ? Number(ship_cost) : undefined,
        taxAmount: tax_amount ? Number(tax_amount) : undefined,
      });
    }
  } catch (e) {
    console.error('Failed to create Shippo order', e);
  }

  // Purchase label if rate id present
  if (shippo_rate_id) {
    try {
      const label = await purchaseLabel(shippo_rate_id);
      await supabase
        .from('orders')
        .update({ tracking_number: label.trackingNumber, label_url: label.labelUrl })
        .eq('id', orderId);
    } catch (e) {
      console.error('Shippo purchase failed', e);
    }
  }

  console.log(`Payment succeeded for order ${orderId}`);
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log(`Payment failed for payment intent ${paymentIntent.id}`);
  // You can add additional logic here like sending failure notifications
} 