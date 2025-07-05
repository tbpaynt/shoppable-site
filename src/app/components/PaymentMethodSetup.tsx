"use client";
import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

interface PaymentMethodSetupProps {
  onSuccess: (paymentMethod: any) => void;
  onCancel: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function PaymentMethodSetup({ 
  onSuccess, 
  onCancel, 
  isLoading, 
  setIsLoading 
}: PaymentMethodSetupProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    try {
      // Get setup intent client secret
      if (!clientSecret) {
        const response = await fetch('/api/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to create setup intent');
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);

        // Confirm setup intent
        const result = await stripe.confirmCardSetup(data.clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement)!,
          },
        });

        if (result.error) {
          setError(result.error.message || 'Failed to save payment method');
        } else {
          // Save payment method to database
          const saveResponse = await fetch('/api/payment-methods', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ setupIntentId: result.setupIntent.id }),
          });

          if (!saveResponse.ok) {
            throw new Error('Failed to save payment method');
          }

          const saveData = await saveResponse.json();
          onSuccess(saveData.paymentMethod);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 p-6 rounded-lg">
      <h3 className="text-lg font-medium mb-4">Add New Payment Method</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-4 border border-gray-300 rounded-lg bg-white">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!stripe || isLoading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Payment Method'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
} 