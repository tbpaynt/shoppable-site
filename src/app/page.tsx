'use client';
import { useState, useEffect } from "react";
import { useCart } from "./CartContext";
import type { Product } from "./products";
import { CountdownTimer } from "./components/CountdownTimer";
import Image from 'next/image';

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [goLiveTime, setGoLiveTime] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchGoLive = async () => {
      const res = await fetch("/api/settings/go-live");
      const data = await res.json();
      if (data.goLiveTime) setGoLiveTime(data.goLiveTime);
    };
    fetchGoLive();
  }, []);

  // Update 'now' every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-2xl text-gray-200">Loading...</div>
      </div>
    );
  }

  // Determine if go-live time is in the future
  const goLiveDate = goLiveTime ? new Date(goLiveTime) : null;
  const isBeforeGoLive = goLiveDate && now < goLiveDate;

  return (
    <div className="min-h-screen" style={{background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)'}}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Site Name Heading */}
        <h2 className="text-2xl font-bold text-white mb-2 text-center" style={{letterSpacing: '0.1em'}}>KTWholesaleFinds.com</h2>
        {/* Coming Soon Heading */}
        <h1 className="text-4xl font-extrabold text-yellow-200 mb-8 text-center" style={{letterSpacing: '0.05em'}}>Coming Soon</h1>
        {goLiveDate && isBeforeGoLive && (
          <div className="mb-8 p-6 bg-yellow-900 bg-opacity-80 border-l-4 border-yellow-500 rounded">
            <h2 className="text-2xl font-bold text-yellow-200 mb-2">Storefront goes live in:</h2>
            <CountdownTimer endDate={goLiveDate} />
          </div>
        )}
        <h1 className="text-3xl font-bold text-white mb-8">Our Products</h1>
        {isBeforeGoLive ? (
          <div className="text-lg text-gray-300">Products will be available when the storefront goes live.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.filter(product => product.published).map(product => (
              <div key={product.id} className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="aspect-w-1 aspect-h-1 w-full">
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={400}
                    height={192}
                    className="w-full h-48 object-cover"
                  />
                </div>
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-white mb-2">{product.name}</h2>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xl font-bold text-green-400">${product.price.toFixed(2)}</span>
                      {product.retail > product.price && (
                        <span className="ml-2 text-sm text-gray-400 line-through">${product.retail.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => addToCart({
                      id: product.id,
                      name: product.name,
                      image: product.image,
                      price: product.price
                    })}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}