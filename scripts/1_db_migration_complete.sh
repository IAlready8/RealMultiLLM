#!/usr/bin/env bash

# Wrapper script for the enterprise database migration workflow.
# Delegates to the maintained implementation in scripts/db-migration.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEGACY_SCRIPT="$SCRIPT_DIR/db-migration.sh"

if [ ! -f "$LEGACY_SCRIPT" ]; then
  echo "db-migration.sh not found at $LEGACY_SCRIPT" >&2
  exit 1
fi

exec "$LEGACY_SCRIPT" "$@"
