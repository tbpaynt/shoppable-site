-- Fix RLS policy for product_images table to allow authenticated users to insert
-- Copy and paste this into your Supabase SQL Editor

-- First, let's check the current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'product_images';

-- Update the existing policy to allow authenticated users to insert
DROP POLICY IF EXISTS "Service role can manage all product images" ON public.product_images;

-- Create a new policy that allows both service role and authenticated users
CREATE POLICY "Admin and service role can manage product images" ON public.product_images
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        auth.role() = 'authenticated'
    );

-- Also create a specific policy for INSERT operations
CREATE POLICY "Allow authenticated users to insert product images" ON public.product_images
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        auth.role() = 'authenticated'
    );
