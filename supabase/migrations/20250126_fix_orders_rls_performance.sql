-- Fix RLS performance issues: Wrap auth functions in subqueries to prevent per-row re-evaluation
-- This improves query performance by evaluating auth functions once per query instead of once per row

-- Drop and recreate the SELECT policy
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders
    FOR SELECT USING (user_email = (SELECT auth.jwt() ->> 'email'));

-- Drop and recreate the INSERT policy
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
CREATE POLICY "Users can create their own orders" ON public.orders
    FOR INSERT WITH CHECK (user_email = (SELECT auth.jwt() ->> 'email'));

-- Drop and recreate the UPDATE policy
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
CREATE POLICY "Users can update their own orders" ON public.orders
    FOR UPDATE USING (user_email = (SELECT auth.jwt() ->> 'email'));

-- Drop and recreate the Service role policy
DROP POLICY IF EXISTS "Service role can manage all orders" ON public.orders;
CREATE POLICY "Service role can manage all orders" ON public.orders
    FOR ALL USING ((SELECT auth.role()) = 'service_role');
