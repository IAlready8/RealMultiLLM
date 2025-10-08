#!/usr/bin/env bash
#
# Helper script to bootstrap a PostgreSQL database for RealMultiLLM and run
# Prisma migrations.  This script assumes that `psql` and `npx` are
# available on your PATH.  Adjust the DB connection variables below to
# match your local or CI environment.

set -euo pipefail

DB_NAME=\"${DB_NAME:-realmultillm}\"
DB_USER=\"${DB_USER:-postgres}\"
DB_HOST=\"${DB_HOST:-localhost}\"
DB_PORT=\"${DB_PORT:-5432}\"
DB_PASSWORD=\"${DB_PASSWORD:-}\"

export PGPASSWORD=\"${DB_PASSWORD}\"

echo \"Creating database '${DB_NAME}' if it does not exist...\"
psql -h \"$DB_HOST\" -U \"$DB_USER\" -p \"$DB_PORT\" -tc \"SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'\" | grep -q 1 || \\
  psql -h \"$DB_HOST\" -U \"$DB_USER\" -p \"$DB_PORT\" -c \"CREATE DATABASE \\\"$DB_NAME\\\";\"

echo \"Setting DATABASE_URL for Prisma...\"
export DATABASE_URL=\"postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public\"

echo \"Generating Prisma client...\"
npx prisma generate

echo \"Applying migrations...\"
npx prisma migrate deploy

echo \"Database setup complete.\"