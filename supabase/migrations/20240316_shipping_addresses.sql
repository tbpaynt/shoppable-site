-- Create shipping_addresses table for user profiles
CREATE TABLE shipping_addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    street1 VARCHAR(255) NOT NULL,
    street2 VARCHAR(255),
    city VARCHAR(255) NOT NULL,
    state VARCHAR(10) NOT NULL,
    zip VARCHAR(20) NOT NULL,
    country VARCHAR(2) NOT NULL DEFAULT 'US',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on user_email for faster lookups
CREATE INDEX idx_shipping_addresses_user_email ON shipping_addresses(user_email);

-- Create index on is_default for faster default address lookups
CREATE INDEX idx_shipping_addresses_default ON shipping_addresses(user_email, is_default);

-- Enable RLS (Row Level Security)
ALTER TABLE shipping_addresses ENABLE ROW LEVEL SECURITY;

-- Create policies for users to only access their own addresses
CREATE POLICY "Users can view their own shipping addresses" ON shipping_addresses
    FOR SELECT USING (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert their own shipping addresses" ON shipping_addresses
    FOR INSERT WITH CHECK (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update their own shipping addresses" ON shipping_addresses
    FOR UPDATE USING (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete their own shipping addresses" ON shipping_addresses
    FOR DELETE USING (user_email = auth.jwt() ->> 'email');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_shipping_addresses_updated_at
    BEFORE UPDATE ON shipping_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to the table
COMMENT ON TABLE shipping_addresses IS 'Stores shipping addresses for users'; 