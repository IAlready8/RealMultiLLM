#!/bin/bash
# 🚀 RealMultiLLM Benchmark Script
# 3-STEP PLAN:
# 1. Measure build performance
# 2. Measure bundle size
# 3. Measure memory usage during runtime

set -e  # Exit immediately on error
echo "🚀 Starting performance benchmarking for RealMultiLLM..."

# STEP 1: Measure build performance
echo "⏱ Measuring build performance..."
time npm run build

# STEP 2: Measure bundle size
echo "📦 Measuring bundle size..."
du -sh .next

# STEP 3: Measure memory usage during runtime
echo "🔍 Measuring memory usage..."
npm run start &  # Start the app in the background
APP_PID=$!
sleep 5  # Wait for the app to start
ps -o pid,%mem,%cpu,comm -p $APP_PID
kill $APP_PID

echo "🎉 Benchmarking complete! Check results above."
