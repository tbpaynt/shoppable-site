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
async function reserveInventory(
  supabase: any, 
  items: CartItemInRequest[], 
  userEmail: string, 
  reservationId: string,
  productMap?: Map<number, { id: number; name: string; price: number; shipping_cost?: number; stock?: number }>
) {
  // Clean up old reservations first
  await cleanupExpiredReservations(supabase);
  
  // Identify "same user" by session email (userEmail from create-payment-intent auth).
  // Check if this user already has active reservations for these exact items;
  // if so, we reuse that reservation group instead of creating a new one.
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  // Get all active reservations for this user (matched by user_email)
  const { data: userReservations, error: userResError } = await supabase
    .from('inventory_reservations')
    .select('reservation_group_id, product_id, quantity')
    .eq('user_email', userEmail)
    .gte('created_at', fifteenMinutesAgo);
  
  if (userResError) {
    console.error('Error checking user reservations:', userResError);
  }
  
  // Group user's existing reservations by reservation_group_id
  const userReservationsByGroup = new Map<string, Map<number, number>>();
  userReservations?.forEach((res: any) => {
    if (!userReservationsByGroup.has(res.reservation_group_id)) {
      userReservationsByGroup.set(res.reservation_group_id, new Map());
    }
    const groupMap = userReservationsByGroup.get(res.reservation_group_id)!;
    groupMap.set(res.product_id, (groupMap.get(res.product_id) || 0) + res.quantity);
  });
  
  // Check if any existing reservation group matches the current items exactly
  let existingReservationGroupId: string | null = null;
  for (const [groupId, groupItems] of userReservationsByGroup.entries()) {
    let matches = true;
    for (const item of items) {
      const reservedQty = groupItems.get(item.id) || 0;
      if (reservedQty !== item.quantity) {
        matches = false;
        break;
      }
    }
    // Also check that we're not missing any items
    if (matches && groupItems.size === items.length) {
      existingReservationGroupId = groupId;
      break;
    }
  }
  
  // If we found a matching reservation, reuse it
  if (existingReservationGroupId) {
    console.log(`[Reservation] Reusing existing reservation group ${existingReservationGroupId} for user ${userEmail}`);
    // Update the reservation timestamps to extend the expiry
    await supabase
      .from('inventory_reservations')
      .update({ created_at: new Date().toISOString() })
      .eq('reservation_group_id', existingReservationGroupId);
    
    // Return the existing reservation group ID (caller should use this instead of creating new one)
    return existingReservationGroupId;
  }
  
  // No matching reservation found - proceed with new reservation
  // Check current stock and existing reservations (excluding this user's own reservations)
  for (const item of items) {
    // Get current stock
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', item.id)
      .single();

    if (productError || !product) {
      const productName = productMap?.get(item.id)?.name || `Product ${item.id}`;
      throw new Error(`${productName} (ID: ${item.id}) not found`);
    }

    // Get current reservations for this product (excluding expired ones and this user's own reservations)
    const { data: reservations, error: reservationsError } = await supabase
      .from('inventory_reservations')
      .select('quantity, user_email')
      .eq('product_id', item.id)
      .gte('created_at', fifteenMinutesAgo);

    if (reservationsError) {
      const productName = productMap?.get(item.id)?.name || `Product ${item.id}`;
      throw new Error(`Failed to check reservations for ${productName} (ID: ${item.id})`);
    }

    // Calculate reserved quantity, excluding this user's own reservations for this item
    // (since they're essentially already "reserved" by them)
    const reservedQuantity = reservations?.reduce((sum: number, r: any) => {
      // Exclude this user's own reservations - they're already "holding" these items
      if (r.user_email === userEmail) {
        return sum; // Don't count their own reservation against them
      }
      return sum + r.quantity;
    }, 0) || 0;
    
    const availableStock = (product.stock || 0) - reservedQuantity;

    if (item.quantity > availableStock) {
      // Get product name from productMap if available
      const productName = productMap?.get(item.id)?.name || `Product ${item.id}`;
      
      // Check if this user has their own reservation that's blocking them
      const userReservedQty = reservations?.find((r: any) => r.user_email === userEmail)?.quantity || 0;
      if (userReservedQty > 0 && userReservedQty === item.quantity) {
        // They have a reservation for this exact quantity - this shouldn't happen with our new logic
        // but provide a helpful message
        throw new Error(`Your previous checkout session for "${productName}" is still active. Please complete that checkout or wait a few minutes for it to expire.`);
      }
      
      throw new Error(`Insufficient stock for "${productName}" (ID: ${item.id}). Available: ${availableStock}, Requested: ${item.quantity}. This item is already being checked out by another customer.`);
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
  
  return reservationId; // Return the new reservation ID
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
    let addressTo = body?.address;
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

    // ───────────────────────────────────────────────
    // 3a. **CRITICAL: Ensure we have a shipping address**
    // If address not provided in cart, try to fetch user's default saved address
    // ───────────────────────────────────────────────
    if (!addressTo || !addressTo.name || !addressTo.street1 || !addressTo.city || !addressTo.state || !addressTo.zip) {
      console.log('[Payment Intent] No address provided in cart, checking for saved default address...');
      
      // Fetch user's default saved address
      const { data: savedAddresses, error: addressError } = await supabase
        .from('shipping_addresses')
        .select('name, street1, street2, city, state, zip, country')
        .eq('user_email', session.user.email)
        .eq('is_default', true)
        .limit(1)
        .single();

      if (addressError || !savedAddresses) {
        // If no default, try to get any saved address
        const { data: anyAddress } = await supabase
          .from('shipping_addresses')
          .select('name, street1, street2, city, state, zip, country')
          .eq('user_email', session.user.email)
          .limit(1)
          .single();

        if (anyAddress) {
          console.log('[Payment Intent] Using first saved address as fallback');
          addressTo = {
            name: anyAddress.name,
            street1: anyAddress.street1,
            street2: anyAddress.street2 || undefined,
            city: anyAddress.city,
            state: anyAddress.state,
            zip: anyAddress.zip,
            country: anyAddress.country || 'US',
          };
        } else {
          console.error('[Payment Intent] No shipping address available - neither from cart nor saved addresses');
          return NextResponse.json({ 
            error: "Shipping address is required. Please enter a shipping address or save one in your profile." 
          }, { status: 400 });
        }
      } else {
        console.log('[Payment Intent] Using saved default address');
        addressTo = {
          name: savedAddresses.name,
          street1: savedAddresses.street1,
          street2: savedAddresses.street2 || undefined,
          city: savedAddresses.city,
          state: savedAddresses.state,
          zip: savedAddresses.zip,
          country: savedAddresses.country || 'US',
        };
      }
    }

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
    const newReservationId = uuidv4();
    
    let reservationId: string;
    try {
      // reserveInventory may return an existing reservation ID if user already has one
      const result = await reserveInventory(supabase, items, session.user.email, newReservationId, productMap);
      reservationId = result || newReservationId; // Use returned ID or fallback to new one
    } catch (reservationError) {
      console.error("Inventory reservation failed:", reservationError);
      return NextResponse.json({ 
        error: (reservationError as Error).message 
      }, { status: 409 }); // 409 Conflict for stock issues
    }

    // ───────────────────────────────────────────────
    // 5. Calculate total from verified prices (in cents)
    // ───────────────────────────────────────────────
    // If a flat shipping rate is provided, don't include per-item shipping costs
    // Otherwise, use per-item shipping costs as fallback
    const useFlatShipping = shipAmount !== undefined;
    
    const amountInCents = items.reduce((sum, item) => {
      const product = productMap.get(item.id)!;
      // Only include per-item shipping if we're NOT using flat shipping
      const perItemTotal = useFlatShipping 
        ? product.price 
        : product.price + (product.shipping_cost || 0);
      return sum + Math.round(perItemTotal * 100) * item.quantity;
    }, 0);

    let totalInCents = amountInCents;
    // Add flat shipping rate if provided (even if 0 for free shipping)
    if (useFlatShipping) {
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