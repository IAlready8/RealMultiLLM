# 🗄️ Database Setup Guide - Supabase & Neon

Complete guide for setting up production PostgreSQL databases with either Supabase or Neon for RealMultiLLM.

## 📋 Table of Contents

- [Overview](#overview)
- [Supabase Setup](#supabase-setup)
- [Neon Setup](#neon-setup)
- [Database Migration](#database-migration)
- [Connection Configuration](#connection-configuration)
- [Troubleshooting](#troubleshooting)

## 🔍 Overview

RealMultiLLM uses PostgreSQL in production. Both Supabase and Neon offer:
- ✅ Free tier with generous limits
- ✅ Automatic backups
- ✅ Connection pooling
- ✅ SSL connections
- ✅ Dashboard for database management

### Comparison

| Feature | Supabase | Neon |
|---------|----------|------|
| **Free Tier Database** | 500 MB | 3 GB |
| **Connection Pooling** | PgBouncer (built-in) | Native |
| **Backups** | Point-in-time recovery | Branches & PITR |
| **Dashboard** | Full-featured | Simplified |
| **Additional Features** | Auth, Storage, Realtime | Database focus |
| **Best For** | All-in-one platform | Pure database needs |

**Recommendation:** Use **Supabase** if you want an all-in-one platform with potential to use Auth/Storage features later. Use **Neon** if you want the simplest pure PostgreSQL solution.

## 🟢 Supabase Setup

### Step 1: Create Supabase Project

1. **Sign Up / Log In**
   - Go to [supabase.com](https://supabase.com)
   - Click "Start your project"
   - Sign in with GitHub (recommended)

2. **Create New Project**
   - Click "New Project"
   - Choose organization (or create one)
   - Enter project details:
     - **Name**: `realmultillm` (or your preferred name)
     - **Database Password**: Generate a strong password (save this!)
     - **Region**: Choose closest to your users
     - **Plan**: Free tier is fine to start
   - Click "Create new project"
   - Wait ~2 minutes for provisioning

### Step 2: Get Connection String

1. **Navigate to Database Settings**
   - In project dashboard, go to **Settings** (gear icon)
   - Click **Database** in left sidebar

2. **Copy Connection String**
   - Find "Connection string" section
   - Select **URI** format
   - Copy the connection pooler URL (recommended for production)
   
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true
   ```

   **Important Notes:**
   - Use **port 6543** (connection pooler) not 5432 (direct connection)
   - Replace `[YOUR-PASSWORD]` with your database password
   - Keep the `?pgbouncer=true` parameter for optimal performance
   - Connection pooler prevents "too many connections" errors

3. **Connection String Formats**

   **For Vercel (Connection Pooler - Recommended):**
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   ```

   **For Local Development (Direct Connection):**
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

### Step 3: Configure Database

1. **Enable Extensions (Optional but recommended)**
   
   Go to **Database** → **Extensions** and enable:
   - `uuid-ossp` - for UUID generation
   - `pg_stat_statements` - for query performance monitoring

2. **Set Connection Limits**
   
   For free tier, keep connections minimal:
   - Vercel: Use connection pooler with `connection_limit=1`
   - This prevents hitting Supabase's connection limit

### Step 4: Deploy Schema

1. **Set Environment Variable**
   ```bash
   export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true"
   ```

2. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

3. **Deploy Database Schema**
   ```bash
   # Option 1: Push schema (for development/quick setup)
   npx prisma db push
   
   # Option 2: Create and apply migration (for production)
   npx prisma migrate deploy
   ```

4. **Verify Tables Created**
   - Go to Supabase Dashboard → **Table Editor**
   - You should see all tables: User, Account, Session, Conversation, etc.

### Step 5: Set Up in Vercel

1. **Add to Vercel Environment Variables**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add `DATABASE_URL` with the connection pooler URL
   - Apply to: Production, Preview, Development

2. **Redeploy**
   - Trigger a new deployment to apply the changes

### Supabase Management

**View Database:**
- **Table Editor**: Visual interface for data
- **SQL Editor**: Run custom queries
- **Database**: View connection details

**Backups:**
- Free tier: Daily backups (7-day retention)
- Paid: Point-in-time recovery

**Monitoring:**
- **Database**: View connection stats
- **Logs**: Query logs and errors

## 🔵 Neon Setup

### Step 1: Create Neon Project

1. **Sign Up / Log In**
   - Go to [neon.tech](https://neon.tech)
   - Click "Sign up" or "Get Started"
   - Sign in with GitHub (recommended)

2. **Create New Project**
   - Click "New Project"
   - Enter project details:
     - **Project Name**: `realmultillm`
     - **Postgres version**: 16 (latest stable)
     - **Region**: Choose closest to your users
   - Click "Create Project"
   - Project provisions instantly

### Step 2: Get Connection String

1. **Dashboard Connection Details**
   - After project creation, you'll see connection details
   - Connection string is displayed prominently

2. **Copy Connection String**
   
   **For Vercel (Pooled Connection - Recommended):**
   ```
   postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require
   ```

   **Connection String Components:**
   - **User**: Usually matches project name
   - **Password**: Generated automatically (save this!)
   - **Endpoint**: Unique endpoint for your project
   - **Database**: Default is `neondb`

3. **Connection Details Location**
   - Dashboard → Your Project → Connection Details
   - Click "Show password" to reveal
   - Use "Pooled connection" for production (recommended)

### Step 3: Configure Database

Neon automatically provides:
- ✅ Connection pooling (no configuration needed)
- ✅ SSL encryption (enforced)
- ✅ Automatic scaling
- ✅ Instant branching

**No additional configuration required!**

### Step 4: Deploy Schema

1. **Set Environment Variable**
   ```bash
   export DATABASE_URL="postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require"
   ```

2. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

3. **Deploy Database Schema**
   ```bash
   # Option 1: Push schema (for development/quick setup)
   npx prisma db push
   
   # Option 2: Create and apply migration (for production)
   npx prisma migrate deploy
   ```

4. **Verify Tables Created**
   - Go to Neon Dashboard → Your Project → Tables
   - You should see all tables created

### Step 5: Set Up in Vercel

1. **Add to Vercel Environment Variables**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add `DATABASE_URL` with the pooled connection string
   - Apply to: Production, Preview, Development

2. **Redeploy**
   - Trigger a new deployment

### Neon Management

**View Database:**
- **Tables**: View table structure
- **SQL Editor**: Run queries
- **Branches**: Create database branches for testing

**Backups:**
- **Branches**: Create instant branches for testing
- **History**: 7-day point-in-time recovery (free tier)

**Monitoring:**
- **Metrics**: CPU, memory, storage usage
- **Operations**: Query history

## 🔄 Database Migration

### Initial Setup

1. **From SQLite (Development) to PostgreSQL (Production)**

   Your local setup uses SQLite. To migrate to production PostgreSQL:

   ```bash
   # 1. Update Prisma schema (already configured for PostgreSQL)
   # Check prisma/schema.prisma - should have:
   # datasource db {
   #   provider = "postgresql"
   #   url      = env("DATABASE_URL")
   # }
   
   # 2. Set production DATABASE_URL
   export DATABASE_URL="your-production-connection-string"
   
   # 3. Generate Prisma client for PostgreSQL
   npx prisma generate
   
   # 4. Deploy schema
   npx prisma db push
   # or
   npx prisma migrate deploy
   ```

2. **Create Initial Migration (Optional)**

   For production, it's better to use migrations:

   ```bash
   # Create initial migration
   npx prisma migrate dev --name init
   
   # This creates: prisma/migrations/[timestamp]_init/migration.sql
   
   # Deploy to production
   npx prisma migrate deploy
   ```

### Data Migration (If Needed)

If you have existing data in SQLite to migrate:

```bash
# 1. Export data from SQLite
sqlite3 dev.db .dump > backup.sql

# 2. Convert SQLite SQL to PostgreSQL compatible
# (Manual process - SQLite and PostgreSQL have syntax differences)

# 3. Import to PostgreSQL
psql $DATABASE_URL -f backup.sql
```

**Note:** For initial deployment, start fresh rather than migrating data.

## 🔌 Connection Configuration

### Connection Pooling

**Why Connection Pooling?**
- Serverless functions create new connections frequently
- Prevents "too many connections" errors
- Improves performance and reliability

**Supabase Configuration:**
```bash
# Use connection pooler (port 6543)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1"
```

**Neon Configuration:**
```bash
# Pooling is automatic, just use the pooled connection string
DATABASE_URL="postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require"
```

### Prisma Configuration

In `schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

### Environment-Specific URLs

**Development (.env.local):**
```bash
DATABASE_URL="file:./dev.db"  # SQLite for local dev
```

**Production (Vercel):**
```bash
DATABASE_URL="postgresql://..."  # PostgreSQL from Supabase/Neon
```

## 🐛 Troubleshooting

### Connection Issues

**Error: "Can't reach database server"**
```bash
# Solutions:
# 1. Check DATABASE_URL format is correct
# 2. Verify password is correct (no special characters unescaped)
# 3. Check if database is paused (Supabase free tier auto-pauses)
# 4. Verify network connectivity
```

**Error: "Too many connections"**
```bash
# Solutions:
# 1. Use connection pooler (port 6543 for Supabase)
# 2. Add connection_limit=1 to connection string
# 3. Close connections properly in code
# 4. Upgrade to paid tier for more connections
```

### SSL/TLS Issues

**Error: "SSL connection required"**
```bash
# Solution: Add SSL parameters to connection string
# Supabase:
DATABASE_URL="...?pgbouncer=true&sslmode=require"

# Neon:
DATABASE_URL="...?sslmode=require"
```

### Migration Issues

**Error: "Migration failed"**
```bash
# Solutions:
# 1. Reset database (development only!)
npx prisma migrate reset

# 2. Push schema directly (development)
npx prisma db push

# 3. Check migration logs
cat prisma/migrations/[migration-name]/migration.sql

# 4. Apply migrations manually
psql $DATABASE_URL -f prisma/migrations/[migration-name]/migration.sql
```

### Performance Issues

**Slow queries**
```bash
# Solutions:
# 1. Add indexes to Prisma schema
# 2. Use connection pooling
# 3. Optimize queries (use Prisma query logging)
# 4. Check database location (should be near Vercel region)
```

**Connection timeouts**
```bash
# Solutions:
# 1. Increase timeout in DATABASE_URL
DATABASE_URL="...?connect_timeout=10"

# 2. Use connection pooler
# 3. Check database isn't paused (Supabase)
```

### Supabase-Specific

**Database paused (free tier)**
- Supabase pauses inactive databases after 1 week
- Solution: Access database to wake it up
- Consider upgrading for always-on databases

**Connection limit reached**
- Free tier has limited connections
- Solution: Use connection pooler with connection_limit=1
- Upgrade to Pro for more connections

### Neon-Specific

**Branch management**
- Don't use production branch for testing
- Create dev branches for testing
- Keep production branch clean

**Compute units**
- Free tier has limited compute hours
- Monitor usage in dashboard
- Upgrade if you hit limits

## 🔒 Security Best Practices

1. **Passwords**
   - Use strong, unique passwords
   - Store passwords in environment variables only
   - Never commit passwords to git

2. **Connection Strings**
   - Keep connection strings secret
   - Use Vercel environment variables
   - Rotate credentials periodically

3. **SSL**
   - Always use SSL in production
   - Supabase and Neon enforce SSL by default

4. **Backups**
   - Verify backup strategy
   - Test restoration process
   - Export data regularly for critical applications

5. **Access Control**
   - Use least privilege principle
   - Create separate database users for different purposes
   - Monitor access logs

## 📊 Monitoring

### Supabase

- **Database**: Connection stats, size, performance
- **Logs**: Query logs, error logs
- **API**: Request logs (if using Supabase Auth/Storage)

### Neon

- **Metrics**: CPU, memory, storage, operations
- **History**: Point-in-time view of database activity
- **Branches**: Monitor branch usage

## 📚 Additional Resources

### Supabase
- [Official Documentation](https://supabase.com/docs)
- [Connection Pooling Guide](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Prisma with Supabase](https://supabase.com/docs/guides/integrations/prisma)

### Neon
- [Official Documentation](https://neon.tech/docs)
- [Connection Pooling](https://neon.tech/docs/connect/connection-pooling)
- [Prisma with Neon](https://neon.tech/docs/guides/prisma)

### Prisma
- [Deployment Guide](https://www.prisma.io/docs/guides/deployment)
- [Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [Vercel Deployment](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)

---

**Database setup complete!** 🎉 Your PostgreSQL database is ready for production use.
