import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Create a Supabase client with service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all users from the users table using service role (bypasses RLS)
    const { data: customers, error } = await supabase
      .from('users')
      .select('id, email, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customers:', error);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }

    if (!customers || customers.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch customer names from multiple sources (priority order):
    // 1. Most recent order's address_to.name (from cart form - recipient field)
    // 2. Default shipping address name
    // 3. Most recent shipping address name
    const userEmails = customers.map(c => c.email).filter(Boolean);
    
    let nameMap = new Map<string, string | null>();
    if (userEmails.length > 0) {
      // Priority 1: Get name from most recent order's address_to field (from cart form)
      const { data: orders } = await supabase
        .from('orders')
        .select('user_email, address_to, created_at')
        .in('user_email', userEmails)
        .not('address_to', 'is', null)
        .order('created_at', { ascending: false });

      if (orders) {
        // Group orders by email and get the most recent one for each
        const ordersByEmail = new Map<string, typeof orders[0]>();
        orders.forEach(order => {
          if (order.user_email && !ordersByEmail.has(order.user_email)) {
            ordersByEmail.set(order.user_email, order);
          }
        });

        // Extract name from address_to for each customer
        ordersByEmail.forEach((order, email) => {
          if (order.address_to) {
            try {
              const address = typeof order.address_to === 'string' 
                ? JSON.parse(order.address_to) 
                : order.address_to;
              if (address?.name) {
                nameMap.set(email, address.name);
              }
            } catch {
              // If parsing fails, continue to next source
            }
          }
        });
      }

      // Priority 2: Get default shipping addresses for customers without names from orders
      const customersWithoutName = customers
        .filter(c => c.email && !nameMap.has(c.email))
        .map(c => c.email);

      if (customersWithoutName.length > 0) {
        const { data: defaultAddresses } = await supabase
          .from('shipping_addresses')
          .select('user_email, name, is_default')
          .in('user_email', customersWithoutName)
          .eq('is_default', true);

        if (defaultAddresses) {
          defaultAddresses.forEach(addr => {
            if (addr.name && !nameMap.has(addr.user_email)) {
              nameMap.set(addr.user_email, addr.name);
            }
          });
        }

        // Priority 3: Get most recent shipping address for customers still without names
        const customersStillWithoutName = customers
          .filter(c => c.email && !nameMap.has(c.email))
          .map(c => c.email);

        if (customersStillWithoutName.length > 0) {
          for (const email of customersStillWithoutName) {
            const { data: addresses } = await supabase
              .from('shipping_addresses')
              .select('name, created_at')
              .eq('user_email', email)
              .order('created_at', { ascending: false })
              .limit(1);

            if (addresses && addresses.length > 0 && addresses[0].name) {
              nameMap.set(email, addresses[0].name);
            }
          }
        }
      }
    }

    // Add customer_name to each customer
    const customersWithNames = customers.map(customer => ({
      ...customer,
      customer_name: customer.email ? nameMap.get(customer.email) || null : null
    }));

    console.log('Fetched customers:', customersWithNames); // Debug log
    return NextResponse.json(customersWithNames || []);
  } catch (error) {
    console.error('Error in customers API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 