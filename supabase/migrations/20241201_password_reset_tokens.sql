-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role to manage all tokens (for API)
CREATE POLICY "Service role can manage all reset tokens" ON password_reset_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- Create a function to automatically clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to clean up expired tokens periodically
CREATE OR REPLACE FUNCTION auto_cleanup_reset_tokens()
RETURNS trigger AS $$
BEGIN
  -- Clean up expired tokens when new ones are created
  PERFORM cleanup_expired_reset_tokens();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_reset_tokens
  AFTER INSERT ON password_reset_tokens
  FOR EACH ROW
  EXECUTE FUNCTION auto_cleanup_reset_tokens(); 