-- Enable Row Level Security for products table and create optimized policies
-- This fixes the critical security issue where RLS was not enabled

-- Enable RLS on products table
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate with performance fixes)
DROP POLICY IF EXISTS "Anyone can read published products" ON public.products;
DROP POLICY IF EXISTS "Service role can manage all products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can read all products" ON public.products;

-- Policy: Anyone can read published products
CREATE POLICY "Anyone can read published products" ON public.products
    FOR SELECT USING (published = true);

-- Policy: Service role can manage all products (for admin operations)
-- Using subquery for better performance
CREATE POLICY "Service role can manage all products" ON public.products
    FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- Policy: Allow authenticated users to read all products (for admin interface)
-- Using subquery for better performance
CREATE POLICY "Authenticated users can read all products" ON public.products
    FOR SELECT USING ((SELECT auth.role()) = 'authenticated');

-- Add comment to document the security model
COMMENT ON TABLE public.products IS 'E-commerce products table with RLS enabled. Published products are publicly readable, all products readable by authenticated users, and only service role can modify.';
