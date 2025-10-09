#!/bin/bash

# Simple Deployment Check Script
echo "🔍 Running deployment check..."
echo ""

# Check for required files
echo "📁 Checking for required files..."
files=("package.json" "next.config.mjs" "app/page.tsx" "app/layout.tsx")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file - OK"
    else
        echo "❌ $file - MISSING"
        exit 1
    fi
done

# Check for enterprise modules
echo ""
echo "🏢 Checking for enterprise modules..."
modules=("lib/config/index.ts" "lib/observability/telemetry.ts" "lib/security/hardening.ts" "lib/performance/perf-toolkit.ts")
for module in "${modules[@]}"; do
    if [ -f "$module" ]; then
        echo "✅ $module - OK"
    else
        echo "❌ $module - MISSING"
        exit 1
    fi
done

# Check for node and npm
echo ""
echo "🧰 Checking for Node.js and npm..."
if command -v node >/dev/null 2>&1; then
    echo "✅ Node.js - $(node --version)"
else
    echo "❌ Node.js - NOT FOUND"
    exit 1
fi

if command -v npm >/dev/null 2>&1; then
    echo "✅ npm - $(npm --version)"
else
    echo "❌ npm - NOT FOUND"
    exit 1
fi

echo ""
echo "🎉 All checks passed! Application is ready for deployment."
echo ""
echo "🚀 To deploy to Vercel, run:"
echo "   vercel --prod"
echo ""