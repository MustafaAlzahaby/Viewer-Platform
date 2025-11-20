# 🔐 Supabase Environment Variables Setup for Vercel

## Quick Setup (5 minutes)

### Step 1: Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy these two values:
   - **Project URL** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### Step 2: Add to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **Viewer-Platform** project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**

#### Add First Variable:
- **Key:** `VITE_SUPABASE_URL`
- **Value:** Paste your Project URL
- **Environments:** ✅ Production ✅ Preview ✅ Development
- Click **Save**

#### Add Second Variable:
- **Key:** `VITE_SUPABASE_ANON_KEY`
- **Value:** Paste your anon public key
- **Environments:** ✅ Production ✅ Preview ✅ Development
- Click **Save**

### Step 3: Redeploy

1. Go to **Deployments** tab
2. Find the latest deployment
3. Click the **"..."** menu (three dots)
4. Click **Redeploy**
5. Wait for deployment to complete (~2 minutes)

### Step 4: Verify

1. Open your deployed site
2. Open browser console (F12)
3. You should **NOT** see: `⚠️ Missing Supabase environment variables`
4. You should be able to log in with your database users

## 🔒 Security Notes

✅ **Safe to Expose:**
- `VITE_SUPABASE_URL` - Public, safe to expose
- `VITE_SUPABASE_ANON_KEY` - Designed for client-side use, protected by RLS policies

❌ **Never Expose:**
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side only, never use in frontend
- Database passwords
- Any keys without `VITE_` prefix in client code

## 🐛 Troubleshooting

### Still seeing the warning?
1. ✅ Check variable names are **exactly**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. ✅ Make sure all environments are selected (Production, Preview, Development)
3. ✅ Redeploy after adding variables
4. ✅ Clear browser cache and hard refresh (Ctrl+Shift+R)

### Can't log in?
1. Check Supabase Authentication is enabled
2. Verify users exist in Supabase Auth → Users
3. Check browser console for specific error messages
4. Verify RLS policies are set up correctly

### Variables not working in Preview/Development?
- Make sure you selected all environments when adding variables
- Each environment (Production/Preview/Development) needs the variables separately

## 📝 Local Development

For local development, create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important:** The `.env` file is already in `.gitignore` and will NOT be committed to Git.

## ✅ Success Checklist

- [ ] Added `VITE_SUPABASE_URL` to Vercel
- [ ] Added `VITE_SUPABASE_ANON_KEY` to Vercel
- [ ] Selected all environments (Production, Preview, Development)
- [ ] Redeployed the application
- [ ] No warning in browser console
- [ ] Can log in with database users

