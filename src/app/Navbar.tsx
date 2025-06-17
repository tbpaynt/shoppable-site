"use client";
import Link from 'next/link';
import { useCart } from './CartContext';

export default function Navbar() {
  const { cart } = useCart();
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <nav className="w-full bg-gray-900 text-white px-8 py-4 flex items-center justify-between mb-8">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-2xl font-bold">Shop</Link>
        <Link href="/products" className="text-lg">Products</Link>
      </div>
      <div className="flex items-center gap-6">
        <Link href="/customer" className="text-lg flex items-center gap-2">
          <span>Login</span>
        </Link>
        <Link href="/cart" className="relative flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437m0 0L7.5 15.75A2.25 2.25 0 009.664 18h7.672a2.25 2.25 0 002.164-1.75l1.386-7.75H6.106m-1.25-3.728L6.106 6.25m0 0h15.138" />
          </svg>
          {itemCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{itemCount}</span>
          )}
        </Link>
      </div>
    </nav>
  );
} 