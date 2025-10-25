#!/bin/bash

# RealMultiLLM Netlify Deployment Script
# Automated deployment to Netlify with pre-deployment checks

set -e

echo "🚀 Starting Netlify Deployment Process..."
echo "==================================="

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI not found. Installing..."
    npm install -g netlify-cli
fi

# Check Netlify authentication
echo "🔍 Checking Netlify authentication..."
if ! netlify status &> /dev/null; then
    echo "⚠️  Not logged in to Netlify. Please login:"
    netlify login
fi

# Run pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Check if build succeeds
echo "📦 Testing build..."
if npm run build; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

# Deploy to Netlify
echo "🚀 Deploying to Netlify..."
netlify deploy --prod

echo ""
echo "✅ Deployment complete!"
echo "🌐 Your application is now live on Netlify"
echo ""
echo "📊 Next steps:"
echo "  1. Set environment variables in Netlify dashboard"
echo "  2. Configure custom domain (optional)"
echo "  3. Test all features on production"
echo "  4. Monitor deployment logs"
echo ""
echo "🔗 Netlify Dashboard: https://app.netlify.com"
