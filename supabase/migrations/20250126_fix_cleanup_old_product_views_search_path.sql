-- Fix security issue: Set search_path for cleanup_old_product_views function
-- This prevents search_path manipulation attacks

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
