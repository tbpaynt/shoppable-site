import Stripe from 'stripe';

// Add this line for debugging Vercel deployment
console.log('Build-time STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Exists' : 'Does NOT exist');

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

// Client-side Stripe instance
export const getStripe = async () => {
  if (typeof window !== 'undefined') {
    const { loadStripe } = await import('@stripe/stripe-js');
    return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return null;
}; 