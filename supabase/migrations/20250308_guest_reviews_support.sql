-- Guest user for anonymous/guest product reviews (used when customer is not logged in)
-- Insert once; safe to run multiple times (ON CONFLICT DO NOTHING)

INSERT INTO public.users (id, email, name, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'guest@reviews.local',
  'Guest',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Allow optional reviewer display name for guest reviews
ALTER TABLE public.product_reviews
ADD COLUMN IF NOT EXISTS reviewer_name TEXT;

COMMENT ON COLUMN public.product_reviews.reviewer_name IS 'Optional display name for guest reviewers; null for logged-in users.';
