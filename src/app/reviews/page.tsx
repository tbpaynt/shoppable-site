"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Review {
  id: string;
  product_id: number;
  rating: number;
  title?: string;
  comment?: string;
  created_at: string;
  is_approved: boolean;
  is_verified_purchase: boolean;
  products: {
    name: string;
  } | null;
  users: {
    email: string;
  } | null;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // Review form state
  const [formData, setFormData] = useState({
    product_id: '',
    product_name: '',
    customer_name: '',
    rating: 5,
    comment: ''
  });

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const response = await fetch('/api/reviews/public');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch reviews');
      }
      
      setReviews(data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      // Set empty reviews array to prevent infinite loading
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('product_reviews')
        .insert([{
          product_id: parseInt(formData.product_id),
          user_id: '00000000-0000-0000-0000-000000000000', // Placeholder - would need user auth
          rating: formData.rating,
          title: formData.product_name,
          comment: formData.comment,
          is_approved: false // Reviews need admin approval
        }]);

      if (error) throw error;

      setMessage('Thank you for your review! It will be posted after approval.');
      setFormData({
        product_id: '',
        product_name: '',
        customer_name: '',
        rating: 5,
        comment: ''
      });
      setShowReviewForm(false);
    } catch (error) {
      setMessage('Error submitting review. Please try again.');
      console.error('Error submitting review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'text-yellow-400' : 'text-gray-400'}>
        ★
      </span>
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white pt-16">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center">Loading reviews...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pt-16">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8 text-center">Customer Reviews</h1>
        
        <div className="bg-gray-800 rounded-lg p-8 mb-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold mb-4">Share Your Experience</h2>
            <p className="text-gray-300 mb-6">
              We value your feedback! Share your experience with our products and help other customers make informed decisions.
            </p>
            <button
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {showReviewForm ? 'Cancel' : 'Write a Review'}
            </button>
          </div>

          {showReviewForm && (
            <form onSubmit={handleSubmitReview} className="bg-gray-700 rounded-lg p-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Product ID</label>
                  <input
                    type="number"
                    value={formData.product_id}
                    onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Product Name</label>
                  <input
                    type="text"
                    value={formData.product_name}
                    onChange={(e) => setFormData({...formData, product_name: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                    required
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Your Name</label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Rating</label>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({...formData, rating: star})}
                      className={`text-2xl ${star <= formData.rating ? 'text-yellow-400' : 'text-gray-400'}`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="ml-2 text-gray-300">{formData.rating} out of 5</span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Your Review</label>
                <textarea
                  value={formData.comment}
                  onChange={(e) => setFormData({...formData, comment: e.target.value})}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                  placeholder="Share your experience with this product..."
                  required
                />
              </div>

              {message && (
                <div className={`mb-4 p-3 rounded ${message.includes('Error') ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-600 text-white py-3 px-4 rounded font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-center mb-8">What Our Customers Say</h2>
          
          {reviews.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <p className="text-lg">No reviews yet. Be the first to share your experience!</p>
            </div>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-300">{review.products?.name || 'Product'}</h3>
                    <p className="text-gray-400">Reviewed by {review.users?.email?.split('@')[0] || 'Customer'}***</p>
                    {review.is_verified_purchase && (
                      <span className="bg-green-600 text-white text-xs px-2 py-1 rounded mt-1 inline-block">
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  <div className="flex items-center">
                    <div className="flex mr-2">
                      {renderStars(review.rating)}
                    </div>
                    <span className="text-sm text-gray-400">{review.rating}/5</span>
                  </div>
                </div>
                {review.title && (
                  <h4 className="font-semibold mb-2 text-gray-200">{review.title}</h4>
                )}
                <p className="text-gray-300">{review.comment}</p>
                <p className="text-sm text-gray-500 mt-4">
                  {new Date(review.created_at).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 