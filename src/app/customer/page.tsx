"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useSession, signIn } from "next-auth/react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Order = {
  id: string;
  created_at: string;
  total_amount: number;
  ship_cost: number | null;
  tax_amount: number | null;
  order_items: { id: string; name: string; price: number; quantity: number }[];
  tracking_info?: {
    tracking_number?: string;
    delivered?: boolean;
    out_for_delivery?: boolean;
    in_transit?: boolean;
    shipped?: boolean;
    shipped_at?: string;
  };
  shipping_carrier?: { name: string; estimated_days?: number };
};

export default function CustomerPanel() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-2xl bg-gray-50 text-gray-900">
        Loading...
      </div>
    );
  }

  if (status !== "authenticated" || !session.user?.email) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <h1 className="text-3xl font-bold mb-4 text-gray-900">Please sign in to view your orders</h1>
        <button onClick={() => signIn("google") } className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Deals You Snagged</h1>
        <PurchaseHistory userEmail={session.user.email} />
      </div>
    </div>
  );
}

function PurchaseHistory({ userEmail }: { userEmail: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, created_at, total_amount, ship_cost, tax_amount, status, tracking_number, label_url, order_items(id, name, price, quantity)')
          .eq('user_email', userEmail)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(data || []);

        // Fetch notification preferences
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('order_id, email_notifications');

        if (prefs) {
          const prefsMap = prefs.reduce((acc: Record<string, boolean>, pref: { order_id: string, email_notifications: boolean }) => {
            acc[pref.order_id] = pref.email_notifications;
            return acc;
          }, {});
          setNotificationPreferences(prefsMap);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [userEmail]);

  const getTrackingStatus = (order: Order) => {
    if (!order.tracking_info) return 'Not Shipped';
    if (order.tracking_info.delivered) return 'Delivered';
    if (order.tracking_info.out_for_delivery) return 'Out for Delivery';
    if (order.tracking_info.in_transit) return 'In Transit';
    if (order.tracking_info.shipped) return 'Shipped';
    return 'Processing';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Delivered': return 'text-green-600';
      case 'Out for Delivery': return 'text-yellow-600';
      case 'In Transit': return 'text-blue-600';
      case 'Shipped': return 'text-blue-600';
      case 'Processing': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getTrackingUrl = (order: Order) => {
    if (!order.tracking_info?.tracking_number || !order.shipping_carrier) return null;
    const trackingNumber = order.tracking_info.tracking_number;
    const carrier = order.shipping_carrier.name.toLowerCase();
    switch (carrier) {
      case 'ups':
        return `https://www.ups.com/track?tracknum=${trackingNumber}`;
      case 'fedex':
        return `https://www.fedex.com/tracking?tracknumbers=${trackingNumber}`;
      case 'usps':
        return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
      case 'dhl':
        return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
      default:
        return null;
    }
  };

  const getEstimatedDeliveryDate = (order: Order) => {
    const shippedAt = order.tracking_info?.shipped_at;
    if (!shippedAt || typeof shippedAt !== "string") return null;
    const shippedDate = new Date(shippedAt);
    const estimatedDays = order.shipping_carrier?.estimated_days || 5;
    const deliveryDate = new Date(shippedDate);
    deliveryDate.setDate(deliveryDate.getDate() + estimatedDays);
    return deliveryDate;
  };

  const toggleEmailNotifications = async (orderId: string) => {
    try {
      const newValue = !notificationPreferences[orderId];
      
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_email: userEmail,
          order_id: orderId,
          email_notifications: newValue
        });

      if (error) throw error;
      
      setNotificationPreferences(prev => ({
        ...prev,
        [orderId]: newValue
      }));
    } catch (error) {
      console.error('Error updating notification preferences:', error);
    }
  };

  if (loading) {
    return <div className="text-center text-gray-600">Loading orders...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No orders yet</h2>
        <p className="text-gray-600">You haven&apos;t made any purchases yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Order History</h2>
        <div className="space-y-4">
        {orders.map((order) => {
          const status = getTrackingStatus(order);
          const statusColor = getStatusColor(status);
          const trackingUrl = getTrackingUrl(order);
          const estimatedDelivery = getEstimatedDeliveryDate(order);
          
          return (
            <div key={order.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-900 font-semibold">Order #{order.id}</span>
                <span className="text-gray-500">{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
              
              {/* Order Status and Tracking */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`${statusColor} font-semibold`}>Status: {status}</span>
                {order.tracking_info?.tracking_number && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 text-sm">
                      Tracking: {order.tracking_info.tracking_number}
                    </span>
                    {trackingUrl && (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Track on {order.shipping_carrier?.name || 'Carrier'} &rarr;
                      </a>
                    )}
                  </div>
                )}
              </div>
              {estimatedDelivery && !order.tracking_info?.delivered && (
                <div className="text-gray-600 text-sm mt-1">
                  Estimated Delivery: {estimatedDelivery.toLocaleDateString()}
                </div>
              )}

              {/* Email Notifications Toggle */}
              <div className="mb-3">
                <label className="flex items-center gap-2 text-gray-700 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!notificationPreferences[order.id]}
                    onChange={() => toggleEmailNotifications(order.id)}
                    className="form-checkbox h-4 w-4 text-blue-600"
                  />
                  <span>Receive email updates for this order</span>
                </label>
              </div>

              {/* Expandable Order Details */}
              <button
                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                className="text-blue-600 hover:text-blue-800 text-sm mb-2"
              >
                {expandedOrder === order.id ? 'Hide Details' : 'Show Details'}
              </button>

              {expandedOrder === order.id && (
                <>
                  <div className="space-y-2 mb-3">
                    {order.order_items.map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-gray-700">
                        <span>{item.name}</span>
                        <span>${item.price.toFixed(2)} x {item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {/* Tracking Timeline */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="text-gray-900 font-semibold mb-2">Tracking Timeline</h3>
                    <div className="space-y-2">
                      {order.tracking_info?.delivered && (
                        <div className="flex items-center gap-2 text-green-600">
                          <span>&#10003;</span>
                          <span>Delivered</span>
                        </div>
                      )}
                      {order.tracking_info?.out_for_delivery && (
                        <div className="flex items-center gap-2 text-yellow-600">
                          <span>&rarr;</span>
                          <span>Out for delivery</span>
                        </div>
                      )}
                      {order.tracking_info?.in_transit && (
                        <div className="flex items-center gap-2 text-blue-600">
                          <span>&rarr;</span>
                          <span>In transit</span>
                        </div>
                      )}
                      {order.tracking_info?.shipped && (
                        <div className="flex items-center gap-2 text-blue-600">
                          <span>&rarr;</span>
                          <span>Shipped on {order.tracking_info?.shipped_at ? new Date(order.tracking_info.shipped_at).toLocaleDateString() : ''}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-600">
                        <span>&rarr;</span>
                        <span>Order placed on {new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="space-y-1 text-sm">
                  {/* Product Subtotal */}
                  <div className="flex justify-between items-center text-gray-700">
                    <span>Subtotal ({order.order_items.reduce((sum, item) => sum + item.quantity, 0)} item{order.order_items.reduce((sum, item) => sum + item.quantity, 0) !== 1 ? 's' : ''})</span>
                    <span>${order.order_items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}</span>
                  </div>
                  
                  {/* Shipping Cost */}
                  <div className="flex justify-between items-center text-gray-700">
                    <span>Shipping</span>
                    <span>${order.ship_cost ? order.ship_cost.toFixed(2) : '0.00'}</span>
                  </div>
                  
                  {/* Tax */}
                  <div className="flex justify-between items-center text-gray-700">
                    <span>Tax</span>
                    <span>${order.tax_amount ? order.tax_amount.toFixed(2) : '0.00'}</span>
                  </div>
                  
                  {/* Total */}
                  <div className="flex justify-between items-center text-gray-900 font-bold text-base pt-1 border-t border-gray-200">
                    <span>Total</span>
                    <span>${order.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
} 