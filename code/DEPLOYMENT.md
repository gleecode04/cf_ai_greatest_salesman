# Cloudflare Deployment Guide

This guide walks you through deploying the Sales Pitch Practice Platform to Cloudflare.

## Prerequisites

1. **Cloudflare Account**: Sign up at https://dash.cloudflare.com
2. **Wrangler CLI**: Already installed (included in package.json)
3. **Cloudflare Authentication**: Run `npx wrangler login` if not already authenticated

## Step 1: Authenticate with Cloudflare

```bash
cd code
npx wrangler login
```

This will open your browser to authenticate with Cloudflare.

## Step 2: Build the Frontend

The React frontend needs to be built before deployment:

```bash
npm run build:frontend
```

This will create a `dist` folder with the compiled React app.

## Step 3: Update Wrangler Config for Production

The `wrangler.jsonc` already has production database IDs configured. Verify they're correct:

- **D1 Database**: `ming-db` (ID: `99316710-36e0-4fb8-91e6-b5537941ec17`)
- **KV Namespace**: `SESSIONS` (ID: `7bf1fe126373448f94ca575b2f105fc8`)

If you need to create new resources:

```bash
# Create D1 database (if needed)
npx wrangler d1 create ming-db

# Create KV namespace (if needed)
npx wrangler kv namespace create SESSIONS
```

Then update the IDs in `wrangler.jsonc`.

## Step 4: Run Database Migrations (Production)

Apply migrations to your production D1 database:

```bash
npx wrangler d1 migrations apply ming-db --remote
```

This creates all necessary tables:
- `conversations`
- `messages`
- `feedback_reports`
- `user_scores`
- `scenarios`

## Step 5: Update Assets Directory

The Worker serves static assets from the `public` directory, but we need to include the built React app. 

**Option A: Serve React build from Worker (Recommended)**

Update `wrangler.jsonc` to point to the dist folder:

```jsonc
"assets": {
  "binding": "ASSETS",
  "directory": "./dist"  // Changed from "./public"
}
```

Then copy any static assets from `public` to `dist` if needed, or update the build process.

**Option B: Deploy Frontend to Cloudflare Pages (Alternative)**

Deploy the React app separately to Cloudflare Pages and configure it to proxy API requests to your Worker.

## Step 6: Deploy the Worker

Deploy your Worker to Cloudflare:

```bash
npm run deploy
```

Or explicitly:

```bash
npx wrangler deploy
```

This will:
- Build your Worker code
- Upload it to Cloudflare
- Make it available at `https://code.YOUR_SUBDOMAIN.workers.dev`

## Step 7: Verify Deployment

1. **Check Worker Status**:
   ```bash
   npx wrangler deployments list
   ```

2. **Test the API**:
   ```bash
   curl https://code.YOUR_SUBDOMAIN.workers.dev/api/health
   ```

3. **Visit the App**:
   Open `https://code.YOUR_SUBDOMAIN.workers.dev` in your browser

## Step 8: Configure Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Workers & Pages → Your Worker
2. Click "Triggers" → "Custom Domains"
3. Add your custom domain
4. Update DNS records as instructed

## Troubleshooting

### Database Errors
If you see "no such table" errors:
```bash
# Verify migrations were applied
npx wrangler d1 migrations list ming-db --remote

# Re-run migrations if needed
npx wrangler d1 migrations apply ming-db --remote
```

### AI Binding Errors
Workers AI requires a paid Cloudflare plan. Ensure:
- You have Workers AI enabled in your account
- The AI binding is correctly configured in `wrangler.jsonc`

### Frontend Not Loading
- Verify `dist` folder exists and contains built files
- Check that `assets.directory` in `wrangler.jsonc` points to the correct folder
- Ensure React router is configured for client-side routing

### CORS Issues
If you deploy frontend separately, ensure CORS headers are set in your Worker's API responses.

## Environment Variables & Secrets

If you need to set environment variables or secrets:

```bash
# Set a secret (for sensitive data)
npx wrangler secret put MY_SECRET_KEY

# Set environment variables (for non-sensitive config)
# Add to wrangler.jsonc:
"vars": {
  "MY_VAR": "value"
}
```

## Continuous Deployment

### Option 1: GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build:frontend
      - run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Option 2: Cloudflare Pages Integration

1. Connect your GitHub repository to Cloudflare Pages
2. Configure build settings:
   - Build command: `cd code && npm ci && npm run build:frontend`
   - Output directory: `code/dist`
   - Root directory: `code`

## Post-Deployment Checklist

- [ ] Database migrations applied successfully
- [ ] Worker deployed and accessible
- [ ] Frontend loads correctly
- [ ] API endpoints respond correctly
- [ ] AI features work (requires Workers AI access)
- [ ] Database operations work (create conversations, save messages)
- [ ] Feedback generation works end-to-end

## Monitoring

Monitor your deployment:

```bash
# View logs
npx wrangler tail

# View metrics in dashboard
# Go to Cloudflare Dashboard → Workers & Pages → Your Worker → Metrics
```

## Rollback

If something goes wrong:

```bash
# List deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback
```

