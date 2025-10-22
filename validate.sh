#!/bin/bash
# 🚀 RealMultiLLM Code Validation Script
# 3-STEP PLAN:
# 1. Run ESLint for linting
# 2. Run TypeScript for type checking
# 3. Run Vitest for testing

set -e  # Exit immediately on error
echo "🚀 Starting code validation for RealMultiLLM..."

# STEP 1: Lint the codebase
echo "🔍 Running ESLint..."
npm run lint

# STEP 2: Type-check the codebase
echo "🔍 Running TypeScript type-checking..."
npm run type-check

# STEP 3: Run tests
echo "🧪 Running tests..."
npm run test:run:local

echo "🎉 Code validation complete! Everything looks great."
