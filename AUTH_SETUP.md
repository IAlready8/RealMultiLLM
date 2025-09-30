# 🔐 Authentication Setup Guide

Complete guide for setting up authentication in RealMultiLLM, including demo accounts, OAuth providers, and secure credential management.

## 📋 Table of Contents

- [Overview](#overview)
- [Authentication Methods](#authentication-methods)
- [Demo Account Setup](#demo-account-setup)
- [Credentials Authentication](#credentials-authentication)
- [OAuth Setup](#oauth-setup)
- [Security Configuration](#security-configuration)
- [Troubleshooting](#troubleshooting)

## 🔍 Overview

RealMultiLLM uses **NextAuth.js v4** with **Prisma adapter** for secure authentication. The system supports:

- ✅ **Credentials Authentication** - Email/password login
- ✅ **OAuth Providers** - Google and GitHub
- ✅ **Demo Accounts** - Temporary login for testing (development only)
- ✅ **Session Management** - Secure JWT-based sessions
- ✅ **Database Storage** - User data stored in PostgreSQL/SQLite

## 🎭 Authentication Methods

### 1. Demo Account (Development Only)

**Purpose:** Quick testing without setting up OAuth or creating real accounts

**Configuration:**
- Only available when `ALLOW_DEMO_MODE=true`
- Automatically disabled in production
- No database storage required

**Demo Credentials:**
```
Email: demo@example.com
Password: DemoPassword123!@#
```

### 2. Credentials (Email/Password)

**Purpose:** Traditional email and password authentication

**Features:**
- Secure password hashing with bcrypt
- Strong password requirements
- Database-backed user accounts
- Password reset capability (via custom implementation)

### 3. OAuth Providers

**Purpose:** Social login with Google or GitHub

**Features:**
- No password management needed
- Automatic account creation
- Secure token handling via NextAuth.js
- Profile information sync

## 🎪 Demo Account Setup

### For Development/Testing

Demo accounts are automatically configured when `ALLOW_DEMO_MODE=true`. This is perfect for:
- Local development
- Testing authentication flow
- Demo environments
- CI/CD pipelines

### Environment Configuration

**Development (.env.local):**
```bash
# Enable demo mode for development
ALLOW_DEMO_MODE=true
NODE_ENV=development
```

**Production (Vercel):**
```bash
# MUST be false or omitted in production
ALLOW_DEMO_MODE=false
NODE_ENV=production
```

### Using Demo Account

1. **Navigate to Login Page**
   - Go to `http://localhost:3000/auth/signin`
   - Or your deployed URL

2. **Enter Demo Credentials**
   ```
   Email: demo@example.com
   Password: DemoPassword123!@#
   ```

3. **Sign In**
   - Demo account logs in without database lookup
   - Session is created with demo user ID
   - All features available for testing

### Important Notes

⚠️ **Demo Account Limitations:**
- Only works when `ALLOW_DEMO_MODE=true`
- No persistent data storage
- Session-only user (no database record)
- Should NEVER be enabled in production
- User ID is `demo-1` (hardcoded)

⚠️ **Security Warning:**
```
NEVER set ALLOW_DEMO_MODE=true in production!
This bypasses authentication security and is for
development and testing purposes only.
```

## 🔑 Credentials Authentication

### Setting Up Email/Password Auth

Email/password authentication is **always enabled** and requires:
1. Database configured
2. User accounts created
3. Passwords hashed with bcrypt

### Creating User Accounts

#### Option 1: Using Prisma Studio (Recommended for First User)

```bash
# Start Prisma Studio
npx prisma studio

# In the browser:
# 1. Go to "User" model
# 2. Click "Add record"
# 3. Fill in:
#    - email: your-email@example.com
#    - name: Your Name
#    - password: (hashed - see below)
```

**Hashing Password:**

```bash
# Install bcryptjs if not installed
npm install bcryptjs

# Create hash_password.js in project root
cat > hash_password.js << 'EOF'
const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'DefaultPassword123!';
const hash = bcrypt.hashSync(password, 10);
console.log('Password:', password);
console.log('Hash:', hash);
EOF

# Run to generate hash
node hash_password.js "YourSecurePassword123!"

# Copy the hash output to Prisma Studio
```

#### Option 2: Using SQL Insert

```sql
-- Connect to your database
-- For Supabase: Use SQL Editor in dashboard
-- For Neon: Use SQL Editor in dashboard

INSERT INTO "User" (id, email, name, password, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,  -- or use cuid() if available
  'admin@example.com',
  'Admin User',
  '$2a$10$HASHED_PASSWORD_HERE',  -- Use hash from bcrypt
  NOW(),
  NOW()
);
```

#### Option 3: Registration API Endpoint (Custom Implementation)

Create a registration endpoint:

```typescript
// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();
    
    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existing) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      }
    });
    
    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
```

### Password Requirements

As configured in `lib/auth.ts`:

- ✅ Minimum 12 characters
- ✅ At least one lowercase letter
- ✅ At least one uppercase letter
- ✅ At least one number
- ✅ At least one special character (@$!%*?&)

**Example Valid Passwords:**
```
SecurePassword123!
MyP@ssw0rd2024
Tr0ng!P@ssw0rd
```

## 🌐 OAuth Setup

### Google OAuth

#### Step 1: Create Google OAuth Credentials

1. **Go to Google Cloud Console**
   - Visit [console.cloud.google.com](https://console.cloud.google.com)
   - Sign in with your Google account

2. **Create Project (if needed)**
   - Click "Select a project" → "New Project"
   - Enter project name: "RealMultiLLM"
   - Click "Create"

3. **Enable OAuth**
   - Navigate to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - If prompted, configure OAuth consent screen first

4. **Configure OAuth Consent Screen**
   - User Type: External (for public apps) or Internal (for organization)
   - App name: "RealMultiLLM"
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue"
   - Scopes: Add `email` and `profile` (default)
   - Click "Save and Continue"

5. **Create OAuth Client**
   - Application type: "Web application"
   - Name: "RealMultiLLM Web Client"
   - Authorized JavaScript origins:
     ```
     http://localhost:3000
     https://your-app.vercel.app
     ```
   - Authorized redirect URIs:
     ```
     http://localhost:3000/api/auth/callback/google
     https://your-app.vercel.app/api/auth/callback/google
     ```
   - Click "Create"

6. **Save Credentials**
   - Copy "Client ID"
   - Copy "Client Secret"
   - Store these securely!

#### Step 2: Configure Environment Variables

**Local Development (.env.local):**
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
```

**Production (Vercel):**
- Add the same variables in Vercel Dashboard → Settings → Environment Variables

### GitHub OAuth

#### Step 1: Create GitHub OAuth App

1. **Go to GitHub Settings**
   - Visit [github.com/settings/developers](https://github.com/settings/developers)
   - Click "OAuth Apps" → "New OAuth App"

2. **Register Application**
   - Application name: "RealMultiLLM"
   - Homepage URL: `https://your-app.vercel.app` (or localhost for dev)
   - Authorization callback URL:
     ```
     http://localhost:3000/api/auth/callback/github
     https://your-app.vercel.app/api/auth/callback/github
     ```
   - Click "Register application"

3. **Generate Client Secret**
   - Click "Generate a new client secret"
   - Copy the secret immediately (shown only once!)

4. **Save Credentials**
   - Copy "Client ID"
   - Copy "Client Secret"
   - Store these securely!

#### Step 2: Configure Environment Variables

**Local Development (.env.local):**
```bash
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

**Production (Vercel):**
- Add the same variables in Vercel Dashboard → Settings → Environment Variables

### Testing OAuth

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Navigate to Sign In Page**
   ```
   http://localhost:3000/auth/signin
   ```

3. **Click OAuth Provider Button**
   - "Sign in with Google" or "Sign in with GitHub"
   - Authorize the application
   - You should be redirected back and logged in

## 🔒 Security Configuration

### Required Environment Variables

```bash
# NextAuth Configuration (REQUIRED)
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# Database (REQUIRED)
DATABASE_URL=postgresql://...

# Encryption Key (REQUIRED for API key storage)
ENCRYPTION_MASTER_KEY=generate-with-openssl-rand-hex-64
```

### Generating Secure Keys

```bash
# NEXTAUTH_SECRET (32+ characters)
openssl rand -base64 32
# Output example: K7xJf2Zq9Wp3Ym5Tr8Ns1Hv6Cd4Xb0Ae=

# ENCRYPTION_MASTER_KEY (64 characters hex)
openssl rand -hex 64
# Output example: a1b2c3d4e5f6...

# Alternative with Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Session Configuration

As configured in `lib/auth.ts`:

```typescript
session: {
  strategy: "jwt",
  maxAge: 7200,        // 2 hours (production recommended)
  updateAge: 1800,     // 30 minutes (session refresh)
}
```

**Recommendations:**
- **Development**: 7200 seconds (2 hours)
- **Production**: 3600-7200 seconds (1-2 hours)
- **High Security**: 1800 seconds (30 minutes)

### Security Best Practices

1. **NEXTAUTH_SECRET**
   - ✅ Use 32+ character random string
   - ✅ Different for each environment
   - ✅ Never commit to git
   - ✅ Rotate periodically (invalidates all sessions)

2. **NEXTAUTH_URL**
   - ✅ Must match deployment URL exactly
   - ✅ Include protocol (https://)
   - ✅ No trailing slash
   - ✅ Update when domain changes

3. **OAuth Credentials**
   - ✅ Store in environment variables only
   - ✅ Different credentials per environment
   - ✅ Enable only authorized redirect URIs
   - ✅ Monitor OAuth usage in provider dashboards

4. **Passwords**
   - ✅ Enforce strong password policy
   - ✅ Use bcrypt with cost factor 10+
   - ✅ Never log passwords
   - ✅ Implement password reset flow

5. **Demo Mode**
   - ✅ Only enable in development
   - ✅ Verify disabled in production
   - ✅ Document security implications
   - ✅ Consider separate demo deployment

## 🛠️ Advanced Configuration

### Custom Sign In Page

The sign-in page is located at `app/auth/signin/page.tsx`. You can customize:
- Logo and branding
- Form fields
- OAuth provider buttons
- Layout and styling

### Authentication Callbacks

In `lib/auth.ts`, callbacks are used for:

```typescript
callbacks: {
  async session({ session, token }) {
    // Add user ID to session
    if (token && session.user) {
      session.user.id = token.sub!;
    }
    return session;
  },
  async jwt({ token, user }) {
    // Add user ID to JWT
    if (user) {
      token.id = user.id;
    }
    return token;
  }
}
```

### Database Adapter

The Prisma adapter handles:
- ✅ User account creation
- ✅ OAuth account linking
- ✅ Session management
- ✅ Verification tokens

Configuration in `lib/auth.ts`:
```typescript
adapter: PrismaAdapter(prisma)
```

## 🐛 Troubleshooting

### "Configuration error"

**Issue:** NextAuth shows configuration error

**Solutions:**
```bash
# 1. Verify NEXTAUTH_URL matches exactly
NEXTAUTH_URL=https://your-app.vercel.app  # No trailing slash!

# 2. Verify NEXTAUTH_SECRET is set and 32+ characters
NEXTAUTH_SECRET=your-secret-here-at-least-32-chars

# 3. Verify DATABASE_URL is correct
DATABASE_URL=postgresql://...

# 4. Check all environment variables are set in Vercel
# Vercel Dashboard → Settings → Environment Variables
```

### OAuth Provider Errors

**Issue:** "Redirect URI mismatch"

**Solutions:**
```bash
# 1. Verify redirect URI in OAuth provider settings matches exactly
# Google: http://localhost:3000/api/auth/callback/google
# GitHub: http://localhost:3000/api/auth/callback/github

# 2. For production, update to:
# https://your-app.vercel.app/api/auth/callback/google
# https://your-app.vercel.app/api/auth/callback/github

# 3. Check NEXTAUTH_URL matches deployment URL
```

**Issue:** "Client authentication failed"

**Solutions:**
```bash
# 1. Verify client ID and secret are correct
# 2. Check for extra spaces or newlines in env vars
# 3. Regenerate client secret in provider dashboard
```

### Credentials Authentication Issues

**Issue:** "Invalid credentials"

**Solutions:**
```bash
# 1. Verify user exists in database
npx prisma studio
# Check User table

# 2. Verify password is hashed correctly
# Test hash: node hash_password.js "test-password"

# 3. Check password meets requirements (12+ chars, etc.)
```

**Issue:** "Cannot sign in"

**Solutions:**
```bash
# 1. Check database connection
# Verify DATABASE_URL is correct

# 2. Verify Prisma client is generated
npx prisma generate

# 3. Check database has User table
# Use Prisma Studio or database GUI
```

### Session Issues

**Issue:** "Session not persisting"

**Solutions:**
```bash
# 1. Verify NEXTAUTH_SECRET is set
# 2. Check cookies are enabled in browser
# 3. Verify domain configuration (no http/https mismatch)
# 4. Check session maxAge isn't too short
```

### Demo Account Issues

**Issue:** "Demo account not working"

**Solutions:**
```bash
# 1. Verify ALLOW_DEMO_MODE=true
echo $ALLOW_DEMO_MODE

# 2. Check you're using correct credentials
# Email: demo@example.com
# Password: DemoPassword123!@#

# 3. Verify NODE_ENV is not "production"
echo $NODE_ENV
```

## 📊 Monitoring Authentication

### View Active Sessions

```sql
-- Connect to database
SELECT 
  id, 
  "userId", 
  "sessionToken", 
  expires,
  expires > NOW() as "isValid"
FROM "Session"
ORDER BY expires DESC;
```

### View User Accounts

```sql
SELECT 
  id,
  email,
  name,
  "emailVerified",
  "createdAt"
FROM "User"
ORDER BY "createdAt" DESC;
```

### View OAuth Connections

```sql
SELECT 
  u.email,
  a.provider,
  a."providerAccountId",
  a."createdAt"
FROM "Account" a
JOIN "User" u ON a."userId" = u.id
ORDER BY a."createdAt" DESC;
```

## 📚 Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org)
- [Prisma Adapter](https://next-auth.js.org/adapters/prisma)
- [Google OAuth Setup](https://next-auth.js.org/providers/google)
- [GitHub OAuth Setup](https://next-auth.js.org/providers/github)
- [Session Strategies](https://next-auth.js.org/configuration/options#session)

## 📝 Quick Reference

### Where to Set API Keys

| Key Type | Location | Notes |
|----------|----------|-------|
| **Local Development** | `.env.local` | Never commit this file |
| **Vercel Production** | Project Settings → Environment Variables | Set for Production environment |
| **Vercel Preview** | Project Settings → Environment Variables | Optional, for preview deployments |
| **CI/CD** | GitHub Secrets or CI tool | For automated tests |

### Demo Account Access

```
📧 Email: demo@example.com
🔑 Password: DemoPassword123!@#
⚠️  Only works when ALLOW_DEMO_MODE=true
⚠️  Must be disabled in production!
```

### Key Generation Commands

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_MASTER_KEY
openssl rand -hex 64

# Password Hash
node -e "console.log(require('bcryptjs').hashSync('password', 10))"
```

---

**Authentication fully configured!** 🎉 Your app is secure and ready for users.
