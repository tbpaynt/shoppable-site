"use client";
import { useEffect, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Order = {
  id: string;
  created_at: string;
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setLoading(false);
    };
    getUser();
    const { data: listener } = supabase.auth.onAuthStateChange(() => getUser());
    return () => { listener?.subscription.unsubscribe(); };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-2xl" style={{background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)', color: 'white'}}>Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)'}}>
        <div className="bg-gray-800 p-8 rounded shadow max-w-md w-full flex flex-col items-center">
          <h1 className="text-3xl font-extrabold mb-6 text-center text-white drop-shadow-lg" style={{letterSpacing: '0.05em'}}>Customer Login</h1>
          <AuthForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)'}}>
      <div className="bg-white bg-opacity-10 p-8 rounded shadow max-w-4xl w-full flex flex-col items-center">
        <h1 className="text-3xl font-extrabold mb-4 text-center text-white drop-shadow-lg">Welcome, {user.email}!</h1>
        <div className="w-full">
          <PurchaseHistory userId={user.id} />
        </div>
        <button onClick={handleSignOut} className="bg-red-600 text-white px-4 py-2 rounded w-full font-bold mt-4">Sign Out</button>
      </div>
    </div>
  );
}

function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("sign-in");

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (view === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: "google" | "facebook") => {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({ provider });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <form onSubmit={handleAuth} className="flex flex-col gap-4 w-full items-center">
      <input
        type="email"
        placeholder="Email"
        className="p-2 border rounded w-full bg-white bg-opacity-80 text-black font-semibold"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        className="p-2 border rounded w-full bg-white bg-opacity-80 text-black font-semibold"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      {error && <div className="text-red-300 text-sm w-full text-center">{error}</div>}
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded w-full font-bold" disabled={loading}>
        {loading ? (view === "sign-in" ? "Signing In..." : "Signing Up...") : (view === "sign-in" ? "Sign In" : "Sign Up")}
      </button>
      <div className="flex gap-2 justify-center w-full">
        <button type="button" className="text-blue-200 underline text-sm" onClick={() => setView(view === "sign-in" ? "sign-up" : "sign-in")}>{view === "sign-in" ? "Create an account" : "Already have an account? Sign in"}</button>
      </div>
      <div className="flex flex-col gap-2 mt-2 w-full">
        <button type="button" className="bg-red-500 text-white px-4 py-2 rounded font-bold w-full" onClick={() => handleOAuth("google")}>Continue with Google</button>
        <button type="button" className="bg-blue-800 text-white px-4 py-2 rounded font-bold w-full" onClick={() => handleOAuth("facebook")}>Continue with Facebook</button>
      </div>
    </form>
  );
}

function PurchaseHistory({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*), tracking_info(*), shipping_carrier(*)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(data || []);

        // Fetch notification preferences
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('order_id, email_notifications')
          .eq('user_id', userId);

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
  }, [userId]);

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
      case 'Delivered': return 'text-green-400';
      case 'Out for Delivery': return 'text-yellow-400';
      case 'In Transit': return 'text-blue-400';
      case 'Shipped': return 'text-blue-400';
      case 'Processing': return 'text-gray-400';
      default: return 'text-gray-400';
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
          user_id: userId,
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
    return <div className="text-white text-center">Loading orders...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white bg-opacity-5 p-6 rounded-lg">
        <h2 className="text-2xl font-bold text-white mb-4">Purchase History</h2>
        <p className="text-gray-300">You haven&apos;t made any purchases yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white bg-opacity-5 p-6 rounded-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Purchase History</h2>
      <div className="space-y-4">
        {orders.map((order) => {
          const status = getTrackingStatus(order);
          const statusColor = getStatusColor(status);
          const trackingUrl = getTrackingUrl(order);
          const estimatedDelivery = getEstimatedDeliveryDate(order);
          
          return (
            <div key={order.id} className="bg-white bg-opacity-10 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-semibold">Order #{order.id}</span>
                <span className="text-gray-300">{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
              
              {/* Order Status and Tracking */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`${statusColor} font-semibold`}>Status: {status}</span>
                {order.tracking_info?.tracking_number && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">
                      Tracking: {order.tracking_info.tracking_number}
                    </span>
                    {trackingUrl && (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                        Track on {order.shipping_carrier?.name || 'Carrier'} &rarr;
                      </a>
                    )}
                  </div>
                )}
              </div>
              {estimatedDelivery && !order.tracking_info?.delivered && (
                <div className="text-gray-400 text-sm mt-1">
                  Estimated Delivery: {estimatedDelivery.toLocaleDateString()}
                </div>
              )}

              {/* Email Notifications Toggle */}
              <div className="mb-3">
                <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
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
                className="text-blue-400 hover:text-blue-300 text-sm mb-2"
              >
                {expandedOrder === order.id ? 'Hide Details' : 'Show Details'}
              </button>

              {expandedOrder === order.id && (
                <>
                  <div className="space-y-2 mb-3">
                    {order.order_items.map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-gray-300">
                        <span>{item.name}</span>
                        <span>${item.price.toFixed(2)} x {item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {/* Tracking Timeline */}
                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <h3 className="text-white font-semibold mb-2">Tracking Timeline</h3>
                    <div className="space-y-2">
                      {order.tracking_info?.delivered && (
                        <div className="flex items-center gap-2 text-green-400">
                          <span>&#10003;</span>
                          <span>Delivered</span>
                        </div>
                      )}
                      {order.tracking_info?.out_for_delivery && (
                        <div className="flex items-center gap-2 text-yellow-400">
                          <span>&rarr;</span>
                          <span>Out for delivery</span>
                        </div>
                      )}
                      {order.tracking_info?.in_transit && (
                        <div className="flex items-center gap-2 text-blue-400">
                          <span>&rarr;</span>
                          <span>In transit</span>
                        </div>
                      )}
                      {order.tracking_info?.shipped && (
                        <div className="flex items-center gap-2 text-blue-400">
                          <span>&rarr;</span>
                          <span>Shipped on {order.tracking_info?.shipped_at ? new Date(order.tracking_info.shipped_at).toLocaleDateString() : ''}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-400">
                        <span>&rarr;</span>
                        <span>Order placed on {new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="mt-2 pt-2 border-t border-gray-600">
                <div className="flex justify-between items-center text-white font-bold">
                  <span>Total</span>
                  <span>${order.order_items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 