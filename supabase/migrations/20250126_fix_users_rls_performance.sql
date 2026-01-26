-- Fix RLS performance issue: Wrap auth.uid() in subquery to prevent per-row re-evaluation
-- This improves query performance by evaluating auth.uid() once per query instead of once per row

-- Drop and recreate the SELECT policy
DROP POLICY IF EXISTS "Users can read their own data" ON public.users;
CREATE POLICY "Users can read their own data" ON public.users
    FOR SELECT USING ((SELECT auth.uid()) = id);

-- Drop and recreate the UPDATE policy
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
CREATE POLICY "Users can update their own data" ON public.users
    FOR UPDATE USING ((SELECT auth.uid()) = id);
