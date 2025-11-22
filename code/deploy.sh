#!/bin/bash

# Cloudflare Deployment Script for Sales Pitch Practice Platform

set -e  # Exit on error

echo "🚀 Starting deployment to Cloudflare..."

# Step 1: Build frontend
echo "📦 Building frontend..."
npm run build:frontend

# Step 2: Copy public assets to dist (if needed)
if [ -d "public" ]; then
  echo "📋 Copying public assets to dist..."
  cp -r public/* dist/ 2>/dev/null || true
fi

# Step 3: Run database migrations
echo "🗄️  Applying database migrations..."
npx wrangler d1 migrations apply ming-db --remote

# Step 4: Deploy Worker
echo "☁️  Deploying Worker to Cloudflare..."
npm run deploy

echo "✅ Deployment complete!"
echo ""
echo "Your app should be available at: https://code.YOUR_SUBDOMAIN.workers.dev"
echo ""
echo "Next steps:"
echo "1. Verify the deployment: npx wrangler deployments list"
echo "2. Check logs: npx wrangler tail"
echo "3. Test the API: curl https://code.YOUR_SUBDOMAIN.workers.dev/api/health"

