import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '../../../utils/stripe';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

export async function POST(request: NextRequest) {
  try {
    const { items, customerEmail }: { items: CartItem[]; customerEmail: string } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided' },
        { status: 400 }
      );
    }

    // Calculate total amount in cents
    const totalAmount = items.reduce((sum: number, item: CartItem) => {
      return sum + (item.price * item.quantity * 100); // Convert to cents
    }, 0);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      metadata: {
        customerEmail,
        items: JSON.stringify(items.map((item: CartItem) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })))
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
} 