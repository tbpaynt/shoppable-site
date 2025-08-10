"use client";
import { useState, useEffect, useCallback } from 'react';

// Generate a unique session ID for this browser session
const generateSessionId = (): string => {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('productViewSessionId');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('productViewSessionId', sessionId);
  }
  return sessionId;
};

export function useProductViews() {
  const [viewCounts, setViewCounts] = useState<Record<number, number>>({});
  const [sessionId] = useState<string>(generateSessionId);

  // Track a product view
  const trackView = useCallback(async (productId: number) => {
    if (!sessionId) return;

    try {
      await fetch(`/api/products/${productId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });
    } catch (error) {
      console.error('Failed to track product view:', error);
    }
  }, [sessionId]);

  // Fetch current view counts
  const fetchViewCounts = useCallback(async () => {
    try {
      const response = await fetch('/api/products/view-counts');
      if (response.ok) {
        const counts = await response.json();
        setViewCounts(counts);
      }
    } catch (error) {
      console.error('Failed to fetch view counts:', error);
    }
  }, []);

  // Set up periodic updates every 30 seconds
  useEffect(() => {
    // Initial fetch
    fetchViewCounts();

    // Set up interval for updates
    const interval = setInterval(fetchViewCounts, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchViewCounts]);

  // Get view count for a specific product (show if 1 or more viewers)
  const getViewCount = useCallback((productId: number): number | null => {
    const count = viewCounts[productId] || 0;
    return count >= 1 ? count : null;
  }, [viewCounts]);

  return {
    trackView,
    getViewCount,
    refreshCounts: fetchViewCounts,
  };
}