import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('product_reviews')
      .select(`
        id,
        product_id,
        rating,
        title,
        comment,
        created_at,
        is_approved,
        is_verified_purchase,
        products:product_id (name),
        users:user_id (email)
      `)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }

    // Transform the data to match our interface
    const transformedData = (data || []).map((review: any) => ({
      ...review,
      products: Array.isArray(review.products) ? review.products[0] : review.products,
      users: Array.isArray(review.users) ? review.users[0] : review.users
    }));

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error in public reviews API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 