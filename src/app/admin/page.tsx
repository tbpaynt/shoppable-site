'use client';
import { useSession, signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import type { Product } from "../products";
import { supabase } from "../../utils/supabaseClient";
import Image from 'next/image';

// Robust helper to format UTC string to local datetime-local input value
function utcToLocalInputValue(utcString: string) {
  if (!utcString) return '';
  const date = new Date(utcString);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Robust helper to convert local input value to UTC ISO string
function localInputValueToUTC(localValue: string) {
  if (!localValue) return '';
  const localDate = new Date(localValue);
  return localDate.toISOString();
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [productList, setProductList] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Omit<Product, 'id'> & { category_id?: number }>(
    {
      listing_number: "",
      name: "",
      image: "",
      price: 0,
      retail: 0,
      countdown: new Date(Date.now() + 1000 * 60 * 60),
      stock: 0,
      weight_oz: 0,
      description: "",
      shipping_cost: 0,
      published: false,
      category_id: undefined,
    }
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [goLiveTime, setGoLiveTime] = useState<string>("");
  const [goLiveLoading, setGoLiveLoading] = useState(false);

  // Admin panel view management
  type AdminView = 'products' | 'orders';
  const [view, setView] = useState<AdminView>('products');

  // Orders state
  type OrderSummary = {
    id: string;
    created_at: string;
    total_amount: number;
    status: string;
    user_email?: string | null;
    order_items: { id: string; name: string; quantity: number; price: number }[];
  };
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Login form state for admin authentication
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Handle email/password login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setLoginError('Invalid email or password');
      }
      // If successful, the session will update and page will re-render
    } catch {
      setLoginError('An error occurred during login');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Google login
  const handleGoogleLogin = async () => {
    setLoginLoading(true);
    try {
      await signIn('google', { callbackUrl: '/admin' });
    } catch {
      setLoginError('Google login failed');
      setLoginLoading(false);
    }
  };

  // Fetch categories from Supabase
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase.from("categories").select("id, name");
      if (!error && data) setCategories(data);
    };
    fetchCategories();
  }, []);

  // Fetch products from API
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const res = await fetch("/api/products");
      try {
        const data = await res.json();
        if (!Array.isArray(data)) {
          setProductList([]);
        } else {
          setProductList(data);
        }
      } catch {
        setProductList([]);
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  // Fetch go-live time on mount
  useEffect(() => {
    const fetchGoLive = async () => {
      setGoLiveLoading(true);
      const res = await fetch("/api/settings/go-live");
      const data = await res.json();
      if (data.goLiveTime) setGoLiveTime(data.goLiveTime);
      setGoLiveLoading(false);
    };
    fetchGoLive();
  }, []);

  // Fetch orders whenever view switches to 'orders'
  useEffect(() => {
    if (view !== 'orders') return;
    const fetchOrders = async () => {
      setOrdersLoading(true);
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Error fetching orders', e);
      } finally {
        setOrdersLoading(false);
      }
    };
    fetchOrders();
  }, [view]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImageFiles(Array.from(e.target.files));
    }
  };

  // Add Product
  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    let imageUrl = newProduct.image;
    const additionalImageUrls: string[] = [];
    // Upload all images if files are selected
    if (imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${i}.${fileExt}`;
        const { error } = await supabase
          .storage
          .from('product-images')
          .upload(fileName, file);
        if (error) {
          alert('Image upload failed: ' + error.message);
          setLoading(false);
          return;
        }
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${fileName}`;
        if (i === 0) imageUrl = url;
        else additionalImageUrls.push(url);
      }
    }
    // Create product
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newProduct, image: imageUrl, countdown: newProduct.countdown instanceof Date ? newProduct.countdown.toISOString() : newProduct.countdown }),
    });
    if (res.ok) {
      const created = await res.json();
      // Save additional images to product_images table
      for (const url of additionalImageUrls) {
        await supabase.from('product_images').insert({ product_id: created.id, image_url: url });
      }
      setProductList([...productList, created]);
      setNewProduct({ listing_number: "", name: "", image: "", price: 0, retail: 0, countdown: new Date(Date.now() + 1000 * 60 * 60), stock: 0, weight_oz: 0, description: "", shipping_cost: 0, published: false, category_id: undefined });
      setImageFiles([]);
      setShowAddForm(false);
    }
    setLoading(false);
  };

  // Edit Product
  const handleEditProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editingProduct) {
      setLoading(true);
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editingProduct, countdown: editingProduct.countdown instanceof Date ? editingProduct.countdown.toISOString() : editingProduct.countdown }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProductList(productList.map(p => p.id === updated.id ? updated : p));
        setEditingProduct(null);
      }
      setLoading(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id: number) => {
    setLoading(true);
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProductList(productList.filter(p => p.id !== id));
    }
    setLoading(false);
  };

  const getCategoryName = (id: number) => categories.find(c => c.id === id)?.name || "";

  const handleGoLiveSave = async () => {
    setGoLiveLoading(true);
    await fetch("/api/settings/go-live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goLiveTime }),
    });
    setGoLiveLoading(false);
  };

  if (status === "loading") return <div>Loading...</div>;
  
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)' }}>
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Admin Access Required</h1>
            <p className="text-gray-300">Sign in to access the admin panel</p>
          </div>

          {loginError && (
            <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-300 px-4 py-3 rounded mb-6">
              {loginError}
            </div>
          )}

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            disabled={loginLoading}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 py-3 px-4 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">Or continue with email</span>
            </div>
          </div>

          {/* Email/Password Login */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your admin email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginLoading ? 'Signing in...' : 'Sign In to Admin'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="/" className="text-gray-400 hover:text-gray-300 text-sm">
              ← Back to store
            </a>
          </div>
                  </div>
        </div>
      );
    }

  if (session?.user?.role !== 'admin') {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
            <h1 className="text-2xl mb-4">Access Denied</h1>
            <p>You do not have permission to view this page.</p>
        </div>
    )
  }

  // Render ORDERS view separately for clarity
  if (view === 'orders') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard – Orders</h1>
        <div className="mb-6">
          <label className="mr-2 font-semibold">Select view:</label>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as AdminView)}
            className="p-2 rounded text-black"
          >
            <option value="products">Products</option>
            <option value="orders">Orders</option>
          </select>
        </div>

        {ordersLoading ? (
          <div>Loading orders...</div>
        ) : (
          <table className="w-full mb-8">
            <thead>
              <tr>
                <th className="text-left p-2">Order ID</th>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Customer</th>
                <th className="text-left p-2">Total</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Items</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-gray-700">
                  <td className="p-2 font-mono">{order.id}</td>
                  <td className="p-2">{new Date(order.created_at).toLocaleString()}</td>
                  <td className="p-2">{order.user_email ?? 'N/A'}</td>
                  <td className="p-2">${order.total_amount.toFixed(2)}</td>
                  <td className="p-2">{order.status}</td>
                  <td className="p-2">
                    {order.order_items.map((it) => `${it.name} x${it.quantity}`).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* View selector */}
      <div className="mb-8">
        <label className="mr-2 font-semibold">Select view:</label>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as AdminView)}
          className="p-2 rounded text-black"
        >
          <option value="products">Products</option>
          <option value="orders">Orders</option>
        </select>
      </div>

      {/* PRODUCT MANAGEMENT */}
      {view === 'products' && (
        <>
          <h2 className="text-xl mb-4">Product List</h2>
          {loading && <div className="mb-4">Loading...</div>}
        </>
      )}
      <div className="mb-8 bg-gray-800 p-4 rounded flex items-center gap-4">
        <label className="text-lg font-semibold mr-2">Storefront Go Live Time:</label>
        <input
          type="datetime-local"
          className="p-2 rounded text-black"
          value={utcToLocalInputValue(goLiveTime)}
          onChange={e => setGoLiveTime(localInputValueToUTC(e.target.value))}
          disabled={goLiveLoading}
        />
        <button
          className="bg-blue-600 px-4 py-2 rounded text-white"
          onClick={handleGoLiveSave}
          disabled={goLiveLoading}
        >
          {goLiveLoading ? "Saving..." : "Save"}
        </button>
      </div>
      <table className="w-full mb-8">
        <thead>
          <tr>
            <th className="text-left p-2">ID</th>
            <th className="text-left p-2">Listing #</th>
            <th className="text-left p-2">Category</th>
            <th className="text-left p-2">Image</th>
            <th className="text-left p-2">Name</th>
            <th className="text-left p-2">Price</th>
            <th className="text-left p-2">Retail</th>
            <th className="text-left p-2">Shipping</th>
            <th className="text-left p-2">Weight</th>
            <th className="text-left p-2">Stock</th>
            <th className="text-left p-2">Published</th>
            <th className="text-left p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {productList.map(product => (
            <tr key={product.id} className="border-t border-gray-700">
              <td className="p-2">{product.id}</td>
              <td className="p-2">{product.listing_number}</td>
              <td className="p-2">{typeof product.category_id === 'number' ? getCategoryName(product.category_id) : ''}</td>
              <td className="p-2">
                {product.image && (
                  <Image src={product.image} alt={product.name} width={64} height={64} className="h-16 w-16 object-cover rounded" />
                )}
              </td>
              <td className="p-2">{product.name}</td>
              <td className="p-2">${product.price.toFixed(2)}</td>
              <td className="p-2">${product.retail.toFixed(2)}</td>
              <td className="p-2">${(product.shipping_cost ?? 0).toFixed(2)}</td>
              <td className="p-2">{product.weight_oz ?? 0}</td>
              <td className="p-2">{product.stock ?? 0}</td>
              <td className="p-2">{product.published ? 'Yes' : 'No'}</td>
              <td className="p-2">
                <button className="bg-yellow-600 px-2 py-1 rounded mr-2" onClick={() => setEditingProduct(product)}>Edit</button>
                <button className="bg-red-600 px-2 py-1 rounded" onClick={() => handleDeleteProduct(product.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Add Product Form */}
      {showAddForm ? (
        <form onSubmit={handleAddProduct} className="mb-8 bg-gray-800 p-4 rounded">
          <h3 className="text-lg mb-2">Add New Product</h3>
          <input type="text" placeholder="Listing Number" className="mb-2 p-1 w-full text-black" value={newProduct.listing_number || ""} onChange={e => setNewProduct({ ...newProduct, listing_number: e.target.value })} required />
          <input type="text" placeholder="Name" className="mb-2 p-1 w-full text-black" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} required />
          <select className="mb-2 p-1 w-full text-black" value={newProduct.category_id ?? ""} onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value ? Number(e.target.value) : undefined })} required>
            <option value="">Select Category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <textarea placeholder="Description" className="mb-2 p-1 w-full text-black" value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} />
          <input type="file" accept="image/*" multiple className="mb-2 p-1 w-full text-black" onChange={handleImageChange} />
          {imageFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {imageFiles.map((file, idx) => (
                <Image key={idx} src={URL.createObjectURL(file)} alt={`Preview ${idx + 1}`} width={96} height={96} className="h-24" />
              ))}
            </div>
          )}
          <input type="text" placeholder="Image URL (optional)" className="mb-2 p-1 w-full text-black" value={newProduct.image} onChange={e => setNewProduct({ ...newProduct, image: e.target.value })} />
          <div className="mb-2 flex items-center">
            <label className="mr-2 w-20">Price</label>
            <span className="text-black bg-gray-200 px-2 py-1 rounded-l">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="p-1 w-full text-black rounded-r"
              value={newProduct.price}
              onChange={e => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>
          <div className="mb-2 flex items-center">
            <label className="mr-2 w-20">Retail</label>
            <span className="text-black bg-gray-200 px-2 py-1 rounded-l">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="p-1 w-full text-black rounded-r"
              value={newProduct.retail}
              onChange={e => setNewProduct({ ...newProduct, retail: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>
          <div className="mb-2 flex items-center">
            <label className="mr-2 w-20">Shipping</label>
            <span className="text-black bg-gray-200 px-2 py-1 rounded-l">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="p-1 w-full text-black rounded-r"
              value={newProduct.shipping_cost}
              onChange={e => setNewProduct({ ...newProduct, shipping_cost: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>
          <div className="mb-2 flex items-center gap-2">
            <label className="mr-2 w-20">Weight</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="lbs"
              className="p-1 w-24 text-black rounded"
              value={Math.floor(((newProduct.weight_oz ?? 0) / 16))}
              onChange={e => {
                const lbs = parseInt(e.target.value) || 0;
                const oz = (newProduct.weight_oz ?? 0) % 16;
                setNewProduct({ ...newProduct, weight_oz: lbs * 16 + oz });
              }}
              required
            />
            <span className="text-gray-300">lbs</span>
            <input
              type="number"
              min="0"
              max="15.9"
              step="0.1"
              placeholder="oz"
              className="p-1 w-24 text-black rounded"
              value={(((newProduct.weight_oz ?? 0) % 16).toFixed(1))}
              onChange={e => {
                const oz = parseFloat(e.target.value) || 0;
                const lbs = Math.floor((newProduct.weight_oz ?? 0) / 16);
                setNewProduct({ ...newProduct, weight_oz: lbs * 16 + oz });
              }}
              required
            />
            <span className="text-gray-300">oz</span>
          </div>
          <input type="number" placeholder="Stock" className="mb-2 p-1 w-full text-black" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })} required />
          <input type="datetime-local" className="mb-2 p-1 w-full text-black" value={new Date(newProduct.countdown).toISOString().slice(0,16)} onChange={e => setNewProduct({ ...newProduct, countdown: new Date(e.target.value) })} required />
          <input type="checkbox" className="mb-2 mr-2" checked={newProduct.published} onChange={e => setNewProduct({ ...newProduct, published: e.target.checked })} />
          <label className="mr-4">Published</label>
          <div>
            <button type="submit" className="bg-green-600 px-4 py-2 rounded mr-2">Add</button>
            <button type="button" className="bg-gray-600 px-4 py-2 rounded" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="bg-green-600 px-4 py-2 rounded mb-8" onClick={() => setShowAddForm(true)}>Add New Product</button>
      )}
      {/* Edit Product Form */}
      {editingProduct && (
        <form onSubmit={handleEditProduct} className="mb-8 bg-gray-800 p-4 rounded">
          <h3 className="text-lg mb-2">Edit Product</h3>
          <input type="text" placeholder="Name" className="mb-2 p-1 w-full text-black" value={editingProduct?.name || ""} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, name: e.target.value })} required />
          <input type="text" placeholder="Image URL" className="mb-2 p-1 w-full text-black" value={editingProduct?.image || ""} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, image: e.target.value })} required />
          <input type="number" placeholder="Price" className="mb-2 p-1 w-full text-black" value={editingProduct?.price ?? 0} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })} required />
          <input type="number" placeholder="Retail" className="mb-2 p-1 w-full text-black" value={editingProduct?.retail ?? 0} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, retail: parseFloat(e.target.value) || 0 })} required />
          <input type="number" placeholder="Shipping" className="mb-2 p-1 w-full text-black" value={editingProduct?.shipping_cost ?? 0} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, shipping_cost: parseFloat(e.target.value) || 0 })} required />
          <div className="mb-2 flex items-center gap-2">
            <label className="mr-2 w-20">Weight</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="lbs"
              className="p-1 w-24 text-black rounded"
              value={editingProduct ? Math.floor(((editingProduct.weight_oz ?? 0) / 16)) : 0}
              onChange={e => {
                if (!editingProduct) return;
                const lbs = parseInt(e.target.value) || 0;
                const oz = (editingProduct.weight_oz ?? 0) % 16;
                setEditingProduct({ ...editingProduct, weight_oz: lbs * 16 + oz });
              }}
              required
            />
            <span className="text-gray-300">lbs</span>
            <input
              type="number"
              min="0"
              max="15.9"
              step="0.1"
              placeholder="oz"
              className="p-1 w-24 text-black rounded"
              value={editingProduct ? (((editingProduct.weight_oz ?? 0) % 16).toFixed(1)) : 0}
              onChange={e => {
                if (!editingProduct) return;
                const oz = parseFloat(e.target.value) || 0;
                const lbs = Math.floor((editingProduct.weight_oz ?? 0) / 16);
                setEditingProduct({ ...editingProduct, weight_oz: lbs * 16 + oz });
              }}
              required
            />
            <span className="text-gray-300">oz</span>
          </div>
          <input type="datetime-local" className="mb-2 p-1 w-full text-black" value={editingProduct ? new Date(editingProduct.countdown).toISOString().slice(0,16) : ""} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, countdown: new Date(e.target.value) })} required />
          <input type="checkbox" className="mb-2 mr-2" checked={editingProduct?.published || false} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, published: e.target.checked })} />
          <label className="mr-4">Published</label>
          <div>
            <button type="submit" className="bg-yellow-600 px-4 py-2 rounded mr-2">Save</button>
            <button type="button" className="bg-gray-600 px-4 py-2 rounded" onClick={() => setEditingProduct(null)}>Cancel</button>
          </div>
        </form>
      )}
      <button className="bg-blue-600 px-4 py-2 rounded mb-4" onClick={async () => {
        setLoading(true);
        const res = await fetch('/api/products/publish-all', { method: 'POST' });
        if (res.ok) {
          const updated = await res.json();
          setProductList(updated);
        }
        setLoading(false);
      }}>Publish All</button>
    </div>
  );
}