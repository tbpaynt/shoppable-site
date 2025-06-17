"use client";
import { useCart } from '../CartContext';
import Link from 'next/link';

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

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
                  <td className="p-2"><img src={item.image} alt={item.name} className="h-12 w-12 object-cover rounded" /></td>
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
          <button className="bg-green-600 text-white px-6 py-2 rounded text-lg font-semibold w-full">Checkout (Coming Soon)</button>
        </>
      )}
    </div>
  );
} 