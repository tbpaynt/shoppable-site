-- Create payment_methods table for storing Stripe payment method references
CREATE TABLE payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    stripe_payment_method_id VARCHAR(255) NOT NULL,
    stripe_customer_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'card',
    last4 VARCHAR(4),
    brand VARCHAR(50),
    exp_month INTEGER,
    exp_year INTEGER,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_payment_methods_user_email ON payment_methods(user_email);
CREATE INDEX idx_payment_methods_stripe_customer ON payment_methods(stripe_customer_id);
CREATE INDEX idx_payment_methods_default ON payment_methods(user_email, is_default);

-- Enable RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own payment methods" ON payment_methods
    FOR SELECT USING (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert their own payment methods" ON payment_methods
    FOR INSERT WITH CHECK (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update their own payment methods" ON payment_methods
    FOR UPDATE USING (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete their own payment methods" ON payment_methods
    FOR DELETE USING (user_email = auth.jwt() ->> 'email');

-- Create function to update updated_at timestamp
CREATE TRIGGER update_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to the table
COMMENT ON TABLE payment_methods IS 'Stores Stripe payment method references for users';

-- Create stripe_customers table for storing customer IDs
CREATE TABLE stripe_customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on user_email for faster lookups
CREATE INDEX idx_stripe_customers_user_email ON stripe_customers(user_email);

-- Enable RLS
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own stripe customer" ON stripe_customers
    FOR SELECT USING (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert their own stripe customer" ON stripe_customers
    FOR INSERT WITH CHECK (user_email = auth.jwt() ->> 'email');

-- Create trigger for updated_at
CREATE TRIGGER update_stripe_customers_updated_at
    BEFORE UPDATE ON stripe_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to the table
COMMENT ON TABLE stripe_customers IS 'Stores Stripe customer IDs for users'; 