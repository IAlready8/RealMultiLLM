#!/bin/bash
# Vercel Build Script for RealMultiLLM

set -e  # Exit immediately if a command exits with a non-zero status

echo "Starting build process for RealMultiLLM..."

# Install dependencies
echo "Installing dependencies..."
npm ci

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations (for production)
echo "Running database migrations..."
npx prisma migrate deploy

# Build the Next.js application
echo "Building Next.js application..."
npm run build

# Run type checks
echo "Running type checks..."
npm run type-check

# Run linting
echo "Running linting..."
npm run lint

# Optional: Run tests (comment out if builds are taking too long)
# echo "Running tests..."
# npm run test:run

echo "Build completed successfully!"