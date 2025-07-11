"use client";
import { useCart } from '../CartContext';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import CheckoutForm from '../components/CheckoutForm';

// Helper function to validate image URLs
function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return false;
  }
  
  const trimmed = url.trim();
  
  // Check for common invalid values
  if (trimmed === '.' || trimmed === '..' || trimmed === '/' || trimmed.length < 4) {
    return false;
  }
  
  // Check if it's a valid URL format
  try {
    const urlObj = new URL(trimmed);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    // If it's not a valid URL, check if it's a valid path that starts with /
    return trimmed.startsWith('/') && trimmed.length > 1;
  }
}

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [customerSessionClientSecret, setCustomerSessionClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  
  // Address state for shipping quote
  const [address, setAddress] = useState({
    name: "",
    street1: "",
    city: "",
    state: "",
    zip: "",
  });
  const [shippingQuote, setShippingQuote] = useState<number | null>(null);
  const [shippingRateId, setShippingRateId] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const TAX_RATE = 0.06; // 6% sales tax – adjust per locale

  // Trigger quote when cart or address changes
  useEffect(() => {
    const ready = address.name && address.street1 && address.city && address.state && address.zip && cart.length > 0;
    if (!ready) return;
    const fetchQuote = async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const payload = {
          items: cart.map((c) => ({ id: c.id, quantity: c.quantity })),
          address: {
            name: address.name,
            street1: address.street1,
            city: address.city,
            state: address.state,
            zip: address.zip,
            country: "US",
          },
        };
        const res = await fetch("/api/shipping/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Quote failed");
        setShippingQuote(data.amount);
        setShippingRateId(data.rateId);
      } catch (e: any) {
        setQuoteError(e.message || "Quote failed");
        setShippingQuote(null);
        setShippingRateId(null);
      } finally {
        setQuoteLoading(false);
      }
    };
    fetchQuote();
  }, [cart, address.name, address.street1, address.city, address.state, address.zip]);

  const productTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Use dynamic quote if available else per-item shipping cost fallback
  const shippingTotal = shippingQuote !== null ? shippingQuote : cart.reduce((sum, item) => sum + (item.shipping_cost || 0) * item.quantity, 0);
  const taxableBase = productTotal + shippingTotal;
  const taxTotal = +(taxableBase * TAX_RATE).toFixed(2);
  const total = productTotal + shippingTotal + taxTotal;

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const payload: any = {
        items: cart.map(item => ({ id: item.id, quantity: item.quantity })),
      };
      
      // Always include address if provided
      if (address.name && address.street1 && address.city && address.state && address.zip) {
        payload.address = {
          name: address.name,
          street1: address.street1,
          city: address.city,
          state: address.state,
          zip: address.zip,
          country: "US",
        };
      }
      
      // Include shipping info if available
      if (shippingQuote !== null && shippingRateId) {
        payload.shipAmount = shippingQuote;
        payload.rateId = shippingRateId;
        payload.taxAmount = taxTotal;
      }

      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // If the API responds with an error status, extract message safely
      if (!response.ok) {
        const clone = response.clone();
        let message = response.statusText;
        try {
          const errJson = await response.json();
          if (errJson && typeof errJson.error === 'string') {
            message = errJson.error;
          }
        } catch {
          // maybe body isn't JSON; try plain text from clone
          try {
            message = await clone.text();
          } catch {
            /* ignore */
          }
        }
        throw new Error(message || 'Failed to initialize checkout');
      }

      // Happy path
      const data = await response.json();
      if (!data?.clientSecret) {
        throw new Error('Payment initialisation failed: missing clientSecret');
      }

      setClientSecret(data.clientSecret);
      setCustomerSessionClientSecret(data.customerSessionClientSecret ?? null);
      setOrderId(data.orderId ?? null);
      setShowCheckout(true);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to initialize checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    clearCart();
    setShowCheckout(false);
    setClientSecret(null);
    setCustomerSessionClientSecret(null);

    // Navigate to success / thank-you page
    if (typeof window !== 'undefined') {
      const dest = orderId ? `/success?orderId=${orderId}` : '/success';
      window.location.assign(dest);
    }
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
    setShowCheckout(false);
    setClientSecret(null);
    setCustomerSessionClientSecret(null);
  };

  if (showCheckout && clientSecret) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded shadow text-gray-900">
        <h1 className="text-2xl font-bold mb-6">Complete Your Purchase</h1>
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Order Summary</h2>
          <div className="space-y-2">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between">
                <span>{item.name} x {item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-2 font-bold space-y-1">
              <div className="flex justify-between text-sm font-normal">
                <span>Items Subtotal</span>
                <span>${productTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-normal">
                <span>Shipping</span>
                <span>${shippingTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-normal">
                <span>Tax (6%)</span>
                <span>${taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        <CheckoutForm
          clientSecret={clientSecret}
          customerSessionClientSecret={customerSessionClientSecret || undefined}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
        />
        <button
          onClick={() => {
            setShowCheckout(false);
            setClientSecret(null);
            setCustomerSessionClientSecret(null);
            setError(null);
          }}
          className="mt-4 w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
        >
          Back to Cart
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded shadow text-gray-900">
      <h1 className="text-2xl font-bold mb-6">Your Cart</h1>
      {cart.length === 0 ? (
        <div className="text-gray-500 mb-8">Your cart is empty. <Link href="/products" className="text-blue-600 underline">Shop now</Link></div>
      ) : (
        <>
          {/* Shipping address */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Recipient Name"
              value={address.name}
              onChange={(e) => setAddress({ ...address, name: e.target.value })}
              className="p-2 border rounded text-black col-span-1 md:col-span-2"
            />
            <input
              type="text"
              placeholder="Street Address"
              value={address.street1}
              onChange={(e) => setAddress({ ...address, street1: e.target.value })}
              className="p-2 border rounded text-black"
            />
            <input
              type="text"
              placeholder="City"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              className="p-2 border rounded text-black"
            />
            <input
              type="text"
              placeholder="State (e.g. WV)"
              value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })}
              className="p-2 border rounded text-black"
            />
            <input
              type="text"
              placeholder="ZIP"
              value={address.zip}
              onChange={(e) => setAddress({ ...address, zip: e.target.value })}
              className="p-2 border rounded text-black"
            />
            {quoteLoading && <span className="text-white">Calculating shipping…</span>}
            {quoteError && <span className="text-red-400">{quoteError}</span>}
          </div>
          <table className="w-full mb-6">
            <thead>
              <tr>
                <th className="text-left p-2">Image</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Price</th>
                <th className="text-left p-2">Qty</th>
                <th className="text-left p-2">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.map(item => (
                <tr key={item.id} className="border-t border-gray-200">
                  <td className="p-2">
                    {isValidImageUrl(item.image) ? (
                      <Image src={item.image} alt={item.name} width={48} height={48} className="h-12 w-12 object-cover rounded" />
                    ) : (
                      <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-gray-500 text-xs">No Img</span>
                      </div>
                    )}
                  </td>
                  <td className="p-2">{item.name}</td>
                  <td className="p-2">${item.price.toFixed(2)}</td>
                  <td className="p-2">
                    <div className="flex flex-col">
                      <input
                        type="number"
                        min={1}
                        max={item.stock || 999}
                        value={item.quantity}
                        onChange={async (e) => {
                          const newQuantity = parseInt(e.target.value) || 1;
                          const result = await updateQuantity(item.id, newQuantity);
                          if (!result.success) {
                            setQuantityError(result.message);
                            setTimeout(() => setQuantityError(null), 3000);
                          } else {
                            setQuantityError(null);
                          }
                        }}
                        className="w-16 p-1 border rounded text-black"
                      />
                      {item.stock && (
                        <span className="text-xs text-gray-600 mt-1">
                          {item.stock} in stock
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2">${(item.price * item.quantity).toFixed(2)}</td>
                  <td className="p-2">
                    <button className="text-red-600 underline" onClick={() => removeFromCart(item.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center mb-6">
            <button className="text-gray-600 underline" onClick={clearCart}>Clear Cart</button>
            <div className="text-xl font-bold">Total: ${total.toFixed(2)}</div>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          {quantityError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {quantityError}
            </div>
          )}
          <button 
            className="bg-green-600 text-white px-6 py-2 rounded text-lg font-semibold w-full disabled:opacity-50"
            onClick={handleCheckout}
            disabled={isLoading || cart.length === 0}
          >
            {isLoading ? 'Processing...' : 'Proceed to Checkout'}
          </button>
        </>
      )}
    </div>
  );
} 