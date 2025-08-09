-- Enable Row Level Security for orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own orders
CREATE POLICY "Users can view their own orders" ON public.orders
    FOR SELECT USING (user_email = auth.jwt() ->> 'email');

-- Policy: Users can create orders for themselves
CREATE POLICY "Users can create their own orders" ON public.orders
    FOR INSERT WITH CHECK (user_email = auth.jwt() ->> 'email');

-- Policy: Users can update their own orders (for status changes like cancellation)
CREATE POLICY "Users can update their own orders" ON public.orders
    FOR UPDATE USING (user_email = auth.jwt() ->> 'email');

-- Policy: Service role can manage all orders (for admin operations)
CREATE POLICY "Service role can manage all orders" ON public.orders
    FOR ALL USING (auth.role() = 'service_role');

-- Add comment to document the security model
COMMENT ON TABLE public.orders IS 'Customer orders table with RLS enabled. Users can only access their own orders, service role has full access for admin operations.';