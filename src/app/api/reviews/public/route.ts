import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GUEST_USER_ID = '00000000-0000-0000-0000-000000000001';

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
        reviewer_name,
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

/** Guest review submission (no login required). Uses service role so RLS does not block. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawProductId = body.product_id != null ? Number(body.product_id) : NaN;
    const product_id =
      Number.isInteger(rawProductId) && rawProductId >= 1 ? rawProductId : null;
    const rating = body.rating != null ? Number(body.rating) : NaN;
    const product_name = typeof body.product_name === 'string' ? body.product_name.trim() : null;
    const comment = typeof body.comment === 'string' ? body.comment.trim() : null;
    const customer_name = typeof body.customer_name === 'string' ? body.customer_name.trim() || null : null;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    const { error } = await supabase
      .from('product_reviews')
      .insert({
        product_id: product_id as number | null,
        user_id: GUEST_USER_ID,
        rating,
        title: product_name || null,
        comment: comment || null,
        reviewer_name: customer_name || null,
        is_approved: false,
        is_verified_purchase: false,
      });

    if (error) {
      if (error.code === '23503') {
        return NextResponse.json({ error: 'Product not found' }, { status: 400 });
      }
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A review for this product from this guest already exists' }, { status: 400 });
      }
      console.error('Supabase error creating guest review:', error);
      return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Thank you for your review! It will be posted after approval.' });
  } catch (error) {
    console.error('Error in public reviews API POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 