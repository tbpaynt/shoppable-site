# Row Level Security (RLS) Migration Guide

This directory contains migration files to enable Row Level Security for tables that were previously showing as "Unrestricted" in the Supabase dashboard.

## Migration Files Created

1. **20241202_rls_products.sql** - Secures the products table
2. **20241202_rls_categories.sql** - Secures the categories table
3. **20241202_rls_orders.sql** - Secures the orders table
4. **20241202_rls_order_items.sql** - Secures the order_items table
5. **20241202_rls_settings.sql** - Secures the settings table
6. **20241202_rls_product_images.sql** - Secures the product_images table

## Security Policies Applied

### Products Table
- ✅ Published products readable by anyone
- ✅ All products readable by authenticated users
- ✅ Only service role can modify products

### Categories Table
- ✅ Categories readable by anyone (for navigation)
- ✅ Only service role can modify categories

### Orders Table
- ✅ Users can only see their own orders
- ✅ Users can create/update their own orders
- ✅ Service role can manage all orders

### Order Items Table
- ✅ Users can only see items from their own orders
- ✅ Users can create/update items for their own orders
- ✅ Service role can manage all order items

### Settings Table
- ✅ Only service role can access settings
- ✅ Commented option for public settings if needed

### Product Images Table
- ✅ Images readable by anyone (for display)
- ✅ Only service role can modify images

## How to Apply These Migrations

### Option 1: Supabase CLI (Recommended)
```bash
# Navigate to your project root
cd /path/to/your/project

# Apply all migrations
supabase db push

# Or apply individual migrations
supabase db push --include-all
```

### Option 2: Manual Application
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste each migration file content
3. Execute them in order

### Option 3: Database Connection
If you have direct database access, you can run these SQL files directly against your PostgreSQL database.

## Verification

After applying the migrations, check your Supabase dashboard:
1. Go to Table Editor
2. The tables should no longer show "Unrestricted"
3. Each table should show the security policies in the table details

## Important Notes

- These migrations assume your application uses email-based authentication with `auth.jwt() ->> 'email'`
- The service role is used for admin operations and API access
- If your authentication setup differs, you may need to adjust the policies
- Test thoroughly in a development environment before applying to production

## Troubleshooting

If you encounter issues:
1. Ensure your Supabase project has auth enabled
2. Check that your application uses the correct authentication flow
3. Verify service role key is properly configured in your environment variables
4. Test with a few sample operations after applying migrations