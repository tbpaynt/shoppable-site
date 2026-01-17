-- Create initial product categories
-- This migration adds some common product categories to get started

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
