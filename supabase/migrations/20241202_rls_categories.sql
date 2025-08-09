-- Enable Row Level Security for categories table
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read categories (needed for product browsing and navigation)
CREATE POLICY "Anyone can read categories" ON public.categories
    FOR SELECT USING (true);

-- Policy: Service role can manage all categories (for admin operations)
CREATE POLICY "Service role can manage all categories" ON public.categories
    FOR ALL USING (auth.role() = 'service_role');

-- Add comment to document the security model
COMMENT ON TABLE public.categories IS 'Product categories table with RLS enabled. Categories are publicly readable for navigation, only service role can modify.';