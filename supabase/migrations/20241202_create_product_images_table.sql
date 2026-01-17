-- Create product_images table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);

-- Enable Row Level Security
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read product images (needed for displaying products)
CREATE POLICY "Anyone can read product images" ON public.product_images
    FOR SELECT USING (true);

-- Policy: Service role can manage all product images (for admin operations)
CREATE POLICY "Service role can manage all product images" ON public.product_images
    FOR ALL USING (auth.role() = 'service_role');

-- Add comment to document the security model
COMMENT ON TABLE public.product_images IS 'Product images table with RLS enabled. Images are publicly readable for product display, only service role can modify.';
