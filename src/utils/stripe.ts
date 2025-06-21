import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

/**
 * Initializes and returns a server-side Stripe instance.
 * This is lazy-loaded to prevent instantiation during the build process
 * on platforms like Vercel where server-side env vars are not available at build time.
 */
export const getStripeServer = (): Stripe => {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-05-28.basil',
    });
  }
  return stripeInstance;
};

// Client-side Stripe instance
export const getStripe = async () => {
  if (typeof window !== 'undefined') {
    const { loadStripe } = await import('@stripe/stripe-js');
    return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return null;
}; 