"use client";
import Link from 'next/link';
import { useCart } from './CartContext';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from "react";
import type { Product } from './products';
import Image from 'next/image';
import { supabase } from '../utils/supabaseClient';

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

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'newest'>('name_asc');
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

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

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase.from("categories").select("id, name");
      if (!error && data) setCategories(data);
    };
    fetchCategories();
  }, []);

  const goLiveDate = goLiveTime ? new Date(goLiveTime) : null;
  const isBeforeGoLive = goLiveDate && now < goLiveDate;
  const countdown = goLiveDate ? formatCountdown(goLiveDate.getTime() - now.getTime()) : null;

  // Filter and sort products
  const filteredAndSortedProducts = React.useMemo(() => {
    let filtered = products.filter(product => product.published);

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(term) ||
        product.description.toLowerCase().includes(term) ||
        product.listing_number.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(product => product.category_id === selectedCategory);
    }



    // Stock filter
    if (stockFilter === 'in_stock') {
      filtered = filtered.filter(product => (product.stock ?? 0) > 0);
    } else if (stockFilter === 'out_of_stock') {
      filtered = filtered.filter(product => (product.stock ?? 0) === 0);
    }

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        case 'newest':
          return b.id - a.id; // Assuming higher ID = newer
        default:
          return 0;
      }
    });

    return filtered;
  }, [products, searchTerm, selectedCategory, stockFilter, sortBy]);

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
          <div className="flex items-center gap-8 mb-8">
            <Image
              src="/kt-wholesale-logo.png"
              alt="KT Wholesale Finds"
              width={200}
              height={100}
              className="h-20 w-auto"
              priority
            />
            <div className="text-center">
              <h1 className="text-4xl font-extrabold mb-2">WE ARE LIVE</h1>
              <div className="text-xl italic">Don&apos;t let a good deal get by!!!</div>
            </div>
          </div>
          
          {/* Search and Filter Section */}
          <div className="max-w-7xl w-full px-4 mb-4">
            <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
              {/* Search Bar */}
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Search products by name, description, or listing number..."
                  className="w-full px-3 py-1.5 rounded bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {/* Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Category Filter */}
                <div>
                  <label className="block text-xs font-medium mb-1">Category</label>
                  <select
                    className="w-full px-3 py-1.5 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    value={selectedCategory || ''}
                    onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">All Categories</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Stock Filter */}
                <div>
                  <label className="block text-xs font-medium mb-1">Availability</label>
                  <select
                    className="w-full px-3 py-1.5 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value as 'all' | 'in_stock' | 'out_of_stock')}
                  >
                    <option value="all">All Items</option>
                    <option value="in_stock">In Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
                
                {/* Sort Options */}
                <div>
                  <label className="block text-xs font-medium mb-1">Sort By</label>
                  <select
                    className="w-full px-3 py-1.5 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'newest')}
                  >
                    <option value="name_asc">Name A-Z</option>
                    <option value="name_desc">Name Z-A</option>
                    <option value="price_asc">Price Low to High</option>
                    <option value="price_desc">Price High to Low</option>
                    <option value="newest">Newest First</option>
                  </select>
                </div>
              </div>
              
              {/* Results Count and Clear Filters */}
              <div className="mt-3 flex justify-between items-center">
                <div className="text-xs text-gray-300">
                  Showing {filteredAndSortedProducts.length} of {products.filter(p => p.published).length} products
                </div>
                {(searchTerm || selectedCategory || stockFilter !== 'all' || sortBy !== 'name_asc') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory(null);
                      setStockFilter('all');
                      setSortBy('name_asc');
                    }}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="max-w-7xl w-full px-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredAndSortedProducts.map(product => (
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