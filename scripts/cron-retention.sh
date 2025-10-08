#!/bin/bash

# Data Retention Cron Job
# Runs daily to enforce data retention policies
# Add to crontab: 0 2 * * * /path/to/cron-retention.sh

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

LOG_FILE="${PROJECT_DIR}/logs/retention-$(date +%Y%m%d).log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "=== Data Retention Job Started at $(date) ===" >> "$LOG_FILE"

# Load environment
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Execute retention policy via API (requires admin API key)
ADMIN_API_KEY="${ADMIN_API_KEY:-}"

if [ -z "$ADMIN_API_KEY" ]; then
  echo "ERROR: ADMIN_API_KEY not set" >> "$LOG_FILE"
  exit 1
fi

RESPONSE=$(curl -s -X POST \
  "${NEXTAUTH_URL}/api/admin/retention" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"maxAgeDays": 90, "respectPins": true, "dryRun": false}')

echo "Response: $RESPONSE" >> "$LOG_FILE"

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Retention policy executed successfully" >> "$LOG_FILE"
else
  echo "❌ Retention policy failed" >> "$LOG_FILE"
  echo "$RESPONSE" >> "$LOG_FILE"
  exit 1
fi

echo "=== Job Completed at $(date) ===" >> "$LOG_FILE"
