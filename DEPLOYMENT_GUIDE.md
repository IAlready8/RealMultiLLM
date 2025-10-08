# RealMultiLLM - Setup and Deployment Guide

## 🎯 Quick Start

The fastest way to get started:

```bash
# Clone and setup
git clone https://github.com/IAlready8/RealMultiLLM.git
cd RealMultiLLM
./scripts/quick-setup.sh
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18 or later
- npm or yarn
- Git

### Manual Setup
```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env and add your API keys

# Start development server
npm run dev
```

## 🔑 Environment Variables

Add these to your `.env` file:

```env
# Database (SQLite for development)
DATABASE_URL="file:./dev.db"

# Authentication
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# AI API Keys
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="..."
GOOGLE_AI_API_KEY="..."

# OAuth (optional)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
```

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Setup Repository**
   ```bash
   # Push your changes
   git add .
   git commit -m "Setup for Vercel deployment"
   git push
   ```

2. **Configure Vercel**
   - Connect your GitHub repository
   - Set build command: `npx prisma generate && npx prisma migrate deploy && npm run build`
   - Set output directory: `.next`
   - Set Node.js version: `18`

3. **Environment Variables**
   Set these in Vercel dashboard (do NOT put in code):
   - `DATABASE_URL` - PostgreSQL connection string
   - `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` - Your Vercel deployment URL
   - `ENCRYPTION_MASTER_KEY` - Generate with `openssl rand -hex 64`
   - All provider API keys (optional, can be set via UI)

4. **Generate Required Keys**
   ```bash
   # Generate NEXTAUTH_SECRET
   openssl rand -base64 32
   
   # Generate ENCRYPTION_MASTER_KEY
   openssl rand -hex 64
   ```

5. **Configure via Vercel CLI**
   ```bash
   # Install Vercel CLI
   npm install -g vercel
   
   # Login to Vercel
   vercel login
   
   # Link project
   vercel link
   
   # Add environment variables
   vercel env add NEXTAUTH_SECRET production
   vercel env add ENCRYPTION_MASTER_KEY production
   vercel env add DATABASE_URL production
   
   # Deploy to production
   vercel --prod
   ```

### Netlify Deployment

1. **Setup Repository**
   ```bash
   # Push your changes
   git add .
   git commit -m "Setup for deployment"
   git push
   ```

2. **Configure Netlify**
   - Connect your GitHub repository
   - Set build command: `npm run build`
   - Set publish directory: `.next`
   - Set Node.js version: `18`

3. **Environment Variables**
   Set these in Netlify dashboard (do NOT put in code):
   - `DATABASE_URL` - PostgreSQL connection string
   - `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` - Your site URL (auto-set by Netlify)
   - All API keys listed above

### Manual Deployment

```bash
# Build the application
npm run build

# Run production server
npm start
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test
npm test -- app/settings/page.test.tsx

# Run with coverage
npm run test:coverage

# Type checking
npm run type-check
```

## 🔧 Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm test             # Run tests
npm run type-check   # TypeScript checking
```

## 📱 Hardware Requirements

### Minimum (Development)
- **2022 MacBook Air M2 (8GB RAM)** ✅ Optimized
- **2013 MacBook Pro (16GB RAM)** ✅ Supported
- Any modern machine with 4GB+ RAM

### Optimizations
- Memory-efficient build process
- Offline-first development
- No Docker requirements
- SQLite for development database

## 🏗️ Project Structure

```
RealMultiLLM/
├── app/                 # Next.js 14 App Router
├── components/          # React components
├── lib/                 # Utilities and configuration
├── services/            # API and business logic
├── hooks/               # Custom React hooks
├── test/                # Test files and utilities
├── scripts/             # Build and deployment scripts
├── prisma/              # Database schema
└── types/               # TypeScript definitions
```

## 🔒 Security Features

- ✅ Encrypted API key storage
- ✅ No hardcoded secrets
- ✅ Secure environment variable management
- ✅ CSP headers and security policies
- ✅ HTTPS enforced in production

## 🌐 Database Configuration

### Development (SQLite)
- File-based database
- No setup required
- Perfect for local development

### Production (PostgreSQL)
- Set `DATABASE_URL` environment variable
- Automatic connection pooling
- Optimized for cloud deployment
- Vercel Postgres recommended for Vercel deployments

## 🐛 Troubleshooting

### Build Issues
```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
npm run build
```

### Test Issues
```bash
# Run individual test file
npm test -- path/to/test.tsx

# Check TypeScript
npm run type-check
```

### Memory Issues (8GB RAM)
- Close other applications during build
- Use `npm run dev` for development
- The build is optimized for 8GB RAM

## 📞 Support

- Check existing GitHub issues
- Create new issue with error details
- Include system specs and error logs

## 🎉 Success Criteria Met

- ✅ All tests pass locally and in CI
- ✅ Successful build completion
- ✅ Memory-efficient (8GB RAM compatible)
- ✅ No security vulnerabilities
- ✅ Offline development capability
- ✅ Production deployment ready

---

**Ready for deployment!** 🚀