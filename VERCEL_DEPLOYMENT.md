# Vercel Deployment Guide

## Step 1: Install Vercel CLI

```bash
npm i -g vercel
```

## Step 2: Login to Vercel

```bash
vercel login
```

This will open your browser to authenticate.

## Step 3: Test Build Locally (Optional but Recommended)

```bash
cd "c:\Users\Thomas Paynter\shoppable-site"
npm run build
```

If the build succeeds, you're ready to deploy!

## Step 4: Deploy to Vercel

### First Time Deployment:

```bash
cd "c:\Users\Thomas Paynter\shoppable-site"
vercel
```

Follow the prompts:
- Set up and deploy? **Yes**
- Which scope? (Select your account)
- Link to existing project? **No** (for first time)
- Project name? (Press Enter for default or enter custom name)
- Directory? (Press Enter for `./`)
- Override settings? **No**

### Production Deployment:

After the first deployment, use:

```bash
vercel --prod
```

## Step 5: Set Environment Variables in Vercel Dashboard

**CRITICAL:** You MUST set these environment variables in Vercel dashboard:

1. Go to your project on [vercel.com](https://vercel.com)
2. Click on your project
3. Go to **Settings** → **Environment Variables**
4. Add each of these:

### Required Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
NEXTAUTH_URL=https://your-domain.vercel.app
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

### Optional Environment Variables:

```
GOOGLE_CLIENT_ID=your_google_client_id (if using Google OAuth)
GOOGLE_CLIENT_SECRET=your_google_client_secret (if using Google OAuth)
ADMIN_EMAIL=your_admin_email
SHIPPO_API_KEY=your_shippo_api_key (if using Shippo)
```

### Generate NEXTAUTH_SECRET:

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Or use an online generator: https://generate-secret.vercel.app/32

## Step 6: Redeploy After Setting Environment Variables

After adding environment variables, redeploy:

```bash
vercel --prod
```

Or trigger a redeploy from the Vercel dashboard (click "Redeploy" button).

## Step 7: Update NEXTAUTH_URL

After your first deployment, Vercel will give you a URL like:
`https://your-project.vercel.app`

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Update `NEXTAUTH_URL` to your actual Vercel URL
3. Redeploy

## Step 8: Custom Domain (Optional)

1. Go to Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` to your custom domain
5. Redeploy

## Troubleshooting

### Build Fails:
- Check that all environment variables are set
- Check build logs in Vercel dashboard
- Try building locally first: `npm run build`

### Site Works but Images Don't Load:
- Check `next.config.ts` has all image domains in `remotePatterns`
- Verify Supabase storage bucket is public
- Check image URLs in database

### Authentication Not Working:
- Verify `NEXTAUTH_URL` matches your deployment URL
- Check `NEXTAUTH_SECRET` is set
- Verify Supabase credentials are correct

### API Routes Not Working:
- Check server-side environment variables are set (without `NEXT_PUBLIC_` prefix)
- Verify Supabase service role key is set
- Check Vercel function logs

## Quick Deploy Commands

```bash
# Navigate to project
cd "c:\Users\Thomas Paynter\shoppable-site"

# Deploy to production
vercel --prod

# Deploy to preview
vercel

# View deployment logs
vercel logs
```

## Important Notes

- **Never commit `.env.local`** - it's already in `.gitignore`
- Environment variables set in Vercel dashboard override local `.env.local`
- After changing environment variables, you must redeploy
- Vercel automatically builds on git push (if connected to GitHub/GitLab)

## Next Steps After Deployment

1. Test all pages load correctly
2. Test authentication (login/signup)
3. Test product browsing
4. Test cart and checkout
5. Test admin panel
6. Monitor error logs in Vercel dashboard
7. Set up custom domain (if desired)
