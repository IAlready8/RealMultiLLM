#!/bin/bash
# 🚀 RealMultiLLM Deployment Script
# 3-STEP PLAN:
# 1. Build the application
# 2. Deploy to the production server
# 3. Verify deployment

set -e  # Exit immediately on error
echo "🚀 Starting deployment for RealMultiLLM..."

# STEP 1: Build the application
echo "🔨 Building application for production..."
./build.sh

# STEP 2: Deploy to production
echo "📦 Deploying to production..."
# Replace this with your deployment command (e.g., Netlify, Vercel, or SCP)
vercel --prod

# STEP 3: Verify deployment
echo "✅ Verifying deployment..."
# Replace this with your verification logic
curl -s --head https://realmultillm.vercel.app | head -n 1 | grep "200 OK" || {
  echo "❌ Deployment verification failed."
  exit 1
}

echo "🎉 Deployment complete! Application is live at https://realmultillm.vercel.app"
