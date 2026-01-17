-- Add initial product categories to your database
-- Copy and paste this entire script into your Supabase SQL Editor

-- First, let's make sure the categories table exists (in case it doesn't)
CREATE TABLE IF NOT EXISTS public.categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial categories
INSERT INTO public.categories (name, description) VALUES
('Electronics', 'Electronic devices, gadgets, and accessories'),
('Clothing', 'Apparel, shoes, and fashion accessories'),
('Home & Garden', 'Home improvement, furniture, and garden supplies'),
('Sports & Outdoors', 'Sports equipment, outdoor gear, and fitness items'),
('Books & Media', 'Books, movies, music, and educational materials'),
('Health & Beauty', 'Health products, cosmetics, and personal care items'),
('Toys & Games', 'Children''s toys, board games, and entertainment'),
('Automotive', 'Car parts, accessories, and automotive supplies'),
('Food & Beverages', 'Food items, drinks, and culinary products'),
('Office Supplies', 'Stationery, office equipment, and business supplies')
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security (if not already enabled)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create policies (if they don't exist)
DO $$
BEGIN
    -- Policy: Anyone can read categories
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'categories' 
        AND policyname = 'Anyone can read categories'
    ) THEN
        CREATE POLICY "Anyone can read categories" ON public.categories
            FOR SELECT USING (true);
    END IF;

    -- Policy: Service role can manage all categories
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'categories' 
        AND policyname = 'Service role can manage all categories'
    ) THEN
        CREATE POLICY "Service role can manage all categories" ON public.categories
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- Add comment to document the security model
COMMENT ON TABLE public.categories IS 'Product categories table with RLS enabled. Categories are publicly readable for navigation, only service role can modify.';
