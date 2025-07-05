-- Add phone column to users table
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Add comment to the column
COMMENT ON COLUMN users.phone IS 'User phone number for profile and shipping'; 