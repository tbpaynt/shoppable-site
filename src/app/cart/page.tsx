"use client";
import { useCart } from '../CartContext';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import CheckoutForm from '../components/CheckoutForm';

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: cart,
          customerEmail: 'customer@example.com', // You can make this dynamic based on user login
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setClientSecret(data.clientSecret);
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
    // You can redirect to a success page or show a success message
    alert('Payment successful! Your order has been placed.');
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
    setShowCheckout(false);
    setClientSecret(null);
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
            <div className="border-t pt-2 font-bold">
              <div className="flex justify-between">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        <CheckoutForm
          clientSecret={clientSecret}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
        />
        <button
          onClick={() => {
            setShowCheckout(false);
            setClientSecret(null);
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
                  <td className="p-2"><Image src={item.image} alt={item.name} width={48} height={48} className="h-12 w-12 object-cover rounded" /></td>
                  <td className="p-2">{item.name}</td>
                  <td className="p-2">${item.price.toFixed(2)}</td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={e => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                      className="w-16 p-1 border rounded text-black"
                    />
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