-- Create inventory reservations table to prevent overselling
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_group_id UUID NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  user_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '15 minutes')
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_product_id ON inventory_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_group_id ON inventory_reservations(reservation_group_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expires_at ON inventory_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_created_at ON inventory_reservations(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see only their own reservations
CREATE POLICY "Users can view their own reservations" ON inventory_reservations
  FOR SELECT USING (user_email = auth.jwt() ->> 'email');

-- Policy to allow service role to manage all reservations (for API)
CREATE POLICY "Service role can manage all reservations" ON inventory_reservations
  FOR ALL USING (auth.role() = 'service_role');

-- Create a function to automatically clean up expired reservations
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS void AS $$
BEGIN
  DELETE FROM inventory_reservations 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to clean up expired reservations periodically
-- Note: In production, you might want to use a cron job instead
CREATE OR REPLACE FUNCTION auto_cleanup_reservations()
RETURNS trigger AS $$
BEGIN
  -- Clean up expired reservations when new ones are created
  PERFORM cleanup_expired_reservations();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_reservations
  AFTER INSERT ON inventory_reservations
  FOR EACH ROW
  EXECUTE FUNCTION auto_cleanup_reservations(); 