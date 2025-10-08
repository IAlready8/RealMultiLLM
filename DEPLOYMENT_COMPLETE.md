# RealMultiLLM - Comprehensive Deployment Guide

## 🚀 Quick Deployment Options

### One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://github.com/d3m2smac/RealMultiLLM)

## 🛠️ Prerequisites

### System Requirements
- **Development**: Node.js 18+, npm, Git
- **Database**: SQLite (local), PostgreSQL (production)
- **Memory**: 2GB+ RAM (8GB+ recommended for build processes)
- **Storage**: 500MB+ available space

### Environment Setup
```bash
# Install Node.js and npm (version 18+)
# For macOS:
brew install node@18

# For Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

## 🚀 Deployment Methods

### Method 1: Vercel Deployment (Recommended)

#### Option A: Web Interface
1. **Fork the Repository**
   ```bash
   git clone https://github.com/your-username/RealMultiLLM.git
   cd RealMultiLLM
   git remote add upstream https://github.com/d3m2smac/RealMultiLLM.git
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up/Log in
   - Click "Add New Project"
   - Import your forked repository
   - Click "Deploy"

3. **Configure Build Settings**
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `npx prisma generate && npx prisma migrate deploy && npm run build`
   - **Output Directory**: `.next`
   - **Root Directory**: Leave blank

4. **Set Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add the following:

   | Key | Value | Notes |
   |-----|-------|-------|
   | `NODE_ENV` | `production` | |
   | `NEXTAUTH_URL` | `https://your-project-name.vercel.app` | Your deployment URL |
   | `NEXTAUTH_SECRET` | `openssl rand -base64 32` | Generate with command |
   | `ENCRYPTION_MASTER_KEY` | `openssl rand -hex 64` | Generate with command |
   | `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |

#### Option B: Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Log in to Vercel
vercel login

# Link your project
vercel link

# Generate required secrets
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_MASTER_KEY=$(openssl rand -hex 64)

# Set environment variables
vercel env add NODE_ENV production
vercel env add NEXTAUTH_URL 'https://your-project-name.vercel.app'
vercel env add NEXTAUTH_SECRET production
vercel env add ENCRYPTION_MASTER_KEY production
vercel env add DATABASE_URL production

# Deploy to production
vercel --prod
```

### Method 2: Docker Deployment

#### Docker Compose (Recommended for Self-Hosting)
```bash
# Create .env file with your environment variables
cp .env.example .env
# Edit .env with your values

# Build and run with Docker Compose
docker-compose up -d

# Access at http://localhost:3000
```

#### Standalone Docker
```bash
# Build the image
docker build -t realmultillm .

# Run with environment variables
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e NEXTAUTH_SECRET='your-secret-here' \
  -e ENCRYPTION_MASTER_KEY='your-64-char-hex-key' \
  -e DATABASE_URL='postgresql://user:pass@host:port/db' \
  realmultillm
```

### Method 3: Manual Deployment

#### To Netlify
1. Push your code to GitHub
2. Go to Netlify → Add new site
3. Import your repository
4. Set build command: `npm run build`
5. Set publish directory: `.next`
6. Add environment variables in Build & Deploy → Environment

#### To DigitalOcean App Platform
1. Create new app
2. Connect your GitHub repository
3. Set environment variables
4. Set build command: `npx prisma generate && npx prisma migrate deploy && npm run build`
5. Set run command: `npm start`

#### To AWS/Azure/Google Cloud
1. Build locally: `npm run build`
2. Upload build artifacts to cloud platform
3. Set environment variables
4. Configure reverse proxy (nginx/Apache) if needed
5. Start server: `npm start`

## 🗄️ Database Configuration

### SQLite (Development Only)
```bash
# No additional setup needed
DATABASE_URL="file:./dev.db"
```

### PostgreSQL (Recommended for Production)

#### Vercel Postgres
1. Create Vercel Postgres database in Vercel dashboard
2. Use provided connection string:
```bash
DATABASE_URL="postgresql://default:PASSWORD@HOST:5432/verceldb?sslmode=require&schema=public"
```

#### Supabase
```bash
DATABASE_URL="postgresql://postgres:PASSWORD@HOST:5432/DB_NAME?sslmode=require"
```

#### Neon
```bash
DATABASE_URL="postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require"
```

