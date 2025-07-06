"use client";
import Link from 'next/link';
import { useCart } from './CartContext';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from "react";
import type { Product } from './products';
import Image from 'next/image';

function formatCountdown(diffMs: number) {
  let totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  totalSeconds %= 60 * 60 * 24;
  const hours = Math.floor(totalSeconds / (60 * 60));
  totalSeconds %= 60 * 60;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export default function HomePage() {
  const { addToCart } = useCart();
  const router = useRouter();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [goLiveTime, setGoLiveTime] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [animatingButtons, setAnimatingButtons] = useState<Set<number>>(new Set());

  React.useEffect(() => {
    (async () => {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    })();
  }, []);

  useEffect(() => {
    const fetchGoLive = async () => {
      const res = await fetch("/api/settings/go-live");
      const data = await res.json();
      if (data.goLiveTime) setGoLiveTime(data.goLiveTime);
    };
    fetchGoLive();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const goLiveDate = goLiveTime ? new Date(goLiveTime) : null;
  const isBeforeGoLive = goLiveDate && now < goLiveDate;
  const countdown = goLiveDate ? formatCountdown(goLiveDate.getTime() - now.getTime()) : null;

  const publishedProducts = products.filter(product => product.published);

  const handleAddToCart = (product: Product) => {
    // Add button animation
    setAnimatingButtons(prev => new Set([...prev, product.id]));
    
    // Add to cart
    addToCart({ 
      id: product.id, 
      name: product.name, 
      image: product.image, 
      price: product.price, 
      shipping_cost: product.shipping_cost ?? 0 
    });
    
    // Remove animation after 300ms
    setTimeout(() => {
      setAnimatingButtons(prev => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
    }, 300);
  };

  const handleBuyNow = (product: Product) => {
    handleAddToCart(product);
    router.push('/cart');
  };

  return (
    <div className="max-w-full min-h-screen" style={{background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)'}}>
      {goLiveDate && isBeforeGoLive && (
        <div className="w-full min-h-screen flex flex-col justify-center items-center" style={{color: 'white'}}>
          <div className="w-full flex flex-col items-center pt-16">
            <h2 className="text-4xl sm:text-6xl font-bold tracking-wide mb-8 text-center">SNAG A DEAL IN...</h2>
            <div className="flex flex-row gap-8 mb-8">
              <div className="flex flex-col items-center">
                <span className="text-5xl sm:text-7xl font-extrabold">{String(countdown?.days).padStart(2, '0')}</span>
                <span className="text-lg tracking-widest mt-2">DAYS</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-5xl sm:text-7xl font-extrabold">{String(countdown?.hours).padStart(2, '0')}</span>
                <span className="text-lg tracking-widest mt-2">HOURS</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-5xl sm:text-7xl font-extrabold">{String(countdown?.minutes).padStart(2, '0')}</span>
                <span className="text-lg tracking-widest mt-2">MINUTES</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-5xl sm:text-7xl font-extrabold">{String(countdown?.seconds).padStart(2, '0')}</span>
                <span className="text-lg tracking-widest mt-2">SECONDS</span>
              </div>
            </div>
            <h3 className="text-3xl sm:text-4xl font-bold mb-8 text-center">ARE YOU READY?</h3>
            <div className="text-xl sm:text-2xl tracking-widest font-mono mb-4">KTWHOLESALEFINDS.COM</div>
          </div>
        </div>
      )}
      {!isBeforeGoLive && (
        <div className="w-full min-h-screen flex flex-col items-center pt-16" style={{color: 'white'}}>
          <h1 className="text-4xl font-extrabold mb-2 text-center">WE ARE LIVE</h1>
          <div className="text-xl mb-8 text-center italic">Don&apos;t let a good deal get by!!!</div>
          <div className="max-w-7xl w-full px-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {publishedProducts.map(product => (
              <div key={product.id} className="block bg-white rounded shadow hover:shadow-lg transition p-3 text-gray-900">
                <Link href={`/products/${product.id}`}>
                  <Image src={product.image} alt={product.name} width={300} height={128} className="h-32 w-full object-cover rounded mb-3" />
                  <div className="font-semibold text-base mb-1">{product.name}</div>
                  <div className="mb-1 text-gray-600 text-sm">Listing #: {product.listing_number}</div>
                  <div className="mb-1 text-gray-600 text-sm">Stock: {product.stock ?? 0}</div>
                  <div className="mb-2">
                    <span className="text-green-700 font-bold mr-2 text-lg">${product.price.toFixed(2)}</span>
                    <span className="line-through text-gray-500 text-sm">${product.retail.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-700 line-clamp-2">{product.description}</div>
                  {product.stock === 0 && (
                    <div className="mt-2 text-red-600 font-bold text-sm">Sold Out</div>
                  )}
                </Link>
                <div className="flex gap-1 mt-3">
                  <button 
                    className={`bg-blue-600 text-white px-2 py-1 rounded text-sm disabled:opacity-50 transition-transform duration-200 ${animatingButtons.has(product.id) ? 'animate-button-bounce' : ''}`}
                    onClick={() => handleAddToCart(product)} 
                    disabled={product.stock === 0}
                  >
                    Add to Cart
                  </button>
                  <button 
                    className={`bg-green-600 text-white px-2 py-1 rounded text-sm disabled:opacity-50 transition-transform duration-200 ${animatingButtons.has(product.id) ? 'animate-button-bounce' : ''}`}
                    onClick={() => handleBuyNow(product)} 
                    disabled={product.stock === 0}
                  >
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}