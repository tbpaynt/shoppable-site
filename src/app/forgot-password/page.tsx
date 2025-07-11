"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setMessage(data.message);
      } else {
        setIsSuccess(false);
        setMessage(data.message || 'An error occurred');
      }
    } catch (error) {
      setIsSuccess(false);
      setMessage('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)' }}>
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Forgot Password?</h1>
          <p className="text-gray-300">Enter your email to receive a password reset link</p>
        </div>

        {message && (
          <div className={`px-4 py-3 rounded mb-6 ${
            isSuccess 
              ? 'bg-green-500 bg-opacity-20 border border-green-500 text-green-300' 
              : 'bg-red-500 bg-opacity-20 border border-red-500 text-red-300'
          }`}>
            {message}
          </div>
        )}

        {!isSuccess ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email address"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <div className="text-center">
            <div className="mb-6">
              <svg className="w-16 h-16 text-green-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-300 text-sm">
                Please check your email and follow the instructions to reset your password. 
                The reset link will expire in 1 hour.
              </p>
            </div>
            
            <button
              onClick={() => {
                setIsSuccess(false);
                setMessage('');
                setEmail('');
              }}
              className="text-blue-400 hover:text-blue-300 text-sm underline"
            >
              Try a different email
            </button>
          </div>
        )}

        <div className="mt-6 text-center space-y-3">
          <p className="text-gray-400">
            Remember your password?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
              Back to Sign In
            </Link>
          </p>
          
          <p className="text-gray-400">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
              Sign Up
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-gray-400 hover:text-gray-300 text-sm">
            ← Back to store
          </Link>
        </div>
      </div>
    </div>
  );
} 