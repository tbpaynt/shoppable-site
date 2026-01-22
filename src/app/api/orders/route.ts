import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, created_at, total_amount, status, user_email, address_to, order_items(id, name, quantity, price)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Extract customer names from multiple sources (priority order):
    // 1. Shipping address name from cart form (address_to.name)
    // 2. Users table name
    // 3. Saved shipping addresses (default address)
    if (orders && orders.length > 0) {
      const userEmails = [...new Set(orders.map(o => o.user_email).filter(Boolean))];
      
      // Fetch users table names
      let userMap = new Map<string, string | null>();
      if (userEmails.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("email, name")
          .in("email", userEmails);

        if (!usersError && users) {
          userMap = new Map(users.map(u => [u.email, u.name || null]));
        }
      }

      // Fetch saved shipping addresses (default addresses)
      let savedAddressMap = new Map<string, string | null>();
      if (userEmails.length > 0) {
        const { data: savedAddresses, error: addressesError } = await supabase
          .from("shipping_addresses")
          .select("user_email, name, is_default")
          .in("user_email", userEmails)
          .eq("is_default", true);

        if (!addressesError && savedAddresses) {
          savedAddressMap = new Map(savedAddresses.map(addr => [addr.user_email, addr.name || null]));
        }
      }

      // Add customer_name to each order with priority:
      // 1. address_to.name (from cart form)
      // 2. users.name
      // 3. saved shipping address name
      const ordersWithNames = orders.map(order => {
        let customerName: string | null = null;

        // Priority 1: Check shipping address from cart form
        if (order.address_to) {
          try {
            const address = typeof order.address_to === 'string' 
              ? JSON.parse(order.address_to) 
              : order.address_to;
            if (address?.name) {
              customerName = address.name;
            }
          } catch (e) {
            // If parsing fails, continue to next source
          }
        }

        // Priority 2: Check users table
        if (!customerName && order.user_email) {
          customerName = userMap.get(order.user_email) || null;
        }

        // Priority 3: Check saved shipping addresses
        if (!customerName && order.user_email) {
          customerName = savedAddressMap.get(order.user_email) || null;
        }

        return {
          ...order,
          customer_name: customerName
        };
      });

      return NextResponse.json(ordersWithNames);
    }

    // If no orders, return empty array
    return NextResponse.json([]);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: "Order ID and status are required" }, { status: 400 });
    }

    // Validate status values
    const validStatuses = ['paid', 'completed', 'processing', 'shipped'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error updating order status:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
} 