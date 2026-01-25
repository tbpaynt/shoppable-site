"use client";
import { useCart } from '../CartContext';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
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
  const { data: session, status } = useSession();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [customerSessionClientSecret, setCustomerSessionClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [quantityInputs, setQuantityInputs] = useState<Record<number, string>>({});
  
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
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);

  const TAX_RATE = 0.06; // 6% sales tax – adjust per locale

  // Fetch saved addresses when user is logged in
  useEffect(() => {
    const fetchSavedAddresses = async () => {
      if (status === "authenticated" && session?.user) {
        try {
          const res = await fetch('/api/addresses');
          if (res.ok) {
            const data = await res.json();
            setSavedAddresses(data.addresses || []);
            
            // Pre-fill form with default address if available and form is empty
            const defaultAddress = data.addresses?.find((addr: any) => addr.is_default) || data.addresses?.[0];
            if (defaultAddress) {
              // Only pre-fill if form is completely empty
              setAddress(prev => {
                if (!prev.name && !prev.street1 && !prev.city && !prev.state && !prev.zip) {
                  return {
                    name: defaultAddress.name || "",
                    street1: defaultAddress.street1 || "",
                    city: defaultAddress.city || "",
                    state: defaultAddress.state || "",
                    zip: defaultAddress.zip || "",
                  };
                }
                return prev;
              });
            }
          }
        } catch (e) {
          console.error('Error fetching saved addresses:', e);
        }
      }
    };
    fetchSavedAddresses();
  }, [status, session?.user]);

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
        console.log('[Cart] Shipping quote received:', { amount: data.amount, rateId: data.rateId });
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
  
  // Free shipping threshold
  const FREE_SHIPPING_THRESHOLD = 150;
  const isEligibleForFreeShipping = productTotal >= FREE_SHIPPING_THRESHOLD;
  const amountNeededForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - productTotal);
  
  // Use dynamic quote if available, otherwise use flat rate as default for orders under $150
  // Only fall back to per-item shipping if quote hasn't been fetched yet and address isn't provided
  const hasAddress = address.name && address.street1 && address.city && address.state && address.zip;
  const shippingTotal = shippingQuote !== null 
    ? shippingQuote 
    : (hasAddress 
        ? 16.95 // Default flat rate while quote is loading
        : cart.reduce((sum, item) => sum + (item.shipping_cost || 0) * item.quantity, 0));
  
  const taxableBase = productTotal + shippingTotal;
  const taxTotal = hasAddress ? +(taxableBase * TAX_RATE).toFixed(2) : 0;
  const total = productTotal + shippingTotal + (hasAddress ? taxTotal : 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    // Validate that we have an address (either from form or saved)
    const hasFormAddress = address.name && address.street1 && address.city && address.state && address.zip;
    const hasSavedAddress = savedAddresses && savedAddresses.length > 0;
    
    if (!hasFormAddress && !hasSavedAddress) {
      setError("Shipping address is required. Please enter a shipping address below or save one in your profile.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Validate stock before checkout and remove out-of-stock items
      const validatedItems: { id: number; quantity: number }[] = [];
      const removedItems: string[] = [];
      
      for (const item of cart) {
        try {
          const response = await fetch(`/api/products/${item.id}`);
          if (response.ok) {
            const product = await response.json();
            const availableStock = product.stock || 0;
            
            if (availableStock >= item.quantity) {
              validatedItems.push({ id: item.id, quantity: item.quantity });
            } else if (availableStock > 0) {
              // Partial stock available - adjust quantity
              validatedItems.push({ id: item.id, quantity: availableStock });
              removedItems.push(`${item.name}: quantity reduced from ${item.quantity} to ${availableStock} (only ${availableStock} available)`);
              // Update cart with reduced quantity
              await updateQuantity(item.id, availableStock);
            } else {
              // Out of stock - remove from cart
              removedItems.push(`${item.name}: removed (out of stock)`);
              removeFromCart(item.id);
            }
          } else {
            // Product not found - remove from cart
            removedItems.push(`${item.name}: removed (product not found)`);
            removeFromCart(item.id);
          }
        } catch (e) {
          console.error(`Error validating product ${item.id}:`, e);
          // On error, try to include it anyway (server will catch it)
          validatedItems.push({ id: item.id, quantity: item.quantity });
        }
      }
      
      // If items were removed, show error and stop
      if (removedItems.length > 0) {
        setError(`Cart updated: ${removedItems.join('; ')}. Please review your cart and try again.`);
        setIsLoading(false);
        return;
      }
      
      // If no items left after validation, stop
      if (validatedItems.length === 0) {
        setError('No items available for checkout. Your cart has been cleared.');
        clearCart();
        setIsLoading(false);
        return;
      }

      const payload: any = {
        items: validatedItems,
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
      
      // Include shipping info if available (even if 0 for free shipping)
      if (shippingQuote !== null && shippingRateId) {
        payload.shipAmount = shippingQuote; // This can be 0 for free shipping
        payload.rateId = shippingRateId;
        payload.taxAmount = taxTotal;
      } else if (address.name && address.street1 && address.city && address.state && address.zip) {
        // If address is provided but quote hasn't loaded yet, fetch it now
        try {
          const quoteRes = await fetch("/api/shipping/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: cart.map((c) => ({ id: c.id, quantity: c.quantity })),
              address: {
                name: address.name,
                street1: address.street1,
                city: address.city,
                state: address.state,
                zip: address.zip,
                country: "US",
              },
            }),
          });
          const quoteData = await quoteRes.json();
          if (quoteRes.ok && quoteData.amount !== undefined) {
            payload.shipAmount = quoteData.amount;
            payload.rateId = quoteData.rateId;
            payload.taxAmount = taxTotal;
          }
        } catch (e) {
          console.error("Failed to fetch shipping quote during checkout:", e);
        }
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
            
            // Try to enhance error message with product names if it mentions product IDs
            const productIdMatch = message.match(/product[^\d]*(\d+)/i) || message.match(/"(\d+)"/);
            if (productIdMatch) {
              const productId = parseInt(productIdMatch[1]);
              const cartItem = cart.find(item => item.id === productId);
              if (cartItem) {
                message = message.replace(/product[^\d]*\d+/i, cartItem.name).replace(/"\d+"/, `"${cartItem.name}"`);
              }
            }
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
              
              {/* Free Shipping Progress */}
              {!isEligibleForFreeShipping && amountNeededForFreeShipping > 0 && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded text-sm">
                  <div className="flex justify-between items-center">
                    <span>Add ${amountNeededForFreeShipping.toFixed(2)} more for FREE shipping!</span>
                    <span className="text-xs">({((productTotal / FREE_SHIPPING_THRESHOLD) * 100).toFixed(0)}% there)</span>
                  </div>
                  <div className="w-full bg-green-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min((productTotal / FREE_SHIPPING_THRESHOLD) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {isEligibleForFreeShipping && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded text-sm">
                  🎉 You qualify for FREE shipping!
                </div>
              )}
              
              <div className="flex justify-between text-sm font-normal">
                <span>Shipping</span>
                <span>{isEligibleForFreeShipping ? 'FREE' : `$${shippingTotal.toFixed(2)}`}</span>
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
          
          {/* Shipping Address Display */}
          {(() => {
            // Determine which address to display - form address or saved address
            const formAddress = (address.name && address.street1 && address.city && address.state && address.zip) ? address : null;
            const savedAddress = savedAddresses?.find((addr: any) => addr.is_default) || savedAddresses?.[0];
            const displayAddress = formAddress || savedAddress;
            
            return displayAddress ? (
              <div className="mb-6 border-t pt-4">
                <h2 className="text-lg font-semibold mb-2">Shipping Address</h2>
                <div className="text-sm text-gray-700 space-y-1">
                  <div className="font-medium">{displayAddress.name}</div>
                  <div>{displayAddress.street1}</div>
                  {displayAddress.street2 && <div>{displayAddress.street2}</div>}
                  <div>{displayAddress.city}, {displayAddress.state} {displayAddress.zip}</div>
                  {!formAddress && savedAddress && (
                    <div className="text-xs text-gray-500 mt-2 italic">Using your saved default address</div>
                  )}
                </div>
              </div>
            ) : null;
          })()}
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
    <div className="max-w-3xl mx-auto p-8" style={{background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)', minHeight: '100vh'}}>
      <h1 className="text-2xl font-bold mb-6 text-white">Your Cart</h1>
      {cart.length === 0 ? (
        <div className="bg-gray-800 rounded shadow p-6 border border-gray-700">
          <p className="text-gray-300 mb-4">Your cart is empty.</p>
          <Link href="/products" className="text-blue-400 hover:text-blue-300 underline font-medium">Shop now</Link>
        </div>
      ) : (
        <>
          {/* Shipping address */}
          <div className="mb-6">
            {/* Saved Addresses Selector */}
            {savedAddresses.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Use Saved Address:
                </label>
                <select
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    if (selectedId) {
                      const selected = savedAddresses.find(addr => addr.id === selectedId);
                      if (selected) {
                        setAddress({
                          name: selected.name || "",
                          street1: selected.street1 || "",
                          city: selected.city || "",
                          state: selected.state || "",
                          zip: selected.zip || "",
                        });
                      }
                    }
                  }}
                  className="w-full p-2 border rounded text-black mb-2"
                  defaultValue=""
                >
                  <option value="">Select a saved address...</option>
                  {savedAddresses.map((addr: any) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.name} - {addr.street1}, {addr.city}, {addr.state} {addr.zip}
                      {addr.is_default ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-600">
                  Or enter a new address below. If you proceed without entering an address, your default saved address will be used.
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            {quoteLoading && <span className="text-gray-600 text-sm col-span-1 md:col-span-2">Calculating shipping…</span>}
            {quoteError && <span className="text-red-600 text-sm col-span-1 md:col-span-2">{quoteError}</span>}
            </div>
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
                        value={quantityInputs[item.id] !== undefined ? quantityInputs[item.id] : item.quantity}
                        onChange={async (e) => {
                          const inputValue = e.target.value;
                          // Store the raw input value for typing
                          setQuantityInputs(prev => ({
                            ...prev,
                            [item.id]: inputValue
                          }));
                          
                          // If it's a valid number (from spinner clicks), update immediately
                          const numValue = parseInt(inputValue);
                          if (!isNaN(numValue) && inputValue === numValue.toString()) {
                            const finalQuantity = Math.max(1, Math.min(numValue, item.stock || 999));
                            if (finalQuantity !== item.quantity) {
                              const result = await updateQuantity(item.id, finalQuantity);
                              if (!result.success) {
                                setQuantityError(result.message);
                                setTimeout(() => setQuantityError(null), 3000);
                              } else {
                                setQuantityError(null);
                                // Clear local state after successful update
                                setQuantityInputs(prev => {
                                  const newState = { ...prev };
                                  delete newState[item.id];
                                  return newState;
                                });
                              }
                            }
                          }
                        }}
                        onBlur={async (e) => {
                          // When user finishes editing, validate and update
                          const inputValue = e.target.value.trim();
                          if (inputValue === '') {
                            // If empty, reset to current quantity
                            setQuantityInputs(prev => {
                              const newState = { ...prev };
                              delete newState[item.id];
                              return newState;
                            });
                            return;
                          }
                          const newQuantity = parseInt(inputValue) || 1;
                          const finalQuantity = Math.max(1, Math.min(newQuantity, item.stock || 999));
                          
                          // Clear the local input state to sync with cart
                          setQuantityInputs(prev => {
                            const newState = { ...prev };
                            delete newState[item.id];
                            return newState;
                          });
                          
                          if (finalQuantity !== item.quantity) {
                            const result = await updateQuantity(item.id, finalQuantity);
                            if (!result.success) {
                              setQuantityError(result.message);
                              setTimeout(() => setQuantityError(null), 3000);
                            } else {
                              setQuantityError(null);
                            }
                          }
                        }}
                        onKeyDown={async (e) => {
                          // Update on Enter key
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
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
          
          {/* Cart Summary */}
          <div className="mb-6 border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <button className="text-gray-600 underline" onClick={clearCart}>Clear Cart</button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Items Subtotal</span>
                <span>${productTotal.toFixed(2)}</span>
              </div>
              
              {/* Free Shipping Progress */}
              {!isEligibleForFreeShipping && amountNeededForFreeShipping > 0 && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded text-sm">
                  <div className="flex justify-between items-center">
                    <span>Add ${amountNeededForFreeShipping.toFixed(2)} more for FREE shipping!</span>
                    <span className="text-xs">({((productTotal / FREE_SHIPPING_THRESHOLD) * 100).toFixed(0)}% there)</span>
                  </div>
                  <div className="w-full bg-green-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min((productTotal / FREE_SHIPPING_THRESHOLD) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {isEligibleForFreeShipping && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded text-sm">
                  🎉 You qualify for FREE shipping!
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span>
                  {quoteLoading ? (
                    <span className="text-gray-500">Calculating...</span>
                  ) : isEligibleForFreeShipping ? (
                    'FREE'
                  ) : shippingQuote !== null ? (
                    `$${shippingTotal.toFixed(2)}`
                  ) : hasAddress ? (
                    <span className="text-gray-500">$16.95 (estimated)</span>
                  ) : (
                    <span className="text-gray-500">Enter address</span>
                  )}
                </span>
              </div>
              
              {hasAddress && (
                <div className="flex justify-between text-sm">
                  <span>Tax (6%)</span>
                  <span>${taxTotal.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
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
          
          {/* Account Creation Prompt for Unauthenticated Users */}
          {status !== "loading" && !session && (
            <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg">
              <div className="text-center">
                <div className="text-2xl mb-2">🎉</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Create an Account to Proceed</h3>
                <p className="text-gray-700 mb-4">
                  Sign up now to complete your purchase and enjoy exclusive benefits like order tracking, 
                  faster checkout, and special member deals!
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => signIn('google')}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </button>
                  <Link
                    href="/signup"
                    className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-colors text-center"
                  >
                    Create Account
                  </Link>
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  Already have an account? 
                  <button 
                    onClick={() => signIn('google')} 
                    className="text-blue-600 hover:underline ml-1 font-medium"
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            </div>
          )}
          
          {/* Checkout Button - Only show for authenticated users or with modified text for guests */}
          {session ? (
            <button 
              className="bg-green-600 text-white px-6 py-2 rounded text-lg font-semibold w-full disabled:opacity-50"
              onClick={handleCheckout}
              disabled={isLoading || cart.length === 0}
            >
              {isLoading ? 'Processing...' : 'Proceed to Checkout'}
            </button>
          ) : status !== "loading" && (
            <div className="text-center">
              <p className="text-gray-600 mb-2">Please create an account or sign in to continue</p>
              <button 
                className="bg-gray-400 text-white px-6 py-2 rounded text-lg font-semibold w-full cursor-not-allowed"
                disabled
              >
                Sign In Required to Checkout
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
} 