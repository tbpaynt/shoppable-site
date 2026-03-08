-- Allow reviews without a specific product (general / store experience reviews)
ALTER TABLE public.product_reviews
ALTER COLUMN product_id DROP NOT NULL;

-- Drop the FK so we can have null product_id (re-add as optional FK would require a separate step;
-- in Postgres, REFERENCES allows NULL by default once column is nullable, so FK is still valid for non-null values)
-- Actually we don't need to drop the FK - nullable product_id with FK just means when it's set it must reference products(id). So only the DROP NOT NULL is needed.
COMMENT ON COLUMN public.product_reviews.product_id IS 'Optional: specific product reviewed; null for general store experience reviews.';
