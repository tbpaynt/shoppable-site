"use client";
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenParam = searchParams?.get('token');
    if (!tokenParam) {
      setMessage('Invalid reset link. Please request a new password reset.');
      return;
    }
    setToken(tokenParam);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setMessage('Invalid reset token.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setMessage(data.message);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
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

  if (!token && !message) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-gray-300 mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
        <p className="text-gray-300">Enter your new password</p>
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

      {!isSuccess && token ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your new password"
              minLength={6}
            />
            <p className="text-xs text-gray-400 mt-1">Must be at least 6 characters long</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Confirm your new password"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
      ) : isSuccess ? (
        <div className="text-center">
          <div className="mb-6">
            <svg className="w-16 h-16 text-green-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-300 text-sm mb-4">
              Your password has been successfully updated! You will be redirected to the login page in a few seconds.
            </p>
            <Link 
              href="/login"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Sign In Now
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-6 text-center space-y-3">
        <p className="text-gray-400">
          Remember your password?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
            Back to Sign In
          </Link>
        </p>
        
        <p className="text-gray-400">
          Need a new reset link?{' '}
          <Link href="/forgot-password" className="text-blue-400 hover:text-blue-300 font-medium">
            Request New Link
          </Link>
        </p>
      </div>

      <div className="mt-4 text-center">
        <Link href="/" className="text-gray-400 hover:text-gray-300 text-sm">
          ← Back to store
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)' }}>
      <Suspense fallback={
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-300 mt-2">Loading...</p>
          </div>
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
} 