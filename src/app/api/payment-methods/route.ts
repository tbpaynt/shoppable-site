import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { createClient } from '@supabase/supabase-js';
import { getStripeServer } from '../../../utils/stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Get or create Stripe customer
async function getOrCreateStripeCustomer(userEmail: string, userName?: string) {
  // Check if customer already exists in our database
  const { data: existingCustomer } = await supabase
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_email', userEmail)
    .single();

  if (existingCustomer) {
    return existingCustomer.stripe_customer_id;
  }

  // Create new Stripe customer
  const stripe = getStripeServer();
  const customer = await stripe.customers.create({
    email: userEmail,
    name: userName || undefined,
  });

  // Save to database
  await supabase
    .from('stripe_customers')
    .insert({
      user_email: userEmail,
      stripe_customer_id: customer.id,
    });

  return customer.id;
}

// GET - Retrieve user's payment methods
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: paymentMethods, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_email', session.user.email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch payment methods' }, { status: 500 });
    }

    return NextResponse.json({ paymentMethods: paymentMethods || [] });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create setup intent for adding new payment method
export async function POST() {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(
      session.user.email,
      session.user.name || undefined
    );

    // Create setup intent
    const stripe = getStripeServer();
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    return NextResponse.json({ 
      clientSecret: setupIntent.client_secret,
      customerId: customerId 
    });
  } catch (error) {
    console.error('Stripe error:', error);
    return NextResponse.json({ error: 'Failed to create setup intent' }, { status: 500 });
  }
}

// PUT - Confirm setup intent and save payment method
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { setupIntentId } = await request.json();

    if (!setupIntentId) {
      return NextResponse.json({ error: 'Setup intent ID required' }, { status: 400 });
    }

    // Retrieve the setup intent
    const stripe = getStripeServer();
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (setupIntent.status !== 'succeeded') {
      return NextResponse.json({ error: 'Setup intent not succeeded' }, { status: 400 });
    }

    // Get payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(setupIntent.payment_method as string);

    // Check if this is the user's first payment method (will be default)
    const { data: existingMethods } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('user_email', session.user.email);

    const isFirstMethod = !existingMethods || existingMethods.length === 0;

    // Save to database
    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        user_email: session.user.email,
        stripe_payment_method_id: paymentMethod.id,
        stripe_customer_id: setupIntent.customer as string,
        type: paymentMethod.type,
        last4: paymentMethod.card?.last4,
        brand: paymentMethod.card?.brand,
        exp_month: paymentMethod.card?.exp_month,
        exp_year: paymentMethod.card?.exp_year,
        is_default: isFirstMethod,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to save payment method' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      paymentMethod: data 
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove payment method
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentMethodId = searchParams.get('id');

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID required' }, { status: 400 });
    }

    // Get payment method from database
    const { data: paymentMethod, error: fetchError } = await supabase
      .from('payment_methods')
      .select('stripe_payment_method_id')
      .eq('id', paymentMethodId)
      .eq('user_email', session.user.email)
      .single();

    if (fetchError || !paymentMethod) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    }

    // Detach from Stripe
    const stripe = getStripeServer();
    await stripe.paymentMethods.detach(paymentMethod.stripe_payment_method_id);

    // Delete from database
    const { error: deleteError } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', paymentMethodId)
      .eq('user_email', session.user.email);

    if (deleteError) {
      console.error('Supabase error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete payment method' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 