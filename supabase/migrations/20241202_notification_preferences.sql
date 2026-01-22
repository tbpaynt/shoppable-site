-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_email, order_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_email ON public.notification_preferences(user_email);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_order_id ON public.notification_preferences(order_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_email_notifications ON public.notification_preferences(email_notifications);

-- Enable Row Level Security
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can view their own notification preferences
CREATE POLICY "Users can view their own notification preferences" ON public.notification_preferences
    FOR SELECT USING (user_email = auth.jwt() ->> 'email');

-- Users can insert their own notification preferences
CREATE POLICY "Users can insert their own notification preferences" ON public.notification_preferences
    FOR INSERT WITH CHECK (user_email = auth.jwt() ->> 'email');

-- Users can update their own notification preferences
CREATE POLICY "Users can update their own notification preferences" ON public.notification_preferences
    FOR UPDATE USING (user_email = auth.jwt() ->> 'email');

-- Service role can manage all notification preferences (for API)
CREATE POLICY "Service role can manage all notification preferences" ON public.notification_preferences
    FOR ALL USING (auth.role() = 'service_role');

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW 
    EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Add comment
COMMENT ON TABLE public.notification_preferences IS 'Stores user preferences for email notifications on order status updates';
