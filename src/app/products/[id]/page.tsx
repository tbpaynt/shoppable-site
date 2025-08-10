"use client";
import React, { useEffect, useState } from "react";
import { useCart } from '../../CartContext';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../utils/supabaseClient';
import type { Product } from '../../products';
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

export default function ProductDetailPage() {
  const params = useParams();
  const id = params && typeof params.id === 'string' ? params.id : '';
  const { addToCart } = useCart();
  const router = useRouter();
  const { trackView } = useProductViews();
  const [product, setProduct] = useState<Product | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [images, setImages] = useState<{ image_url: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: prod, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (!prod || error) {
        setLoading(false);
        setProduct(null);
        return;
      }
      setProduct(prod);
      
      // Track product view
      trackView(prod.id);
      
      if (prod.category_id) {
        const { data: category } = await supabase
          .from('categories')
          .select('name')
          .eq('id', prod.category_id)
          .single();
        setCategoryName(category?.name || "");
      }
      const { data: imgs } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('product_id', prod.id);
      setImages(imgs || []);
      setLoading(false);
    })();
  }, [id]);

  const handleAddToCart = async () => {
    if (!product) return;
    
    setIsAnimating(true);
    const result = await addToCart({ 
      id: product.id, 
      name: product.name, 
      image: product.image, 
      price: product.price, 
      shipping_cost: product.shipping_cost ?? 0 
    });
    
    // Handle result
    if (!result.success) {
      setCartError(result.message);
      // Clear error after 3 seconds
      setTimeout(() => setCartError(null), 3000);
    } else {
      setCartError(null);
    }
    
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push('/cart');
  };

  if (loading) return <div className="p-8 text-white">Loading...</div>;
  if (!product) return <div className="p-8 text-red-600">Product not found.</div>;

  return (
    <div className="max-w-3xl mx-auto p-8 bg-gray-800 rounded shadow text-white">
      <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
      <div className="mb-2 text-gray-300">Listing #: {product.listing_number}</div>
      <div className="mb-2 text-gray-300">Category: {categoryName}</div>
      <div className="mb-4">
        <ViewerCountBadge productId={product.id} className="mb-2" />
      </div>
      <div className="mb-4 flex gap-4">
        {isValidImageUrl(product.image) ? (
          <Image src={product.image} alt={product.name} width={256} height={256} className="h-64 w-64 object-cover rounded border" />
        ) : (
          <div className="h-64 w-64 bg-gray-700 rounded border flex items-center justify-center">
            <span className="text-gray-400">No Image</span>
          </div>
        )}
        {images && images.length > 0 && (
          <div className="flex flex-col gap-2">
            {images.map((img, idx) => (
              isValidImageUrl(img.image_url) ? (
                <Image key={idx} src={img.image_url} alt={`Product image ${idx + 2}`} width={80} height={80} className="h-20 w-20 object-cover rounded border" />
              ) : (
                <div key={idx} className="h-20 w-20 bg-gray-700 rounded border flex items-center justify-center">
                  <span className="text-gray-400 text-xs">No Img</span>
                </div>
              )
            ))}
          </div>
        )}
      </div>
      <div className="mb-4">
        <span className="text-xl font-semibold text-green-400 mr-4">${product.price.toFixed(2)}</span>
        <span className="text-lg line-through text-gray-400">${product.retail.toFixed(2)}</span>
      </div>
      <div className="mb-4 text-gray-300">Stock: {product.stock ?? 0}</div>
      {product.stock === 0 && (
        <div className="mb-4 text-red-400 font-bold text-xl">Sold Out</div>
      )}
      {cartError && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {cartError}
        </div>
      )}
      <div className="mb-6 whitespace-pre-line text-gray-200">{product.description}</div>
      <div className="flex gap-4 mt-6">
        <button 
          className={`bg-blue-600 text-white px-6 py-2 rounded text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-transform duration-200 ${isAnimating ? 'animate-button-bounce' : ''}`}
          onClick={handleAddToCart} 
          disabled={product.stock === 0}
        >
          Add to Cart
        </button>
        <button 
          className={`bg-green-600 text-white px-6 py-2 rounded text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-transform duration-200 ${isAnimating ? 'animate-button-bounce' : ''}`}
          onClick={handleBuyNow} 
          disabled={product.stock === 0}
        >
          Buy
        </button>
      </div>
    </div>
  );
} 