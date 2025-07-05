import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, street1, street2, city, state, zip, country } = body;

    // Validate required fields
    if (!name || !street1 || !city || !state || !zip || !country) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if this is the user's first address (will be default)
    const { data: existingAddresses } = await supabase
      .from('shipping_addresses')
      .select('id')
      .eq('user_email', session.user.email);

    const isFirstAddress = !existingAddresses || existingAddresses.length === 0;

    // Insert the new address
    const { data, error } = await supabase
      .from('shipping_addresses')
      .insert([{
        user_email: session.user.email,
        name,
        street1,
        street2: street2 || null,
        city,
        state,
        zip,
        country,
        is_default: isFirstAddress
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to save address' }, { status: 500 });
    }

    return NextResponse.json({ success: true, address: data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('shipping_addresses')
      .select('*')
      .eq('user_email', session.user.email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 });
    }

    return NextResponse.json({ addresses: data || [] });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const addressId = searchParams.get('id');

    if (!addressId) {
      return NextResponse.json({ error: 'Address ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('shipping_addresses')
      .delete()
      .eq('id', addressId)
      .eq('user_email', session.user.email); // Ensure user can only delete their own addresses

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 