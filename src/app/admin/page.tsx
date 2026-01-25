'use client';
import { useSession, signIn } from "next-auth/react";
import { useState, useEffect, Fragment } from "react";
import type { Product } from "../products";
import { supabase } from "../../utils/supabaseClient";
import { createClient } from '@supabase/supabase-js';

// Create service role client for admin operations (fallback to regular client if service key not available)
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  : supabase;
import Image from 'next/image';
import Link from 'next/link';

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
  const [countdownMessage, setCountdownMessage] = useState<string>("");
  const [goLiveLoading, setGoLiveLoading] = useState(false);

  // Bulk price update state
  const [bulkPriceUpdateType, setBulkPriceUpdateType] = useState<'percentage' | 'fixed' | 'set'>('percentage');
  const [bulkPriceValue, setBulkPriceValue] = useState<string>("");
  const [bulkPriceLoading, setBulkPriceLoading] = useState(false);

  // Category management state
  const [newCategory, setNewCategory] = useState({ name: '' });
  const [editingCategory, setEditingCategory] = useState<{ id: number; name: string } | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Admin panel view management
  type AdminView = 'products' | 'orders' | 'bulk-import' | 'customers' | 'reviews' | 'categories';
  const [view, setView] = useState<AdminView>('products');

  // Orders state
  type OrderSummary = {
    id: string;
    created_at: string;
    total_amount: number;
    status: string;
    user_email?: string | null;
    customer_name?: string | null;
    order_items: { id: string; name: string; quantity: number; price: number }[];
  };
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Customers state
  type Customer = {
    id: string;
    email: string;
    created_at: string;
    updated_at: string;
    customer_name?: string | null;
  };
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  // Reviews state



  // Login form state for admin authentication
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Bulk import state
  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
  const [bulkImportProgress, setBulkImportProgress] = useState(0);
  const [bulkImportErrors, setBulkImportErrors] = useState<string[]>([]);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [bulkProducts, setBulkProducts] = useState<Array<Omit<Product, 'id'> & { category_id?: number; temp_id: string }>>([]);
  const [bulkProductImages, setBulkProductImages] = useState<{ [key: string]: File | null }>({});

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

  // Fetch go-live time and countdown message on mount
  useEffect(() => {
    const fetchGoLive = async () => {
      setGoLiveLoading(true);
      const res = await fetch("/api/settings/go-live");
      const data = await res.json();
      if (data.goLiveTime) setGoLiveTime(data.goLiveTime);
      if (data.countdownMessage) setCountdownMessage(data.countdownMessage);
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

  // Update order status function
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus }),
      });

      if (res.ok) {
        const updated = await res.json();
        // Update the order in the local state
        setOrders(orders.map(order => order.id === orderId ? { ...order, status: updated.status } : order));
      } else {
        console.error('Failed to update order status');
        alert('Failed to update order status');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Error updating order status');
    }
  };

  // Print picking list function
  const handlePrintPickingList = (order: OrderSummary) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Picking List - Order ${order.id}</title>
          <style>
            @media print {
              @page {
                margin: 0.5in;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: Arial, sans-serif;
              padding: 15px;
              color: #000;
              background: #fff;
              font-size: 11px;
            }
            .header {
              border-bottom: 3px solid #000;
              padding-bottom: 10px;
              margin-bottom: 12px;
            }
            .header h1 {
              margin: 0 0 8px 0;
              font-size: 18px;
              font-weight: bold;
            }
            .order-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 12px;
              font-size: 10px;
            }
            .info-item {
              display: flex;
              flex-direction: column;
            }
            .info-label {
              font-weight: bold;
              margin-bottom: 2px;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
              font-size: 10px;
            }
            .items-table th {
              background-color: #f0f0f0;
              border: 1px solid #000;
              padding: 5px 8px;
              text-align: left;
              font-weight: bold;
              font-size: 10px;
            }
            .items-table td {
              border: 1px solid #000;
              padding: 5px 8px;
              font-size: 10px;
            }
            .items-table tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .quantity {
              text-align: center;
              font-weight: bold;
              font-size: 11px;
            }
            .footer {
              margin-top: 15px;
              padding-top: 10px;
              border-top: 2px solid #000;
              display: flex;
              justify-content: space-between;
              font-weight: bold;
              font-size: 10px;
            }
            .checkboxes {
              margin-top: 12px;
              font-size: 10px;
            }
            .checkbox-item {
              margin: 3px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📦 PICKING LIST</h1>
            <div class="order-info">
              <div class="info-item">
                <span class="info-label">Order ID:</span>
                <span>${order.id}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Order Date:</span>
                <span>${new Date(order.created_at).toLocaleString()}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Customer Name:</span>
                <span>${order.customer_name || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Customer Email:</span>
                <span>${order.user_email || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Status:</span>
                <span>${order.status.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 10%;">#</th>
                <th style="width: 50%;">Item Name</th>
                <th style="width: 15%;">Quantity</th>
                <th style="width: 25%;">✓ Picked</th>
              </tr>
            </thead>
            <tbody>
              ${order.order_items.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${item.name}</strong></td>
                  <td class="quantity">${item.quantity}</td>
                  <td style="text-align: center;">☐</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <div>
              <div>Total Items: <strong>${order.order_items.reduce((sum, item) => sum + item.quantity, 0)}</strong></div>
              <div>Unique Products: <strong>${order.order_items.length}</strong></div>
            </div>
            <div>
              <div>Order Total: <strong>$${order.total_amount.toFixed(2)}</strong></div>
            </div>
          </div>

          <div class="checkboxes">
            <div class="checkbox-item">☐ Items picked</div>
            <div class="checkbox-item">☐ Items packed</div>
            <div class="checkbox-item">☐ Ready to ship</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Fetch customers whenever view switches to 'customers'
  useEffect(() => {
    if (view !== 'customers') return;
    const fetchCustomers = async () => {
      setCustomersLoading(true);
      try {
        const res = await fetch('/api/customers');
        const data = await res.json();
        console.log('Customers API response:', data); // Debug log
        setCustomers(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Error fetching customers', e);
      } finally {
        setCustomersLoading(false);
      }
    };
    fetchCustomers();
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
    console.log('🔍 DEBUG: Starting product creation with', imageFiles.length, 'image files');
    if (imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${i}.${fileExt}`;
        console.log('🔍 DEBUG: Uploading image', i + 1, ':', fileName);
        
        const { error } = await supabaseAdmin
          .storage
          .from('product-images')
          .upload(fileName, file);
        if (error) {
          console.error('❌ Error uploading image:', error);
          alert('Image upload failed: ' + error.message);
          setLoading(false);
          return;
        }
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${fileName}`;
        console.log('✅ Image uploaded successfully:', url);
        
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
      console.log('✅ Product created with ID:', created.id);
      
      // Save additional images to product_images table using API route
      console.log('🔍 DEBUG: Saving', additionalImageUrls.length, 'additional images to database');
      for (const url of additionalImageUrls) {
        console.log('🔍 DEBUG: Inserting image URL:', url);
        try {
          const response = await fetch('/api/product-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: created.id, image_url: url })
          });
          
          if (response.ok) {
            console.log('✅ Additional image saved successfully');
          } else {
            const error = await response.text();
            console.error('❌ Error saving additional image:', error);
          }
        } catch (error) {
          console.error('❌ Error saving additional image:', error);
        }
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

  // Bulk price update function
  const handleBulkPriceUpdate = async () => {
    if (!bulkPriceValue || productList.length === 0) {
      alert('Please enter a value and ensure there are products to update');
      return;
    }

    const value = parseFloat(bulkPriceValue);
    if (isNaN(value)) {
      alert('Please enter a valid number');
      return;
    }

    if (!confirm(`Are you sure you want to update prices for ALL ${productList.length} products?`)) {
      return;
    }

    setBulkPriceLoading(true);
    const updates: Promise<any>[] = [];

    for (const product of productList) {
      let newPrice = product.price;

      if (bulkPriceUpdateType === 'percentage') {
        // Percentage change: e.g., +10% or -20%
        newPrice = product.price * (1 + value / 100);
      } else if (bulkPriceUpdateType === 'fixed') {
        // Fixed dollar amount change: e.g., +$5 or -$2
        newPrice = product.price + value;
      } else if (bulkPriceUpdateType === 'set') {
        // Set to fixed price
        newPrice = value;
      }

      // Ensure price doesn't go below 0
      newPrice = Math.max(0, newPrice);

      updates.push(
        fetch(`/api/products/${product.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price: newPrice }),
        }).then(res => res.json())
      );
    }

    try {
      await Promise.all(updates);
      // Refresh product list
      const res = await fetch("/api/products");
      const data = await res.json();
      if (Array.isArray(data)) {
        setProductList(data);
      }
      setBulkPriceValue("");
      alert(`Successfully updated prices for ${productList.length} products!`);
    } catch (error) {
      console.error('Error updating prices:', error);
      alert('Error updating prices. Please try again.');
    } finally {
      setBulkPriceLoading(false);
    }
  };

  const getCategoryName = (id: number) => categories.find(c => c.id === id)?.name || "";

  const handleGoLiveSave = async () => {
    setGoLiveLoading(true);
    await fetch("/api/settings/go-live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goLiveTime, countdownMessage }),
    });
    setGoLiveLoading(false);
  };

  // Category management functions
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name.trim()) return;

    setCategoryLoading(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategory),
      });

      if (res.ok) {
        const created = await res.json();
        setCategories(prev => [...prev, created]);
        setNewCategory({ name: '' });
        setShowCategoryForm(false);
      } else {
        const error = await res.text();
        alert(`Error creating category: ${error}`);
      }
    } catch (error) {
      alert(`Error creating category: ${error}`);
    }
    setCategoryLoading(false);
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) return;

    setCategoryLoading(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCategory),
      });

      if (res.ok) {
        const updated = await res.json();
        setCategories(prev => prev.map(cat => cat.id === updated.id ? updated : cat));
        setEditingCategory(null);
      } else {
        const error = await res.text();
        alert(`Error updating category: ${error}`);
      }
    } catch (error) {
      alert(`Error updating category: ${error}`);
    }
    setCategoryLoading(false);
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    setCategoryLoading(true);
    try {
      const res = await fetch(`/api/categories?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setCategories(prev => prev.filter(cat => cat.id !== id));
      } else {
        const error = await res.text();
        alert(`Error deleting category: ${error}`);
      }
    } catch (error) {
      alert(`Error deleting category: ${error}`);
    }
    setCategoryLoading(false);
  };

  // Helper function to download image from URL and convert to File
  // Uses API route to bypass CORS restrictions
  const downloadImageFromUrl = async (imageUrl: string): Promise<File | null> => {
    try {
      // Validate URL
      if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
        return null;
      }

      // Fetch image via API route to bypass CORS
      const response = await fetch(`/api/download-image?url=${encodeURIComponent(imageUrl)}`);

      if (!response.ok) {
        console.error(`Failed to download image from ${imageUrl}: ${response.status}`);
        return null;
      }

      // Get image as blob
      const blob = await response.blob();
      
      // Extract file extension from URL or default to jpg
      const urlPath = new URL(imageUrl).pathname;
      const ext = urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[1]?.toLowerCase() || 'jpg';
      
      // Create File object from blob
      const fileName = `downloaded_${Date.now()}.${ext}`;
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      
      return file;
    } catch (error) {
      console.error(`Error downloading image from ${imageUrl}:`, error);
      return null;
    }
  };

  // Bulk import functions
  const handleBulkImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkImportFile(file);
    setBulkImportErrors([]);
    setBulkImportLoading(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setBulkImportErrors(['CSV file must have at least a header row and one data row']);
        setBulkImportLoading(false);
        return;
      }

      // Helper function to properly parse CSV line (handles quoted values with commas)
      const parseCSVLine = (line: string): string[] => {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];
          
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              // Escaped quote (double quote)
              current += '"';
              i++; // Skip next quote
            } else {
              // Toggle quote state
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            // End of field
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        
        // Add the last field
        values.push(current.trim());
        return values;
      };

      const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
      const dataLines = lines.slice(1);
      
      const requiredHeaders = ['listing_number', 'name', 'price', 'retail'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        setBulkImportErrors([`Missing required columns: ${missingHeaders.join(', ')}`]);
        setBulkImportLoading(false);
        return;
      }

      const products: Array<Omit<Product, 'id'> & { category_id?: number; temp_id: string }> = [];
      const errors: string[] = [];

      dataLines.forEach((line, index) => {
        const values = parseCSVLine(line).map(v => v.replace(/^"|"$/g, '')); // Remove surrounding quotes
        const product: any = { temp_id: `temp_${Date.now()}_${index}` };
        
        headers.forEach((header, idx) => {
          const value = values[idx] || '';
          
          switch (header) {
            case 'listing_number':
            case 'name':
            case 'description':
            case 'image':
              product[header] = value;
              break;
            case 'price':
            case 'retail':
            case 'shipping_cost':
              product[header] = parseFloat(value) || 0;
              break;
            case 'weight_oz':
            case 'stock':
              product[header] = parseInt(value) || 0;
              break;
            case 'category_id':
              product[header] = parseInt(value) || undefined;
              break;
            case 'published':
              product[header] = value.toLowerCase() === 'true' || value === '1';
              break;
            case 'countdown':
              product[header] = value ? new Date(value) : new Date(Date.now() + 1000 * 60 * 60);
              break;
            default:
              // Ignore unknown columns
              break;
          }
        });

        // Set defaults for required fields
        if (!product.listing_number) {
          errors.push(`Row ${index + 2}: Missing listing_number`);
          return;
        }
        if (!product.name) {
          errors.push(`Row ${index + 2}: Missing name`);
          return;
        }
        if (!product.price) {
          errors.push(`Row ${index + 2}: Missing or invalid price`);
          return;
        }
        if (!product.retail) {
          errors.push(`Row ${index + 2}: Missing or invalid retail price`);
          return;
        }

        // Set defaults
        product.shipping_cost = product.shipping_cost || 0;
        product.weight_oz = product.weight_oz || 0;
        product.stock = product.stock || 0;
        product.description = product.description || '';
        product.image = product.image || '';
        product.published = product.published || false;
        product.countdown = product.countdown || new Date(Date.now() + 1000 * 60 * 60);

        products.push(product);
      });

      if (errors.length > 0) {
        setBulkImportErrors(errors);
      } else {
        setBulkProducts(products);
        setBulkImportErrors([]);
      }
    } catch {
      setBulkImportErrors(['Error parsing CSV file. Please check the format.']);
    }

    setBulkImportLoading(false);
  };

  const handleBulkSubmit = async () => {
    if (bulkProducts.length === 0) return;

    setBulkImportLoading(true);
    setBulkImportProgress(0);
    setBulkImportErrors([]);

    const results: Product[] = [];
    const errors: string[] = [];

    for (let i = 0; i < bulkProducts.length; i++) {
      const product = bulkProducts[i];
      
      try {
        const { temp_id, ...productData } = product;
        let imageUrl = productData.image || '';

        // Priority 1: Check if image column contains a URL - download it automatically
        if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
          try {
            const downloadedFile = await downloadImageFromUrl(imageUrl);
            
            if (downloadedFile) {
              // Upload downloaded image to Supabase storage
              const fileExt = downloadedFile.name.split('.').pop();
              const fileName = `${Date.now()}_${temp_id}.${fileExt}`;
              
              const { error: uploadError } = await supabaseAdmin.storage
                .from('product-images')
                .upload(fileName, downloadedFile);

              if (!uploadError) {
                imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${fileName}`;
                console.log(`✓ Successfully downloaded and uploaded image for "${product.name}"`);
              } else {
                console.warn(`Failed to upload downloaded image for "${product.name}": ${uploadError.message}`);
                // Fall through to manual file upload or use original URL
              }
            } else {
              console.warn(`Failed to download image from URL for "${product.name}"`);
              // Fall through to manual file upload or use original URL
            }
          } catch (downloadError) {
            console.error(`Error downloading image for "${product.name}":`, downloadError);
            // Fall through to manual file upload or use original URL
          }
        }

        // Priority 2: If URL download failed or no URL, check for manual file upload
        if (!imageUrl || (!imageUrl.startsWith('http') && !imageUrl.startsWith('/'))) {
          const imageFile = bulkProductImages[temp_id];
          if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}_${temp_id}.${fileExt}`;
            
            const { error: uploadError } = await supabaseAdmin.storage
              .from('product-images')
              .upload(fileName, imageFile);

            if (uploadError) {
              errors.push(`Product "${product.name}": Image upload failed - ${uploadError.message}`);
              setBulkImportProgress(((i + 1) / bulkProducts.length) * 100);
              continue;
            }

            imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${fileName}`;
          }
        }

        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...productData,
            image: imageUrl,
            countdown: productData.countdown instanceof Date ? productData.countdown.toISOString() : productData.countdown
          }),
        });

        if (res.ok) {
          const created = await res.json();
          results.push(created);
        } else {
          const error = await res.text();
          errors.push(`Product "${product.name}": ${error}`);
        }
      } catch (error) {
        errors.push(`Product "${product.name}": ${error}`);
      }

      setBulkImportProgress(((i + 1) / bulkProducts.length) * 100);
    }

    if (results.length > 0) {
      setProductList(prev => [...prev, ...results]);
    }

    if (errors.length > 0) {
      setBulkImportErrors(errors);
    }

    setBulkImportLoading(false);
    
    if (errors.length === 0) {
      setBulkProducts([]);
      setBulkImportFile(null);
      setBulkImportProgress(0);
      setBulkProductImages({});
    }
  };

  const addBulkProduct = () => {
    const newProduct = {
      temp_id: `temp_${Date.now()}`,
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
    };
    setBulkProducts(prev => [...prev, newProduct]);
  };

  const updateBulkProduct = (tempId: string, updates: Partial<typeof bulkProducts[0]>) => {
    setBulkProducts(prev => prev.map(p => 
      p.temp_id === tempId ? { ...p, ...updates } : p
    ));
  };

  const removeBulkProduct = (tempId: string) => {
    setBulkProducts(prev => prev.filter(p => p.temp_id !== tempId));
    setBulkProductImages(prev => {
      const newImages = { ...prev };
      delete newImages[tempId];
      return newImages;
    });
  };

  const handleBulkProductImageChange = (tempId: string, file: File | null) => {
    setBulkProductImages(prev => ({
      ...prev,
      [tempId]: file
    }));
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
            <Link href="/" className="text-gray-400 hover:text-gray-300 text-sm">
              ← Back to store
            </Link>
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
          <label className="mr-2 font-semibold text-white">Select view:</label>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as AdminView)}
            className="p-2 rounded text-white bg-gray-700 border border-gray-600"
          >
            <option value="products" className="text-white bg-gray-700">Products</option>
            <option value="categories" className="text-white bg-gray-700">Categories</option>
            <option value="orders" className="text-white bg-gray-700">Orders</option>
            <option value="customers" className="text-white bg-gray-700">Customers</option>
            <option value="bulk-import" className="text-white bg-gray-700">Bulk Import</option>
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
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Total</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Items</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <Fragment key={order.id}>
                  <tr 
                    className="border-t border-gray-700 hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  >
                    <td className="p-2 font-mono">{order.id}</td>
                    <td className="p-2">{new Date(order.created_at).toLocaleString()}</td>
                    <td className="p-2">{order.customer_name ?? 'N/A'}</td>
                    <td className="p-2">{order.user_email ?? 'N/A'}</td>
                    <td className="p-2">${order.total_amount.toFixed(2)}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        order.status === 'completed' 
                          ? 'bg-green-600 text-white' 
                          : order.status === 'paid' 
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-600 text-white'
                      }`}>
                        {order.status === 'completed' ? '✓ Complete' : 'Incomplete'}
                      </span>
                    </td>
                    <td className="p-2">
                      {order.order_items.length} item{order.order_items.length !== 1 ? 's' : ''}
                      <span className="ml-2 text-gray-400">
                        {expandedOrder === order.id ? '▼' : '▶'}
                      </span>
                    </td>
                  </tr>
                  {expandedOrder === order.id && (
                    <tr key={`${order.id}-details`}>
                      <td colSpan={7} className="p-4 bg-gray-800 border-t border-gray-700">
                        <div className="ml-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold">Order Items</h3>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newStatus = order.status === 'completed' ? 'paid' : 'completed';
                                  handleUpdateOrderStatus(order.id, newStatus);
                                }}
                                className={`px-4 py-2 rounded flex items-center gap-2 transition-colors ${
                                  order.status === 'completed'
                                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                                title={order.status === 'completed' ? 'Mark as incomplete' : 'Mark as complete'}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  {order.status === 'completed' ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  )}
                                </svg>
                                {order.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrintPickingList(order);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2 transition-colors"
                                title="Print picking list"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Print Picking List
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {order.order_items.map((item) => (
                              <div 
                                key={item.id} 
                                className="flex items-center justify-between py-2 px-4 bg-gray-700 rounded border-l-4 border-blue-500"
                              >
                                <div className="flex-1">
                                  <span className="font-medium">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-6 text-gray-300">
                                  <span>Quantity: <span className="font-semibold text-white">{item.quantity}</span></span>
                                  <span>Price: <span className="font-semibold text-white">${item.price.toFixed(2)}</span></span>
                                  <span>Subtotal: <span className="font-semibold text-white">${(item.price * item.quantity).toFixed(2)}</span></span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 pt-4 border-t border-gray-600">
                            <div className="flex justify-end gap-4 text-lg">
                              <span className="text-gray-400">Order Total:</span>
                              <span className="font-bold text-white">${order.total_amount.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // Render CUSTOMERS view
  if (view === 'customers') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard – Customers</h1>
        <div className="mb-6">
          <label className="mr-2 font-semibold text-white">Select view:</label>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as AdminView)}
            className="p-2 rounded text-white bg-gray-700 border border-gray-600"
          >
            <option value="products" className="text-white bg-gray-700">Products</option>
            <option value="categories" className="text-white bg-gray-700">Categories</option>
            <option value="orders" className="text-white bg-gray-700">Orders</option>
            <option value="customers" className="text-white bg-gray-700">Customers</option>
            <option value="bulk-import" className="text-white bg-gray-700">Bulk Import</option>
          </select>
        </div>

        {customersLoading ? (
          <div>Loading customers...</div>
        ) : (
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Customer List ({customers.length} total)</h2>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Customer Name</th>
                  <th className="text-left p-2">Created</th>
                  <th className="text-left p-2">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-t border-gray-700">
                    <td className="p-2 font-mono text-sm">{customer.id}</td>
                    <td className="p-2">{customer.email}</td>
                    <td className="p-2">{customer.customer_name || 'N/A'}</td>
                    <td className="p-2">{new Date(customer.created_at).toLocaleString()}</td>
                    <td className="p-2">{new Date(customer.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customers.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No customers found
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Render BULK IMPORT view
  if (view === 'bulk-import') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard – Bulk Import</h1>
        <div className="mb-6">
          <label className="mr-2 font-semibold text-white">Select view:</label>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as AdminView)}
            className="p-2 rounded text-white bg-gray-700 border border-gray-600"
          >
            <option value="products" className="text-white bg-gray-700">Products</option>
            <option value="categories" className="text-white bg-gray-700">Categories</option>
            <option value="orders" className="text-white bg-gray-700">Orders</option>
            <option value="customers" className="text-white bg-gray-700">Customers</option>
            <option value="bulk-import" className="text-white bg-gray-700">Bulk Import</option>
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CSV Upload Section */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">CSV Upload</h2>
            <div className="mb-4">
              <p className="text-gray-300 mb-2">Upload a CSV file with the following columns:</p>
              <div className="bg-gray-700 p-3 rounded text-sm font-mono text-white">
                listing_number, name, category_id, description, image, price, retail, weight_oz, stock, countdown, published
              </div>
              <p className="text-gray-400 text-sm mt-2">
                * Required: listing_number, name, price, retail<br/>
                * Optional: description, image, category_id, weight_oz, stock, countdown, published<br/>
                * category_id: Numeric ID of the category (leave blank if no category)<br/>
                * weight_oz: Weight in total ounces (e.g., 1 lb 4 oz = 20 oz)<br/>
                * stock: Quantity available (defaults to 0 if not provided)<br/>
                * published: true/false or 1/0 (defaults to false)<br/>
                * countdown: ISO date string (e.g., 2024-12-31T23:59:59Z) - optional<br/>
                * image: Leave blank, use URL (will be automatically downloaded), or upload images individually in the form below
              </p>
              <button
                onClick={() => {
                  const headers = "listing_number,name,category_id,description,image,price,retail,weight_oz,stock,countdown,published\n";
                  const sample = "A001,Sample Product,1,Optional product description,https://example.com/image.jpg,19.99,39.99,20,10,2024-12-31T23:59:59Z,true\n";
                  const csvContent = headers + sample;
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'bulk_import_template.csv';
                  a.click();
                  window.URL.revokeObjectURL(url);
                }}
                className="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Download Template CSV
              </button>
            </div>
            
            <input
              type="file"
              accept=".csv"
              onChange={handleBulkImportFile}
              className="mb-4 p-2 w-full text-white bg-gray-700 rounded"
              disabled={bulkImportLoading}
            />

            {bulkImportFile && (
              <div className="mb-4">
                <p className="text-green-400">File loaded: {bulkImportFile.name}</p>
                <p className="text-gray-300">{bulkProducts.length} products found</p>
              </div>
            )}

            {bulkImportErrors.length > 0 && (
              <div className="mb-4 p-3 bg-red-900 rounded">
                <h3 className="font-bold text-red-200 mb-2">Errors:</h3>
                {bulkImportErrors.map((error, idx) => (
                  <div key={idx} className="text-red-200 text-sm">{error}</div>
                ))}
              </div>
            )}
          </div>

          {/* Manual Bulk Form Section */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Manual Bulk Entry</h2>
            <p className="text-gray-300 mb-4">Add multiple products manually using the form below.</p>
            
            <button
              onClick={addBulkProduct}
              className="bg-blue-600 text-white px-4 py-2 rounded mb-4 hover:bg-blue-700"
              disabled={bulkImportLoading}
            >
              Add Product Form
            </button>

            {bulkProducts.length > 0 && (
              <div className="mb-4">
                <p className="text-green-400">{bulkProducts.length} products ready for import</p>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {bulkImportLoading && (
          <div className="mt-6 bg-gray-800 p-4 rounded">
            <div className="flex justify-between items-center mb-2">
              <span>Importing Products...</span>
              <span>{Math.round(bulkImportProgress)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${bulkImportProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Bulk Products Preview/Edit */}
        {bulkProducts.length > 0 && (
          <div className="mt-8 bg-gray-800 p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Products to Import ({bulkProducts.length})</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkSubmit}
                  className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
                  disabled={bulkImportLoading || bulkProducts.length === 0}
                >
                  {bulkImportLoading ? 'Importing...' : 'Import All Products'}
                </button>
                <button
                  onClick={() => setBulkProducts([])}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  disabled={bulkImportLoading}
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {bulkProducts.map((product, index) => (
                <div key={product.temp_id} className="bg-gray-700 p-4 rounded mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">Product {index + 1}</h3>
                    <button
                      onClick={() => removeBulkProduct(product.temp_id)}
                      className="text-red-400 hover:text-red-300"
                      disabled={bulkImportLoading}
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Listing Number*</label>
                      <input
                        type="text"
                        value={product.listing_number}
                        onChange={(e) => updateBulkProduct(product.temp_id, { listing_number: e.target.value })}
                        className="w-full p-2 bg-gray-600 text-white rounded text-sm"
                        disabled={bulkImportLoading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Name*</label>
                      <input
                        type="text"
                        value={product.name}
                        onChange={(e) => updateBulkProduct(product.temp_id, { name: e.target.value })}
                        className="w-full p-2 bg-gray-600 text-white rounded text-sm"
                        disabled={bulkImportLoading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Category</label>
                      <select
                        value={product.category_id || ''}
                        onChange={(e) => updateBulkProduct(product.temp_id, { category_id: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full p-2 bg-gray-600 text-white rounded text-sm"
                        disabled={bulkImportLoading}
                      >
                        <option value="">Select Category</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Price*</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.price}
                        onChange={(e) => updateBulkProduct(product.temp_id, { price: parseFloat(e.target.value) || 0 })}
                        className="w-full p-2 bg-gray-600 text-white rounded text-sm"
                        disabled={bulkImportLoading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Retail*</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.retail}
                        onChange={(e) => updateBulkProduct(product.temp_id, { retail: parseFloat(e.target.value) || 0 })}
                        className="w-full p-2 bg-gray-600 text-white rounded text-sm"
                        disabled={bulkImportLoading}
                      />
                    </div>
                                         <div>
                       <label className="block text-sm font-medium mb-1">Stock</label>
                       <input
                         type="number"
                         min="0"
                         value={product.stock}
                         onChange={(e) => updateBulkProduct(product.temp_id, { stock: parseInt(e.target.value) || 0 })}
                         className="w-full p-2 bg-gray-600 text-white rounded text-sm"
                         disabled={bulkImportLoading}
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium mb-1">Shipping Cost</label>
                       <input
                         type="number"
                         min="0"
                         step="0.01"
                         value={product.shipping_cost}
                         onChange={(e) => updateBulkProduct(product.temp_id, { shipping_cost: parseFloat(e.target.value) || 0 })}
                         className="w-full p-2 bg-gray-600 text-white rounded text-sm"
                         disabled={bulkImportLoading}
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium mb-1">Weight</label>
                       <div className="flex gap-2 items-center">
                         <input
                           type="number"
                           min="0"
                           step="1"
                           placeholder="lbs"
                           value={Math.floor(((product.weight_oz ?? 0) / 16))}
                           onChange={(e) => {
                             const lbs = parseInt(e.target.value) || 0;
                             const oz = (product.weight_oz ?? 0) % 16;
                             updateBulkProduct(product.temp_id, { weight_oz: lbs * 16 + oz });
                           }}
                           className="w-20 p-2 bg-gray-600 text-white rounded text-sm"
                           disabled={bulkImportLoading}
                         />
                         <span className="text-gray-300 text-sm">lbs</span>
                         <input
                           type="number"
                           min="0"
                           max="15.9"
                           step="0.1"
                           placeholder="oz"
                           value={(((product.weight_oz ?? 0) % 16).toFixed(1))}
                           onChange={(e) => {
                             const oz = parseFloat(e.target.value) || 0;
                             const lbs = Math.floor((product.weight_oz ?? 0) / 16);
                             updateBulkProduct(product.temp_id, { weight_oz: lbs * 16 + oz });
                           }}
                           className="w-20 p-2 bg-gray-600 text-white rounded text-sm"
                           disabled={bulkImportLoading}
                         />
                         <span className="text-gray-300 text-sm">oz</span>
                       </div>
                     </div>
                   </div>
                   
                   <div className="mt-3">
                     <label className="block text-sm font-medium mb-1">Product Image</label>
                     <p className="text-xs text-gray-400 mb-2">
                       {product.image && (product.image.startsWith('http://') || product.image.startsWith('https://')) 
                         ? `✓ Image URL detected - will be automatically downloaded: ${product.image.substring(0, 60)}...`
                         : 'Upload image file (optional if URL provided in CSV)'}
                     </p>
                     <input
                       type="file"
                       accept="image/*"
                       onChange={(e) => handleBulkProductImageChange(product.temp_id, e.target.files?.[0] || null)}
                       className="w-full p-2 bg-gray-600 text-white rounded text-sm mb-2"
                       disabled={bulkImportLoading}
                     />
                     
                     {/* Image Preview */}
                     {bulkProductImages[product.temp_id] && (
                       <div className="mb-3">
                         {/* eslint-disable-next-line @next/next/no-img-element */}
                         <img
                           src={URL.createObjectURL(bulkProductImages[product.temp_id]!)}
                           alt="Preview"
                           className="h-20 w-20 object-cover rounded border"
                         />
                         <p className="text-xs text-gray-300 mt-1">
                           {bulkProductImages[product.temp_id]!.name}
                         </p>
                       </div>
                     )}
                     
                     <label className="block text-sm font-medium mb-1">Description</label>
                     <textarea
                       value={product.description}
                       onChange={(e) => updateBulkProduct(product.temp_id, { description: e.target.value })}
                       className="w-full p-2 bg-gray-600 text-white rounded text-sm"
                       rows={2}
                       disabled={bulkImportLoading}
                     />
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* View selector */}
      <div className="mb-8">
        <label className="mr-2 font-semibold text-white">Select view:</label>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as AdminView)}
          className="p-2 rounded text-white bg-gray-700 border border-gray-600"
        >
          <option value="products" className="text-white bg-gray-700">Products</option>
          <option value="categories" className="text-white bg-gray-700">Categories</option>
          <option value="orders" className="text-white bg-gray-700">Orders</option>
          <option value="customers" className="text-white bg-gray-700">Customers</option>
          <option value="bulk-import" className="text-white bg-gray-700">Bulk Import</option>
        </select>
      </div>

      {/* PRODUCT MANAGEMENT */}
      {view === 'products' && (
        <>
          <h2 className="text-xl mb-4">Product List</h2>
          {loading && <div className="mb-4">Loading...</div>}
        </>
      )}

      {/* CATEGORY MANAGEMENT */}
      {view === 'categories' && (
        <>
          <h2 className="text-xl mb-4">Category Management</h2>
          {categoryLoading && <div className="mb-4">Loading...</div>}
          
          <div className="mb-6">
            <button
              onClick={() => setShowCategoryForm(!showCategoryForm)}
              className="bg-green-600 px-4 py-2 rounded text-white mb-4"
            >
              {showCategoryForm ? 'Cancel' : 'Add New Category'}
            </button>

            {showCategoryForm && (
              <form onSubmit={handleAddCategory} className="bg-gray-800 p-4 rounded mb-4">
                <h3 className="text-lg mb-2">Add New Category</h3>
                <input
                  type="text"
                  placeholder="Category Name"
                  className="mb-2 p-2 w-full text-black rounded"
                  value={newCategory.name}
                  onChange={e => setNewCategory({ name: e.target.value })}
                  required
                />
                <button
                  type="submit"
                  disabled={categoryLoading}
                  className="bg-blue-600 px-4 py-2 rounded text-white"
                >
                  {categoryLoading ? 'Adding...' : 'Add Category'}
                </button>
              </form>
            )}
          </div>

          <div className="grid gap-4">
            {categories.map(category => (
              <div key={category.id} className="bg-gray-800 p-4 rounded">
                {editingCategory?.id === category.id ? (
                  <form onSubmit={handleEditCategory} className="space-y-2">
                    <input
                      type="text"
                      className="p-2 w-full text-black rounded"
                      value={editingCategory.name}
                      onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                      required
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={categoryLoading}
                        className="bg-blue-600 px-3 py-1 rounded text-white text-sm"
                      >
                        {categoryLoading ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategory(null)}
                        className="bg-gray-600 px-3 py-1 rounded text-white text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold">{category.name}</h3>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingCategory(category)}
                        className="bg-yellow-600 px-3 py-1 rounded text-white text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        disabled={categoryLoading}
                        className="bg-red-600 px-3 py-1 rounded text-white text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <div className="mb-8 bg-gray-800 p-4 rounded space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-lg font-semibold mr-2">Storefront Go Live Time:</label>
          <input
            type="datetime-local"
            className="p-2 rounded text-white bg-gray-700 border border-gray-600"
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
        <div className="flex flex-col gap-2">
          <label className="text-lg font-semibold">Countdown Message (shown during countdown):</label>
          <textarea
            className="p-2 rounded text-black w-full min-h-[100px]"
            value={countdownMessage}
            onChange={e => setCountdownMessage(e.target.value)}
            placeholder="Enter a message to display during the countdown..."
            disabled={goLiveLoading}
          />
          <p className="text-sm text-gray-400">This message will be displayed on the countdown page. You can update it anytime.</p>
        </div>
      </div>

      {/* Bulk Price Update Section */}
      <div className="mb-8 bg-gray-800 p-4 rounded">
        <h3 className="text-lg font-semibold mb-4">Bulk Price Update</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Update Type:</label>
            <select
              className="p-2 rounded text-white bg-gray-700 border border-gray-600"
              value={bulkPriceUpdateType}
              onChange={(e) => setBulkPriceUpdateType(e.target.value as 'percentage' | 'fixed' | 'set')}
              disabled={bulkPriceLoading}
            >
              <option value="percentage" className="text-white bg-gray-700">Percentage Change (%)</option>
              <option value="fixed" className="text-white bg-gray-700">Fixed Dollar Change ($)</option>
              <option value="set" className="text-white bg-gray-700">Set to Fixed Price ($)</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              {bulkPriceUpdateType === 'percentage' ? 'Percentage:' : 'Amount ($):'}
            </label>
            <input
              type="number"
              step={bulkPriceUpdateType === 'percentage' ? '0.01' : '0.01'}
              className="p-2 rounded text-black w-32"
              value={bulkPriceValue}
              onChange={(e) => setBulkPriceValue(e.target.value)}
              placeholder={bulkPriceUpdateType === 'percentage' ? 'e.g., 10 or -20' : 'e.g., 10.00 or -5.00'}
              disabled={bulkPriceLoading}
            />
          </div>
          <button
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-white disabled:opacity-50"
            onClick={handleBulkPriceUpdate}
            disabled={bulkPriceLoading || !bulkPriceValue}
          >
            {bulkPriceLoading ? 'Updating...' : `Update All ${productList.length} Products`}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-3">
          {bulkPriceUpdateType === 'percentage' && 'Example: Enter 10 to increase all prices by 10%, or -20 to decrease by 20%'}
          {bulkPriceUpdateType === 'fixed' && 'Example: Enter 5 to add $5 to all prices, or -2 to subtract $2'}
          {bulkPriceUpdateType === 'set' && 'Example: Enter 19.99 to set all product prices to $19.99'}
        </p>
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
                {isValidImageUrl(product.image) && (
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
          <h3 className="text-lg mb-4 text-white">Add New Product</h3>
          
          {/* listing#/bin# */}
          <input 
            type="text" 
            placeholder="listing#/bin#" 
            className="mb-2 p-2 w-full text-white bg-gray-700 border border-gray-600 rounded placeholder-gray-400" 
            value={newProduct.listing_number || ""} 
            onChange={e => setNewProduct({ ...newProduct, listing_number: e.target.value })} 
            required 
          />
          
          {/* item name */}
          <input 
            type="text" 
            placeholder="item name" 
            className="mb-2 p-2 w-full text-white bg-gray-700 border border-gray-600 rounded placeholder-gray-400" 
            value={newProduct.name} 
            onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} 
            required 
          />
          
          {/* select category */}
          <select 
            className="mb-2 p-2 w-full text-white bg-gray-700 border border-gray-600 rounded" 
            value={newProduct.category_id ?? ""} 
            onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value ? Number(e.target.value) : undefined })} 
            required
          >
            <option value="" className="text-gray-400">Select Category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id} className="text-white">{cat.name}</option>
            ))}
          </select>
          
          {/* optional description */}
          <textarea 
            placeholder="optional description" 
            className="mb-2 p-2 w-full text-white bg-gray-700 border border-gray-600 rounded placeholder-gray-400" 
            value={newProduct.description} 
            onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} 
          />
          
          {/* choose image */}
          <div className="mb-2">
            <label className="block text-white mb-1">choose image</label>
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              className="p-2 w-full text-white bg-gray-700 border border-gray-600 rounded" 
              onChange={handleImageChange} 
            />
            {imageFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {imageFiles.map((file, idx) => (
                  <Image key={idx} src={URL.createObjectURL(file)} alt={`Preview ${idx + 1}`} width={96} height={96} className="h-24 rounded" />
                ))}
              </div>
            )}
          </div>
          
          {/* price */}
          <div className="mb-2 flex items-center">
            <label className="mr-2 w-20 text-white">Price</label>
            <span className="text-white bg-gray-700 border border-gray-600 border-r-0 px-2 py-2 rounded-l">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="p-2 w-full text-white bg-gray-700 border border-gray-600 rounded-r placeholder-gray-400"
              value={newProduct.price}
              onChange={e => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>
          
          {/* retail */}
          <div className="mb-2 flex items-center">
            <label className="mr-2 w-20 text-white">Retail</label>
            <span className="text-white bg-gray-700 border border-gray-600 border-r-0 px-2 py-2 rounded-l">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="p-2 w-full text-white bg-gray-700 border border-gray-600 rounded-r placeholder-gray-400"
              value={newProduct.retail}
              onChange={e => setNewProduct({ ...newProduct, retail: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>
          
          {/* weight lbs oz */}
          <div className="mb-2 flex items-center gap-2">
            <label className="mr-2 w-20 text-white">Weight</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="lbs"
              className="p-2 w-24 text-white bg-gray-700 border border-gray-600 rounded placeholder-gray-400"
              value={Math.floor(((newProduct.weight_oz ?? 0) / 16))}
              onChange={e => {
                const lbs = parseInt(e.target.value) || 0;
                const oz = (newProduct.weight_oz ?? 0) % 16;
                setNewProduct({ ...newProduct, weight_oz: lbs * 16 + oz });
              }}
              required
            />
            <span className="text-white">lbs</span>
            <input
              type="number"
              min="0"
              max="15.9"
              step="0.1"
              placeholder="oz"
              className="p-2 w-24 text-white bg-gray-700 border border-gray-600 rounded placeholder-gray-400"
              value={(((newProduct.weight_oz ?? 0) % 16).toFixed(1))}
              onChange={e => {
                const oz = parseFloat(e.target.value) || 0;
                const lbs = Math.floor((newProduct.weight_oz ?? 0) / 16);
                setNewProduct({ ...newProduct, weight_oz: lbs * 16 + oz });
              }}
              required
            />
            <span className="text-white">oz</span>
          </div>
          
          {/* quantity */}
          <input 
            type="number" 
            placeholder="quantity" 
            className="mb-2 p-2 w-full text-white bg-gray-700 border border-gray-600 rounded placeholder-gray-400" 
            value={newProduct.stock} 
            onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })} 
            required 
          />
          
          {/* date and time added */}
          <div className="mb-2">
            <label className="block text-white mb-1">date and time added</label>
            <input 
              type="datetime-local" 
              className="p-2 w-full text-white bg-gray-700 border border-gray-600 rounded" 
              value={new Date(newProduct.countdown).toISOString().slice(0,16)} 
              onChange={e => setNewProduct({ ...newProduct, countdown: new Date(e.target.value) })} 
              required 
            />
          </div>
          
          {/* published checkbox */}
          <div className="mb-4 flex items-center">
            <input 
              type="checkbox" 
              className="mr-2" 
              checked={newProduct.published} 
              onChange={e => setNewProduct({ ...newProduct, published: e.target.checked })} 
            />
            <label className="text-white">Published</label>
          </div>
          
          {/* buttons */}
          <div className="flex gap-2">
            <button 
              type="submit" 
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
            <button 
              type="button" 
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded" 
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              onClick={async () => {
                setLoading(true);
                const res = await fetch('/api/products/publish-all', { method: 'POST' });
                if (res.ok) {
                  const updated = await res.json();
                  setProductList(updated);
                }
                setLoading(false);
              }}
              disabled={loading}
            >
              {loading ? 'Publishing...' : 'Publish All'}
            </button>
          </div>
        </form>
      ) : (
        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mb-8" onClick={() => setShowAddForm(true)}>Add New Product</button>
      )}
      {/* Edit Product Form */}
      {editingProduct && (
        <form onSubmit={handleEditProduct} className="mb-8 bg-gray-800 p-4 rounded">
          <h3 className="text-lg mb-2">Edit Product</h3>
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">Product Name</label>
            <input type="text" placeholder="Name" className="p-1 w-full text-black" value={editingProduct?.name || ""} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, name: e.target.value })} required />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">Image URL</label>
            <input type="text" placeholder="Image URL" className="p-1 w-full text-black" value={editingProduct?.image || ""} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, image: e.target.value })} required />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">Sell Price</label>
            <input type="number" placeholder="Sell Price" className="p-1 w-full text-black" value={editingProduct?.price ?? 0} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })} required />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">Retail Price</label>
            <input type="number" placeholder="Retail Price" className="p-1 w-full text-black" value={editingProduct?.retail ?? 0} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, retail: parseFloat(e.target.value) || 0 })} required />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">Shipping Cost</label>
            <input type="number" placeholder="Shipping Cost" className="p-1 w-full text-black" value={editingProduct?.shipping_cost ?? 0} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, shipping_cost: parseFloat(e.target.value) || 0 })} required />
          </div>
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
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">Stock Quantity</label>
            <input type="number" placeholder="Stock Quantity" className="p-1 w-full text-black" value={editingProduct?.stock ?? 0} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })} required />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">Countdown End Date/Time</label>
            <input type="datetime-local" className="p-1 w-full text-black" value={editingProduct ? new Date(editingProduct.countdown).toISOString().slice(0,16) : ""} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, countdown: new Date(e.target.value) })} required />
          </div>
          <div className="mb-2 flex items-center">
            <input type="checkbox" className="mr-2" checked={editingProduct?.published || false} onChange={e => editingProduct && setEditingProduct({ ...editingProduct, published: e.target.checked })} />
            <label className="text-sm font-medium text-gray-300">Published</label>
          </div>
          <div>
            <button type="submit" className="bg-yellow-600 px-4 py-2 rounded mr-2">Save</button>
            <button type="button" className="bg-gray-600 px-4 py-2 rounded" onClick={() => setEditingProduct(null)}>Cancel</button>
          </div>
        </form>
      )}
      <button 
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mb-4" 
        onClick={async () => {
          setLoading(true);
          const res = await fetch('/api/products/publish-all', { method: 'POST' });
          if (res.ok) {
            const updated = await res.json();
            setProductList(updated);
          }
          setLoading(false);
        }}
        disabled={loading}
      >
        {loading ? 'Publishing...' : 'Publish All'}
      </button>
    </div>
  );
}