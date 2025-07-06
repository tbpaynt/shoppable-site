"use client";
import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

console.log('Stripe publishable key:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CheckoutFormProps {
  clientSecret: string;
  customerSessionClientSecret?: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

function CheckoutFormContent({ onSuccess, onError }: Omit<CheckoutFormProps, 'clientSecret' | 'customerSessionClientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  
  console.log('Stripe instance:', stripe);
  console.log('Elements instance:', elements);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/success`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setMessage(error.message || 'An error occurred');
      onError(error.message || 'Payment failed');
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      setMessage('Payment successful!');
      onSuccess();
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement 
        options={{
          defaultValues: {
            billingDetails: {
              name: '',
              email: ''
            }
          }
        }}
      />
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
      >
        {isProcessing ? 'Processing...' : 'Pay Now'}
      </button>
      {message && (
        <div className="text-center text-sm">
          {message}
        </div>
      )}
    </form>
  );
}

export default function CheckoutForm({ clientSecret, customerSessionClientSecret, onSuccess, onError }: CheckoutFormProps) {
  const options: any = { 
    clientSecret,
    appearance: {
      theme: 'stripe',
    },
    locale: 'en'
  };

  // Add customer session client secret if provided
  if (customerSessionClientSecret) {
    options.customerSessionClientSecret = customerSessionClientSecret;
  }

  return (
    <Elements 
      stripe={stripePromise} 
      options={options}
    >
      <CheckoutFormContent onSuccess={onSuccess} onError={onError} />
    </Elements>
  );
} 