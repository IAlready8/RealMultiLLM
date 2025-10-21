#!/bin/bash

echo "🚀 Starting Vercel Deployment Process..."
echo "==================================="

# Check if we're logged in to Vercel
if ! npx vercel whoami >/dev/null 2>&1; then
    echo "🔑 Please login to Vercel first:"
    echo "   npx vercel login"
    exit 1
fi

echo "✅ Vercel authentication confirmed"

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Check if build works
echo "📦 Testing build..."
if npm run build; then
    echo "✅ Build successful"
else
    echo "❌ Build failed - please fix errors before deploying"
    exit 1
fi

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
if npx vercel --prod; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🎉 Your enterprise Multi-LLM platform is now live!"
    echo "📊 Features deployed:"
    echo "   • GDPR/CCPA Compliance System"
    echo "   • Team Management & Collaboration"
    echo "   • Advanced Analytics & Monitoring"
    echo "   • Security Hardening (2FA, Rate Limiting)"
    echo "   • Multi-Chat Interface with Personas"
    echo "   • All Enterprise API Routes"
    echo ""
    echo "🔗 Access your deployment at the URL shown above"
    echo "📚 Configure environment variables in Vercel dashboard"
else
    echo "❌ Deployment failed"
    exit 1
fi