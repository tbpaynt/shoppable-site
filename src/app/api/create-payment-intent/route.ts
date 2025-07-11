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

// Clean up expired reservations (older than 15 minutes)
async function cleanupExpiredReservations(supabase: any) {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  
  await supabase
    .from('inventory_reservations')
    .delete()
    .lt('created_at', fifteenMinutesAgo.toISOString());
}

// Reserve inventory for checkout
async function reserveInventory(supabase: any, items: CartItemInRequest[], userEmail: string, reservationId: string) {
  // Clean up old reservations first
  await cleanupExpiredReservations(supabase);
  
  // Check current stock and existing reservations
  for (const item of items) {
    // Get current stock
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', item.id)
      .single();

    if (productError || !product) {
      throw new Error(`Product ${item.id} not found`);
    }

    // Get current reservations for this product (excluding expired ones)
    const { data: reservations, error: reservationsError } = await supabase
      .from('inventory_reservations')
      .select('quantity')
      .eq('product_id', item.id)
      .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    if (reservationsError) {
      throw new Error(`Failed to check reservations for product ${item.id}`);
    }

    const reservedQuantity = reservations?.reduce((sum: number, r: any) => sum + r.quantity, 0) || 0;
    const availableStock = (product.stock || 0) - reservedQuantity;

    if (item.quantity > availableStock) {
      throw new Error(`Insufficient stock for "${item.id}". Available: ${availableStock}, Requested: ${item.quantity}`);
    }
  }

  // Create reservations for all items
  const reservationInserts = items.map(item => ({
    id: uuidv4(),
    reservation_group_id: reservationId,
    product_id: item.id,
    quantity: item.quantity,
    user_email: userEmail,
    created_at: new Date().toISOString()
  }));

  const { error: insertError } = await supabase
    .from('inventory_reservations')
    .insert(reservationInserts);

  if (insertError) {
    throw new Error(`Failed to reserve inventory: ${insertError.message}`);
  }
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
      .select("id, name, price, shipping_cost, stock")
      .in("id", productIds);

    if (error) {
      console.error("Supabase error while fetching products", error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // Ensure every requested item exists in DB
    const productMap = new Map<number, { id: number; name: string; price: number; shipping_cost?: number; stock?: number }>();
    productsFromDb?.forEach((p) => productMap.set(p.id, p as any));

    for (const reqItem of items) {
      if (!productMap.has(reqItem.id)) {
        return NextResponse.json({ error: `Invalid product id ${reqItem.id}` }, { status: 400 });
      }
    }

    // ───────────────────────────────────────────────
    // 4. **CRITICAL: Reserve inventory to prevent overselling**
    // ───────────────────────────────────────────────
    const reservationId = uuidv4();
    
    try {
      await reserveInventory(supabase, items, session.user.email, reservationId);
    } catch (reservationError) {
      console.error("Inventory reservation failed:", reservationError);
      return NextResponse.json({ 
        error: (reservationError as Error).message 
      }, { status: 409 }); // 409 Conflict for stock issues
    }

    // ───────────────────────────────────────────────
    // 5. Calculate total from verified prices (in cents)
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
    // 6. Get or create Stripe customer ID
    // ───────────────────────────────────────────────
    const customerId = await getOrCreateStripeCustomer(
      session.user.email,
      session.user.name || undefined
    );

    // ───────────────────────────────────────────────
    // 7. Create PaymentIntent with customer ID and reservation info
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
        reservationId, // Include reservation ID for cleanup
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

    // ───────────────────────────────────────────────
    // 8. Create CustomerSession to enable saved payment methods
    // ───────────────────────────────────────────────
    const customerSession = await stripe.customerSessions.create({
      customer: customerId,
      components: {
        payment_element: {
          enabled: true,
          features: {
            payment_method_redisplay: 'enabled',
          },
        },
      },
    });

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret, 
      customerSessionClientSecret: customerSession.client_secret,
      orderId 
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error in create-payment-intent:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
} 