import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role client for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { product_id, image_url } = await request.json();

    if (!product_id || !image_url) {
      return NextResponse.json({ error: 'Product ID and image URL are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('product_images')
      .insert({ product_id, image_url })
      .select()
      .single();

    if (error) {
      console.error('Error inserting product image:', error);
      return NextResponse.json({ error: 'Failed to save image' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
