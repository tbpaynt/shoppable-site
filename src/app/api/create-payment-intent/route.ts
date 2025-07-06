import { NextRequest, NextResponse } from "next/server";
import { getStripeServer } from "../../../utils/stripe";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { auth } from "../../../../auth";

interface CartItemInRequest {
  id: number;
  quantity: number;
}

// Get or create Stripe customer
async function getOrCreateStripeCustomer(userEmail: string, userName?: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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

export async function POST(request: NextRequest) {
  try {
    // ───────────────────────────────────────────────
    // 1. Authorise user (must be logged in)
    // ───────────────────────────────────────────────
    const session = await auth();
    if (!session?.user?.email) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }

    // ───────────────────────────────────────────────
    // 2. Parse body
    // ───────────────────────────────────────────────
    const body = await request.json();
    const items: CartItemInRequest[] | undefined = body?.items;
    const shipAmount: number | undefined = body?.shipAmount;
    const rateId: string | undefined = body?.rateId;
    const addressTo = body?.address;
    const taxAmount: number | undefined = body?.taxAmount;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    // ───────────────────────────────────────────────
    // 3. Fetch verified product data from DB
    // ───────────────────────────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const productIds = items.map((i) => i.id);

    const { data: productsFromDb, error } = await supabase
      .from("products")
      .select("id, name, price, shipping_cost")
      .in("id", productIds);

    if (error) {
      console.error("Supabase error while fetching products", error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // Ensure every requested item exists in DB
    const productMap = new Map<number, { id: number; name: string; price: number; shipping_cost?: number }>();
    productsFromDb?.forEach((p) => productMap.set(p.id, p as any));

    for (const reqItem of items) {
      if (!productMap.has(reqItem.id)) {
        return NextResponse.json({ error: `Invalid product id ${reqItem.id}` }, { status: 400 });
      }
    }

    // ───────────────────────────────────────────────
    // 4. Calculate total from verified prices (in cents)
    // ───────────────────────────────────────────────
    const amountInCents = items.reduce((sum, item) => {
      const product = productMap.get(item.id)!;
      const perItemTotal = product.price + (product.shipping_cost || 0);
      return sum + Math.round(perItemTotal * 100) * item.quantity;
    }, 0);

    let totalInCents = amountInCents;
    if (shipAmount && shipAmount > 0) {
      totalInCents += Math.round(shipAmount * 100);
    }
    if (taxAmount && taxAmount > 0) {
      totalInCents += Math.round(taxAmount * 100);
    }

    if (totalInCents <= 0) {
      return NextResponse.json({ error: "Cart total is zero" }, { status: 400 });
    }

    // ───────────────────────────────────────────────
    // 5. Get or create Stripe customer ID
    // ───────────────────────────────────────────────
    const customerId = await getOrCreateStripeCustomer(
      session.user.email,
      session.user.name || undefined
    );
    console.log('Customer ID for payment intent:', customerId);

    // Debug: Check if customer has saved payment methods
    const { data: savedPaymentMethods } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_email', session.user.email);
    
    console.log('Saved payment methods for user:', savedPaymentMethods);

    // ───────────────────────────────────────────────
    // 6. Create PaymentIntent with customer ID
    // ───────────────────────────────────────────────
    const stripe = getStripeServer();

    const orderId = uuidv4();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: "usd",
      customer: customerId,
      metadata: {
        orderId,
        userEmail: session.user.email,
        items: JSON.stringify(
          items.map((i) => ({
            id: i.id,
            name: productMap.get(i.id)!.name,
            price: productMap.get(i.id)!.price,
            shipping_cost: productMap.get(i.id)!.shipping_cost || 0,
            quantity: i.quantity,
          }))
        ),
        ...(rateId ? { shippo_rate_id: rateId } : {}),
        ...(shipAmount ? { ship_cost: shipAmount } : {}),
        ...(addressTo ? { address_to: JSON.stringify(addressTo) } : {}),
        ...(taxAmount ? { tax_amount: taxAmount } : {}),
      },
      automatic_payment_methods: { enabled: true },
    });

    console.log('Payment intent created:', paymentIntent.id, 'with customer:', paymentIntent.customer);

    // ───────────────────────────────────────────────
    // 7. TODO: Insert a pending order row if you track orders in Supabase
    //    await supabase.from('orders').insert({...})
    // ───────────────────────────────────────────────

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, orderId });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error in create-payment-intent:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
} 