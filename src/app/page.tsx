"use client";
import Link from 'next/link';
import { useCart } from './CartContext';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from "react";
import type { Product } from './products';
import Image from 'next/image';
import ViewerCountBadge from '@/components/ViewerCountBadge';
import { useProductViews } from '@/hooks/useProductViews';

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
  const { trackView } = useProductViews();
  const router = useRouter();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [goLiveTime, setGoLiveTime] = useState<string | null>(null);
  const [countdownMessage, setCountdownMessage] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [animatingButtons, setAnimatingButtons] = useState<Set<number>>(new Set());
  const [productErrors, setProductErrors] = useState<Map<number, string>>(new Map());
  const [showFreeShippingBanner, setShowFreeShippingBanner] = useState(true);
  const [showDiscountBanner, setShowDiscountBanner] = useState(true);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'newest'>('name_asc');
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

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
      if (data.countdownMessage) setCountdownMessage(data.countdownMessage);
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
      try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        if (Array.isArray(data)) setCategories(data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
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

  const handleAddToCart = async (product: Product) => {
    // Add button animation
    setAnimatingButtons(prev => new Set([...prev, product.id]));
    
    // Add to cart with stock validation
    const result = await addToCart({ 
      id: product.id, 
      name: product.name, 
      image: product.image, 
      price: product.price, 
      shipping_cost: product.shipping_cost ?? 0 
    });
    
    // Handle result
    if (!result.success) {
      setProductErrors(prev => new Map(prev.set(product.id, result.message)));
      // Clear error after 3 seconds
      setTimeout(() => {
        setProductErrors(prev => {
          const newMap = new Map(prev);
          newMap.delete(product.id);
          return newMap;
        });
      }, 3000);
    } else {
      setProductErrors(prev => {
        const newMap = new Map(prev);
        newMap.delete(product.id);
        return newMap;
      });
    }
    
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

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    setMousePosition({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    });
  };

  return (
    <div className="max-w-full min-h-screen" style={{background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)'}}>
      
      {/* Free Shipping Banner */}
      {showFreeShippingBanner && (
        <div className="bg-green-600 text-white text-center py-2 px-4 relative">
          <div className="flex items-center justify-center">
            <span className="text-sm font-medium">
              🚚 FREE SHIPPING on orders $150 or more! 🎉
            </span>
            <button
              onClick={() => setShowFreeShippingBanner(false)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-200 text-lg font-bold"
              aria-label="Close banner"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Discount Banner */}
      {showDiscountBanner && (
        <div className="bg-blue-600 text-white text-center py-2 px-4 relative">
          <div className="flex items-center justify-center">
            <span className="text-sm font-medium">
              🔥 Everything Only $19.99 or less! 🔥
            </span>
            <button
              onClick={() => setShowDiscountBanner(false)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-200 text-lg font-bold"
              aria-label="Close banner"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {goLiveDate && countdown && (isBeforeGoLive || countdown.days > 0 || countdown.hours > 0 || countdown.minutes > 0 || countdown.seconds > 0) && (
        <div 
          className="relative w-full min-h-screen flex flex-col justify-center items-center overflow-hidden" 
          style={{color: 'white'}}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onTouchMove={handleTouchMove}
          onTouchStart={() => setIsHovering(true)}
          onTouchEnd={() => setIsHovering(false)}
        >
          {/* Background Products Preview - Only visible through spotlight */}
          <div className="absolute inset-0">
            <div className="w-full min-h-screen flex flex-col items-center pt-16" style={{color: 'white'}}>
              <h1 className="text-4xl font-extrabold mb-8 text-center">SNAG YOUR DEALS!</h1>
              
              {/* Product Grid Preview */}
              <div className="max-w-7xl w-full px-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {products.filter(p => p.published).slice(0, 10).map(product => (
                  <div key={product.id} className="block bg-gray-800 rounded shadow p-3 text-white border border-gray-700">
                    {isValidImageUrl(product.image) ? (
                      <div className="bg-gray-700 rounded mb-3 overflow-hidden">
                        <Image src={product.image} alt={product.name} width={300} height={128} className="h-32 w-full object-cover" />
                      </div>
                    ) : (
                      <div className="bg-gray-700 rounded mb-3 h-32 w-full flex items-center justify-center">
                        <span className="text-gray-400 text-sm">No Image</span>
                      </div>
                    )}
                    <div className="text-sm font-medium truncate text-white mb-1">{product.name}</div>
                    <div className="text-xs text-green-400 font-bold">${product.price}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Dynamic Spotlight Overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: isHovering 
                ? `radial-gradient(circle 150px at ${mousePosition.x}px ${mousePosition.y}px, transparent 0%, rgba(0,0,0,1) 100%)`
                : 'rgba(0,0,0,1)',
              transition: 'background 0.1s ease-out'
            }}
          />
          
          {/* Countdown Content */}
          <div className="relative z-10 w-full flex flex-col items-center pt-16">
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
              {countdownMessage && (
                <div className="text-2xl sm:text-3xl font-semibold mb-6 text-center max-w-4xl px-4">
                  {countdownMessage}
                </div>
              )}
              <div className="text-xl sm:text-2xl tracking-widest font-mono mb-4">KTWHOLESALEFINDS.COM</div>
              
              {/* Interactive Hint */}
              <div className="mt-8 text-center">
                <p className="text-lg mb-2 opacity-80">👆 Move your cursor or finger to peek at the deals!</p>
                <div className="w-16 h-1 bg-gradient-to-r from-transparent via-white to-transparent mx-auto animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      )}
      {!isBeforeGoLive && (
        <div className="w-full min-h-screen flex flex-col items-center pt-16" style={{color: 'white'}}>
          <h1 className="text-4xl font-extrabold mb-8 text-center">SNAG YOUR DEALS!</h1>
          
          {/* Search and Filter Section */}
          <div className="max-w-7xl w-full px-4 mb-4">
            {/* Mobile: Compact Layout */}
            <div className="md:hidden">
              {/* Search Bar */}
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Search products..."
                  className="w-full px-3 py-2 rounded bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {/* Compact Filter Button */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded text-sm border border-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707v6.586a1 1 0 01-1.707.707l-4-4A1 1 0 018 16.586V14a1 1 0 00-.293-.707L1.293 6.879A1 1 0 011 6.172V4z" />
                  </svg>
                  Filters
                  {(selectedCategory || stockFilter !== 'all' || sortBy !== 'name_asc') && (
                    <span className="bg-blue-600 text-white rounded-full px-2 py-0.5 text-xs">•</span>
                  )}
                </button>
                
                <div className="text-xs text-gray-300">
                  {filteredAndSortedProducts.length} of {products.filter(p => p.published).length} items
                </div>
              </div>
              
              {/* Collapsible Filters */}
              {showFilters && (
                <div className="bg-gray-800 rounded-lg p-3 mb-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <select
                        className="w-full px-2 py-1.5 rounded bg-gray-700 text-white border border-gray-600 text-sm"
                        value={selectedCategory || ''}
                        onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">All Categories</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <select
                        className="w-full px-2 py-1.5 rounded bg-gray-700 text-white border border-gray-600 text-sm"
                        value={stockFilter}
                        onChange={(e) => setStockFilter(e.target.value as 'all' | 'in_stock' | 'out_of_stock')}
                      >
                        <option value="all">All Items</option>
                        <option value="in_stock">In Stock</option>
                        <option value="out_of_stock">Out of Stock</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <select
                      className="w-full px-2 py-1.5 rounded bg-gray-700 text-white border border-gray-600 text-sm"
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
                  
                  {(searchTerm || selectedCategory || stockFilter !== 'all' || sortBy !== 'name_asc') && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedCategory(null);
                        setStockFilter('all');
                        setSortBy('name_asc');
                        setShowFilters(false);
                      }}
                      className="w-full px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Desktop: Original Layout */}
            <div className="hidden md:block">
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
          </div>
          
          <div className="max-w-7xl w-full px-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredAndSortedProducts.map(product => (
              <div key={product.id} className="block bg-gray-800 rounded shadow hover:shadow-lg transition p-3 text-white border border-gray-700">
                <Link href={`/products/${product.id}`} onClick={() => trackView(product.id)}>
                  {isValidImageUrl(product.image) ? (
                    <div className="bg-gray-700 rounded mb-3 overflow-hidden relative">
                      <Image src={product.image} alt={product.name} width={300} height={128} className="h-32 w-full object-cover" />
                      <div className="absolute top-2 left-2">
                        <ViewerCountBadge productId={product.id} />
                      </div>
                    </div>
                  ) : (
                    <div className="h-32 w-full bg-gray-700 rounded mb-3 flex items-center justify-center relative">
                      <span className="text-gray-400 text-sm">No Image</span>
                      <div className="absolute top-2 left-2">
                        <ViewerCountBadge productId={product.id} />
                      </div>
                    </div>
                  )}
                  <div className="font-semibold text-base mb-1 text-white">{product.name}</div>
                  <div className="mb-1 text-gray-300 text-sm">Listing #: {product.listing_number}</div>
                  <div className="mb-1 text-gray-300 text-sm">Stock: {product.stock ?? 0}</div>
                  <div className="mb-2">
                    <span className="text-green-400 font-bold mr-2 text-lg">${product.price.toFixed(2)}</span>
                    <span className="line-through text-gray-500 text-sm">${product.retail.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-300 line-clamp-2">{product.description}</div>
                  {product.stock === 0 && (
                    <div className="mt-2 text-red-400 font-bold text-sm">Sold Out</div>
                  )}
                </Link>
                {/* Product-specific error message */}
                {productErrors.has(product.id) && (
                  <div className="mt-2 mb-2 bg-red-900 border border-red-600 text-red-200 px-2 py-1 rounded text-xs">
                    {productErrors.get(product.id)}
                  </div>
                )}
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