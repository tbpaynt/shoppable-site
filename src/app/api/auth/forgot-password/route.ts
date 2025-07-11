import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Create email transporter
function createEmailTransporter() {
  // Check if we have Gmail configuration
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  
  // Check if we have generic SMTP configuration
  if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }
  
  return null;
}

// Email sending function
async function sendResetEmail(email: string, resetToken: string) {
  const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  
  const transporter = createEmailTransporter();
  
  if (!transporter) {
    console.log(`🔐 Password reset requested for: ${email}`);
    console.log(`🔗 Reset link: ${resetUrl}`);
    console.log(`⚠️  No email configuration found. Add email environment variables to send actual emails.`);
    return true; // Don't fail the request
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER,
    to: email,
    subject: 'Reset Your Password - KT Wholesale Finds',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>You requested a password reset for your KT Wholesale Finds account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p style="color: #888; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request this reset, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #888; font-size: 12px;">
          KT Wholesale Finds<br>
          This is an automated message, please do not reply.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending reset email:', error);
    // Fall back to console logging if email fails
    console.log(`🔐 Password reset requested for: ${email}`);
    console.log(`🔗 Reset link: ${resetUrl}`);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single();

    // Always return success message to prevent email enumeration attacks
    const successMessage = 'If an account exists with that email, you will receive a password reset link.';

    if (userError || !user) {
      // Don't reveal that the user doesn't exist
      console.log(`Password reset requested for non-existent email: ${email}`);
      return NextResponse.json({ message: successMessage });
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Clean up any existing unused tokens for this email
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('email', email.toLowerCase())
      .is('used_at', null);

    // Store the reset token
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert([{
        email: email.toLowerCase(),
        token: resetToken,
        expires_at: expiresAt.toISOString()
      }]);

    if (tokenError) {
      console.error('Error creating reset token:', tokenError);
      return NextResponse.json({ message: 'Error processing request' }, { status: 500 });
    }

    // Send reset email
    try {
      await sendResetEmail(email, resetToken);
    } catch (emailError) {
      console.error('Error sending reset email:', emailError);
      // Don't fail the request if email sending fails
      // In production, you might want to queue the email for retry
    }

    return NextResponse.json({ message: successMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 