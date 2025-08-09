-- Enable Row Level Security for order_items table
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view order items from their own orders
CREATE POLICY "Users can view their own order items" ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_items.order_id 
            AND orders.user_email = auth.jwt() ->> 'email'
        )
    );

-- Policy: Users can create order items for their own orders
CREATE POLICY "Users can create order items for their orders" ON public.order_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_items.order_id 
            AND orders.user_email = auth.jwt() ->> 'email'
        )
    );

-- Policy: Users can update order items from their own orders
CREATE POLICY "Users can update their own order items" ON public.order_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_items.order_id 
            AND orders.user_email = auth.jwt() ->> 'email'
        )
    );

-- Policy: Service role can manage all order items (for admin operations)
CREATE POLICY "Service role can manage all order items" ON public.order_items
    FOR ALL USING (auth.role() = 'service_role');

-- Add comment to document the security model
COMMENT ON TABLE public.order_items IS 'Order line items table with RLS enabled. Users can only access items from their own orders, service role has full access for admin operations.';