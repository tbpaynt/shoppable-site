-- Create product_views table to track active viewers
CREATE TABLE IF NOT EXISTS product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, session_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_views_product_id ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_last_seen ON product_views(last_seen);
CREATE INDEX IF NOT EXISTS idx_product_views_session_id ON product_views(session_id);

-- Enable RLS for security
ALTER TABLE product_views ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read view counts (for displaying badges)
CREATE POLICY "Anyone can read product views" ON product_views
    FOR SELECT USING (true);

-- Policy: Service role can manage all views (for API operations)
CREATE POLICY "Service role can manage all product views" ON product_views
    FOR ALL USING (auth.role() = 'service_role');

-- Function to clean up old views (older than 10 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_product_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM product_views 
  WHERE last_seen < NOW() - INTERVAL '10 minutes';
END;
$$;

-- Add comment to document the table
COMMENT ON TABLE product_views IS 'Tracks active viewers per product for social proof. Sessions older than 10 minutes are automatically cleaned up.';