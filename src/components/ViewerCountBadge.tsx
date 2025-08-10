"use client";
import { useProductViews } from '@/hooks/useProductViews';

interface ViewerCountBadgeProps {
  productId: number;
  className?: string;
}

export default function ViewerCountBadge({ productId, className = '' }: ViewerCountBadgeProps) {
  const { getViewCount } = useProductViews();
  const viewCount = getViewCount(productId);

  if (!viewCount) {
    return null;
  }

  return (
    <div className={`inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full border border-orange-200 ${className}`}>
      <div className="w-2 h-2 bg-orange-400 rounded-full mr-1.5 animate-pulse"></div>
      <span>
        {viewCount === 1 ? '1 person' : viewCount === 2 ? '2 others' : `${viewCount} others`} viewing
      </span>
    </div>
  );
}