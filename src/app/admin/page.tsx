'use client';
import { useSession, signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import type { Product } from "../products";
import { supabase } from "../../utils/supabaseClient";

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
  const [newProduct, setNewProduct] = useState<Omit<Product, 'id'> & { category_id?: string }>({
    listing_number: "",
    name: "",
    image: "",
    price: 0,
    retail: 0,
    countdown: new Date(Date.now() + 1000 * 60 * 60),
    stock: 0,
    description: "",
    published: false,
    category_id: "",
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [goLiveTime, setGoLiveTime] = useState<string>("");
  const [goLiveLoading, setGoLiveLoading] = useState(false);

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
      let data;
      try {
        data = await res.json();
      } catch {
        data = [];
      }
      if (!Array.isArray(data)) {
        setProductList([]);
      } else {
        setProductList(data);
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
    let additionalImageUrls: string[] = [];
    // Upload all images if files are selected
    if (imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${i}.${fileExt}`;
        const { data, error } = await supabase
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
      setNewProduct({ listing_number: "", name: "", image: "", price: 0, retail: 0, countdown: new Date(Date.now() + 1000 * 60 * 60), stock: 0, description: "", published: false, category_id: "" });
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

  // Helper to get category name by id
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

  // UI logic (after hooks)
  if (status === "loading") return <div>Loading...</div>;
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
        <h1 className="text-2xl mb-4">Admin Access Required</h1>
        <button onClick={() => signIn()} className="bg-blue-600 px-4 py-2 rounded">Sign in</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <h2 className="text-xl mb-4">Product List</h2>
      {loading && <div className="mb-4">Loading...</div>}
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
              <td className="p-2">{getCategoryName(product.category_id)}</td>
              <td className="p-2">
                {product.image && (
                  <img src={product.image} alt={product.name} className="h-16 w-16 object-cover rounded" />
                )}
              </td>
              <td className="p-2">{product.name}</td>
              <td className="p-2">${product.price.toFixed(2)}</td>
              <td className="p-2">${product.retail.toFixed(2)}</td>
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
          <select className="mb-2 p-1 w-full text-black" value={newProduct.category_id} onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })} required>
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
                <img key={idx} src={URL.createObjectURL(file)} alt={`Preview ${idx + 1}`} className="h-24" />
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