### Running Migrations
```bash
# Generate Prisma client
npx prisma generate

# Deploy migrations (production)
npx prisma migrate deploy

# Push schema (development)
npx prisma db push
```

## 🔐 Security Configuration

### Environment Variables (Required)
```bash
# Authentication
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="https://yourdomain.com"

# Encryption
ENCRYPTION_MASTER_KEY="generate-with-openssl-rand-hex-64"

# Database
DATABASE_URL="your-database-connection-string"

# Optional: OAuth credentials
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

### API Keys Configuration
1. Navigate to Settings → API Keys
2. Add providers: OpenAI, Anthropic, Google AI, etc.
3. Each key is encrypted before storing in database

## ⚙️ Advanced Configuration

### Custom Domain Setup
1. In Vercel dashboard → Settings → Domains
2. Add your custom domain
3. Configure DNS settings as prompted
4. Wait for DNS propagation (up to 24 hours)

### Environment-Specific Configs
```bash
# Development
.env.development
NEXTAUTH_URL=http://localhost:3000

# Production
.env.production
NEXTAUTH_URL=https://yourdomain.com
```

### Performance Tuning
```bash
# Increase Node.js memory limit (if needed)
NODE_OPTIONS="--max-old-space-size=4096"

# Enable compression
COMPRESSION_ENABLED=true

# Cache configuration
CACHE_TTL=3600
CACHE_MAX_ITEMS=1000
```

## 🧪 Testing Deployments

### Health Check Endpoint
```
GET /api/health
Returns: { "status": "healthy", "timestamp": "..." }
```

### Load Testing
```bash
# Install artillery
npm install -g artillery

# Run load test
artillery quick --count 10 --num 20 "http://yourdomain.com/api/health"
```

## 🔧 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
npm run build

# Check available memory (8GB+ recommended)
free -h  # Linux
system_profiler SPHardwareDataType  # macOS
```

#### Database Connection Issues
```bash
# Test database connection
npx prisma db pull

# Check if migrations are applied
npx prisma migrate status
```

#### API Key Issues
```bash
# Test API key validity
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.openai.com/v1/models
```

### Debug Environment Variables
```bash
# Create a temporary API endpoint to check env vars
# POST /api/debug/env (only available in development)
{
  "NEXTAUTH_URL": "...",
  "DATABASE_URL": "...",
  "ENCRYPTION_MASTER_KEY": "..."
}
```

### Monitoring & Logging
```bash
# Vercel logs
vercel logs your-project-name.vercel.app --prod

# Docker logs
docker logs realmultillm

# Check app status
curl -I https://yourdomain.com
```

## 🚀 Production Best Practices

### Performance Optimization
- Enable Vercel Analytics
- Use CDN for static assets
- Implement proper caching strategies
- Optimize database queries

### Security Best Practices
- Use HTTPS only
- Enable CSP headers
- Regularly rotate API keys
- Monitor for vulnerabilities
- Keep dependencies updated

### Backup Strategies
- Database backups (enable in database provider)
- Export configurations: Settings → Export/Import
- Git repository backups (automatic with GitHub)

## 📈 Scaling Guidelines

### Low Traffic (<100 users/day)
- Single Vercel instance
- Free database tier sufficient
- Basic caching

### Medium Traffic (100-1000 users/day)
- Auto-scaling instances
- Database connection pooling
- Redis for caching
- CDN for assets

### High Traffic (1000+ users/day)
- Dedicated instances
- Database read replicas
- Load balancer configuration
- Advanced caching layer
- Monitoring and alerting systems

## 🔄 Updating the Application

### From GitHub
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Generate new Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build application
npm run build

# Restart application
# (Vercel: automatic, Docker: docker restart, Manual: npm start)
```

### Automated Updates
1. Set up GitHub Actions
2. Configure automatic deployment on push to main
3. Add tests to deployment pipeline

## 📞 Support & Resources

### Documentation
- [API Documentation](./docs/api-endpoints.md)
- [Provider Setup Guide](./docs/provider-setup.md)
- [Security Guide](./docs/security-guide.md)

### Community
- GitHub Issues: Report bugs and feature requests
- Discussions: Share ideas and solutions
- Discord: Real-time support (if available)

### Enterprise Support
For production deployments requiring SLA or custom features, contact the maintainers.