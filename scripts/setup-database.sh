#!/bin/bash
# Database Setup Script for Production (Supabase or Neon)
# This script helps you set up your production database

set -e

echo "🗄️  RealMultiLLM - Production Database Setup"
echo "=============================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ ERROR: DATABASE_URL environment variable is not set${NC}"
    echo ""
    echo "Please set your production database URL:"
    echo ""
    echo "For Supabase:"
    echo 'export DATABASE_URL="postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"'
    echo ""
    echo "For Neon:"
    echo 'export DATABASE_URL="postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require"'
    echo ""
    exit 1
fi

echo -e "${BLUE}📊 Database URL found${NC}"
echo "Using: ${DATABASE_URL:0:30}..."
echo ""

# Detect database provider
if [[ $DATABASE_URL == *"supabase"* ]]; then
    echo -e "${GREEN}✓ Detected: Supabase${NC}"
    PROVIDER="supabase"
elif [[ $DATABASE_URL == *"neon"* ]]; then
    echo -e "${GREEN}✓ Detected: Neon${NC}"
    PROVIDER="neon"
else
    echo -e "${YELLOW}⚠️  Unknown database provider (assuming PostgreSQL-compatible)${NC}"
    PROVIDER="generic"
fi
echo ""

# Check if connection pooling is configured
if [[ $DATABASE_URL == *"pgbouncer=true"* ]] || [[ $DATABASE_URL == *"pooler"* ]]; then
    echo -e "${GREEN}✓ Connection pooling: Enabled${NC}"
else
    echo -e "${YELLOW}⚠️  Connection pooling: Not detected${NC}"
    echo "   Consider using connection pooling for production"
fi
echo ""

# Check Node.js and npm
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js: $(node --version)${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm: $(npm --version)${NC}"
echo ""

# Check if Prisma is installed
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx is not available${NC}"
    exit 1
fi

# Test database connection
echo -e "${BLUE}🔌 Testing database connection...${NC}"
if npx prisma db execute --stdin <<< "SELECT 1;" 2>/dev/null; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}❌ Failed to connect to database${NC}"
    echo "   Please check your DATABASE_URL and database status"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Verify DATABASE_URL is correct"
    echo "  2. Check if database is running (Supabase doesn't auto-pause, Neon might)"
    echo "  3. Verify SSL settings are correct"
    echo "  4. Check network connectivity"
    exit 1
fi
echo ""

# Generate Prisma Client
echo -e "${BLUE}⚙️  Generating Prisma Client...${NC}"
if npx prisma generate; then
    echo -e "${GREEN}✓ Prisma Client generated${NC}"
else
    echo -e "${RED}❌ Failed to generate Prisma Client${NC}"
    exit 1
fi
echo ""

# Ask user which deployment method to use
echo -e "${BLUE}📋 Choose deployment method:${NC}"
echo "  1) db push - Quick schema sync (recommended for first-time setup)"
echo "  2) migrate deploy - Apply migrations (recommended for production)"
echo "  3) migrate dev - Create new migration (for development)"
echo ""
read -p "Enter choice (1, 2, or 3): " choice
echo ""

case $choice in
    1)
        echo -e "${BLUE}🚀 Running prisma db push...${NC}"
        echo "This will sync your schema with the database"
        echo ""
        if npx prisma db push; then
            echo ""
            echo -e "${GREEN}✓ Database schema pushed successfully${NC}"
        else
            echo ""
            echo -e "${RED}❌ Failed to push schema${NC}"
            exit 1
        fi
        ;;
    2)
        echo -e "${BLUE}🚀 Running prisma migrate deploy...${NC}"
        echo "This will apply pending migrations"
        echo ""
        if npx prisma migrate deploy; then
            echo ""
            echo -e "${GREEN}✓ Migrations applied successfully${NC}"
        else
            echo ""
            echo -e "${RED}❌ Failed to apply migrations${NC}"
            exit 1
        fi
        ;;
    3)
        echo -e "${YELLOW}⚠️  Running migrate dev in production is not recommended${NC}"
        read -p "Continue anyway? (y/N): " confirm
        if [[ $confirm == "y" || $confirm == "Y" ]]; then
            read -p "Enter migration name: " migration_name
            echo ""
            echo -e "${BLUE}🚀 Creating and applying migration...${NC}"
            if npx prisma migrate dev --name "$migration_name"; then
                echo ""
                echo -e "${GREEN}✓ Migration created and applied${NC}"
            else
                echo ""
                echo -e "${RED}❌ Failed to create migration${NC}"
                exit 1
            fi
        else
            echo "Cancelled"
            exit 0
        fi
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac
echo ""

# Verify tables were created
echo -e "${BLUE}🔍 Verifying database tables...${NC}"
TABLES=$(npx prisma db execute --stdin <<< "SELECT tablename FROM pg_tables WHERE schemaname = 'public';" 2>/dev/null | grep -v '^--' | grep -v '^$' || echo "")

if [ -z "$TABLES" ]; then
    echo -e "${YELLOW}⚠️  Could not verify tables (may require different query)${NC}"
else
    echo -e "${GREEN}✓ Database tables created:${NC}"
    echo "$TABLES" | while read table; do
        echo "  - $table"
    done
fi
echo ""

# Offer to open Prisma Studio
echo -e "${BLUE}📊 Database setup complete!${NC}"
echo ""
read -p "Would you like to open Prisma Studio to view your database? (y/N): " open_studio

if [[ $open_studio == "y" || $open_studio == "Y" ]]; then
    echo ""
    echo -e "${BLUE}Opening Prisma Studio...${NC}"
    echo "Press Ctrl+C to exit when done"
    echo ""
    npx prisma studio
else
    echo ""
    echo -e "${GREEN}✅ Setup Complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Verify tables in your database dashboard:"
    if [ "$PROVIDER" == "supabase" ]; then
        echo "     → https://supabase.com/dashboard/project/_/editor"
    elif [ "$PROVIDER" == "neon" ]; then
        echo "     → https://console.neon.tech/app/projects"
    else
        echo "     → Your database management interface"
    fi
    echo "  2. Create your first user account (see AUTH_SETUP.md)"
    echo "  3. Deploy your application to Vercel"
    echo "  4. Test the connection"
    echo ""
    echo "To manage your database later:"
    echo "  - npx prisma studio (GUI)"
    echo "  - npx prisma db push (sync schema)"
    echo "  - npx prisma migrate deploy (apply migrations)"
    echo ""
fi
