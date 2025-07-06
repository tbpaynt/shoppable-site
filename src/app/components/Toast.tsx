"use client";
import { useCart } from '../CartContext';
import { useEffect, useState } from 'react';

export default function Toast() {
  const { showToast, toastMessage } = useCart();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (showToast) {
      setIsVisible(true);
    }
  }, [showToast]);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="font-medium">{toastMessage}</span>
      </div>
    </div>
  );
} 