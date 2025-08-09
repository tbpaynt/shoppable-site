-- Enable Row Level Security for settings table
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access settings (admin-only configuration)
CREATE POLICY "Service role can manage all settings" ON public.settings
    FOR ALL USING (auth.role() = 'service_role');

-- Policy: Allow authenticated users to read public settings if needed
-- (Uncomment this if you have settings that should be readable by authenticated users)
-- CREATE POLICY "Authenticated users can read public settings" ON public.settings
--     FOR SELECT USING (auth.role() = 'authenticated' AND is_public = true);

-- Add comment to document the security model
COMMENT ON TABLE public.settings IS 'Application settings table with RLS enabled. Only service role has access for admin configuration management.';