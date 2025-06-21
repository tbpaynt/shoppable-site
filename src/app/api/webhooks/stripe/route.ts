import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '../../../../utils/stripe';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import Stripe from 'stripe';

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
  const { customerEmail, items } = paymentIntent.metadata;
  
  if (!customerEmail || !items) {
    console.error('Missing required metadata in payment intent');
    return;
  }
  
  // Parse items from metadata
  const orderItems: OrderItem[] = JSON.parse(items);
  
  // Create or get user
  let { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', customerEmail)
    .single();

  if (!user) {
    // Create new user if doesn't exist
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({ email: customerEmail })
      .select('id')
      .single();
    
    if (userError) throw userError;
    user = newUser;
  }

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      stripe_payment_intent_id: paymentIntent.id,
      total_amount: paymentIntent.amount / 100, // Convert from cents
      status: 'paid'
    })
    .select('id')
    .single();

  if (orderError) throw orderError;

  // Create order items
  const orderItemsData = orderItems.map((item: OrderItem) => ({
    order_id: order.id,
    product_id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemsData);

  if (itemsError) throw itemsError;

  // Update product stock
  for (const item of orderItems) {
    const { error: stockError } = await supabase
      .from('products')
      .update({ stock: supabase.rpc('decrement_stock', { product_id: item.id, quantity: item.quantity }) })
      .eq('id', item.id);

    if (stockError) {
      console.error('Error updating stock for product:', item.id, stockError);
    }
  }

  console.log(`Payment succeeded for order ${order.id}`);
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log(`Payment failed for payment intent ${paymentIntent.id}`);
  // You can add additional logic here like sending failure notifications
} 