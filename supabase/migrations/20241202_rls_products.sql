-- Enable Row Level Security for products table
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read published products
CREATE POLICY "Anyone can read published products" ON public.products
    FOR SELECT USING (published = true);

-- Policy: Service role can manage all products (for admin operations)
CREATE POLICY "Service role can manage all products" ON public.products
    FOR ALL USING (auth.role() = 'service_role');

-- Policy: Allow authenticated users to read all products (for admin interface)
CREATE POLICY "Authenticated users can read all products" ON public.products
    FOR SELECT USING (auth.role() = 'authenticated');

-- Add comment to document the security model
COMMENT ON TABLE public.products IS 'E-commerce products table with RLS enabled. Published products are publicly readable, all products readable by authenticated users, and only service role can modify.';