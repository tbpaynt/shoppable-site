import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ message: 'Token and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    // Find the reset token
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null) // Only unused tokens
      .single();

    if (tokenError || !resetToken) {
      return NextResponse.json({ message: 'Invalid or expired reset token' }, { status: 400 });
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);
    if (now > expiresAt) {
      return NextResponse.json({ message: 'Reset token has expired' }, { status: 400 });
    }

    // Check if user still exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', resetToken.email)
      .single();

    if (userError || !user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update the user's password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('email', resetToken.email);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json({ message: 'Error updating password' }, { status: 500 });
    }

    // Mark the token as used
    const { error: markUsedError } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    if (markUsedError) {
      console.error('Error marking token as used:', markUsedError);
      // Don't fail the request as password was already updated
    }

    console.log(`✅ Password successfully reset for: ${resetToken.email}`);

    return NextResponse.json({ 
      message: 'Password has been reset successfully. You can now sign in with your new password.' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 