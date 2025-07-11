"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';

export type CartItem = {
  id: number;
  name: string;
  image: string;
  price: number;
  shipping_cost: number;
  quantity: number;
  stock?: number; // Add stock to cart item for validation
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>, quantity?: number) => Promise<{success: boolean; message: string}>;
  removeFromCart: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => Promise<{success: boolean; message: string}>;
  clearCart: () => void;
  cartTotal: number;
  cartItemCount: number;
  shippingTotal: number;
  cartAnimationTrigger: number;
  showToast: boolean;
  toastMessage: string;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartAnimationTrigger, setCartAnimationTrigger] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Load cart from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('cart');
    if (stored) setCart(JSON.parse(stored));
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Helper function to get current stock from API
  const getCurrentStock = async (productId: number): Promise<number> => {
    try {
      const response = await fetch(`/api/products/${productId}`);
      if (!response.ok) throw new Error('Failed to fetch product');
      const product = await response.json();
      return product.stock || 0;
    } catch (error) {
      console.error('Error fetching stock:', error);
      return 0; // Default to 0 if we can't fetch stock
    }
  };

  const addToCart = async (item: Omit<CartItem, 'quantity'>, quantity: number = 1): Promise<{success: boolean; message: string}> => {
    try {
      // Get current stock level
      const currentStock = await getCurrentStock(item.id);
      
      // Check current cart quantity for this item
      const existingItem = cart.find(i => i.id === item.id);
      const currentCartQuantity = existingItem ? existingItem.quantity : 0;
      const totalQuantityAfterAdd = currentCartQuantity + quantity;
      
      // Validate stock
      if (totalQuantityAfterAdd > currentStock) {
        const availableToAdd = Math.max(0, currentStock - currentCartQuantity);
        if (availableToAdd === 0) {
          return { success: false, message: `${item.name} is out of stock` };
        } else {
          return { success: false, message: `Only ${availableToAdd} more ${item.name} available` };
        }
      }
      
      // Add to cart with stock info
      setCart(prev => {
        const existing = prev.find(i => i.id === item.id);
        if (existing) {
          return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + quantity, stock: currentStock } : i);
        }
        return [...prev, { ...item, quantity, stock: currentStock }];
      });
      
      // Trigger animations
      setCartAnimationTrigger(prev => prev + 1);
      const quantityText = quantity > 1 ? ` (${quantity})` : '';
      setToastMessage(`${item.name}${quantityText} added to cart!`);
      setShowToast(true);
      
      // Hide toast after 3 seconds
      setTimeout(() => setShowToast(false), 3000);
      
      return { success: true, message: `${item.name} added to cart!` };
    } catch (error) {
      return { success: false, message: 'Failed to add item to cart' };
    }
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = async (id: number, quantity: number): Promise<{success: boolean; message: string}> => {
    try {
      // Get current stock level
      const currentStock = await getCurrentStock(id);
      
      // Validate stock
      if (quantity > currentStock) {
        return { success: false, message: `Only ${currentStock} items available in stock` };
      }
      
      if (quantity < 1) {
        return { success: false, message: 'Quantity must be at least 1' };
      }
      
      // Update cart with stock info
      setCart(prev => prev.map(i => i.id === id ? { ...i, quantity, stock: currentStock } : i));
      
      return { success: true, message: 'Quantity updated' };
    } catch (error) {
      return { success: false, message: 'Failed to update quantity' };
    }
  };

  const clearCart = () => setCart([]);

  // Add computed values for cart total and item count
  const cartTotal = cart.reduce((sum, item) => sum + (item.price + (item.shipping_cost || 0)) * item.quantity, 0);
  const shippingTotal = cart.reduce((sum, item) => sum + (item.shipping_cost || 0) * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartItemCount, shippingTotal, cartAnimationTrigger, showToast, toastMessage }}>
      {children}
    </CartContext.Provider>
  );
}; 