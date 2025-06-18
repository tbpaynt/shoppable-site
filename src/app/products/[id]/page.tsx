"use client";
import React, { useEffect, useState } from "react";
import { useCart } from '../../CartContext';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../utils/supabaseClient';
import type { Product } from '../../products';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [images, setImages] = useState<{ image_url: string }[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="p-8 text-white">Loading...</div>;
  if (!product) return <div className="p-8 text-red-600">Product not found.</div>;

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded shadow text-gray-900">
      <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
      <div className="mb-2 text-gray-600">Listing #: {product.listing_number}</div>
      <div className="mb-2 text-gray-600">Category: {categoryName}</div>
      <div className="mb-4 flex gap-4">
        <img src={product.image} alt={product.name} className="h-64 w-64 object-cover rounded border" />
        {images && images.length > 0 && (
          <div className="flex flex-col gap-2">
            {images.map((img, idx) => (
              <img key={idx} src={img.image_url} alt={`Product image ${idx + 2}`} className="h-20 w-20 object-cover rounded border" />
            ))}
          </div>
        )}
      </div>
      <div className="mb-4">
        <span className="text-xl font-semibold text-green-700 mr-4">${product.price.toFixed(2)}</span>
        <span className="text-lg line-through text-gray-500">${product.retail.toFixed(2)}</span>
      </div>
      <div className="mb-4">Stock: {product.stock ?? 0}</div>
      <div className="mb-6 whitespace-pre-line">{product.description}</div>
      <div className="flex gap-4 mt-6">
        <button className="bg-blue-600 text-white px-6 py-2 rounded text-lg font-semibold" onClick={() => addToCart({ id: product.id, name: product.name, image: product.image, price: product.price })}>Add to Cart</button>
        <button className="bg-green-600 text-white px-6 py-2 rounded text-lg font-semibold" onClick={() => { addToCart({ id: product.id, name: product.name, image: product.image, price: product.price }); router.push('/cart'); }}>Buy</button>
      </div>
    </div>
  );
} 