# Vercel Environment Variables Setup

## Issue
Your app is showing "Missing Supabase environment variables — running in demo mode" because Vercel doesn't use local `.env` files. You need to set environment variables in the Vercel dashboard.

## Solution: Add Environment Variables in Vercel

### Step 1: Go to Vercel Dashboard
1. Go to [vercel.com](https://vercel.com) and sign in
2. Select your project: **Viewer-Platform**
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Required Variables
Add these two environment variables:

#### Variable 1:
- **Name:** `VITE_SUPABASE_URL`
- **Value:** Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- **Environment:** Select all (Production, Preview, Development)

#### Variable 2:
- **Name:** `VITE_SUPABASE_ANON_KEY`
- **Value:** Your Supabase anonymous/public key
- **Environment:** Select all (Production, Preview, Development)

### Step 3: Redeploy
After adding the variables:
1. Go to **Deployments** tab
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"**
4. Or make a small commit to trigger a new deployment

### How to Find Your Supabase Keys

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. You'll find:
   - **Project URL** → Use for `VITE_SUPABASE_URL`
   - **anon/public key** → Use for `VITE_SUPABASE_ANON_KEY`

### Important Notes

- ✅ Environment variables starting with `VITE_` are exposed to the browser (this is expected for Supabase)
- ✅ The `anon` key is safe to expose - it's designed for client-side use
- ✅ Never commit your `.env` file to Git (it should be in `.gitignore`)
- ✅ After adding variables, you must redeploy for them to take effect

### Verify It's Working

After redeploying, check the browser console. You should see:
- ✅ No "Missing Supabase environment variables" warning
- ✅ `[Auth] Checking for existing session...` instead of `[Auth] Demo mode`

