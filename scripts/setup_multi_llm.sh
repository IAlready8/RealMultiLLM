#!/usr/bin/env bash
# NEW SCRIPT: scripts/setup_multi_llm.sh
# Full local setup for Multi-LLM platform (No Docker). Validates hardware, installs deps,
# prepares Prisma, and checks Ollama availability.

set -euo pipefail

echo "==> Multi-LLM local setup"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> OS: $(uname -a)"
echo "==> Node: $(node -v || true)"
echo "==> NPM: $(npm -v || true)"

# Hardware validation for M2 MacBook Air constraints
echo "==> Validating hardware constraints"
CPU_CORES=$(sysctl -n hw.ncpu 2>/dev/null || getconf _NPROCESSORS_ONLN || echo 1)
MEM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
MEM_GB=$(( MEM_BYTES / 1024 / 1024 / 1024 ))
echo "    Cores: $CPU_CORES, RAM: ${MEM_GB}GB"
if [ "$MEM_GB" -lt 8 ]; then
  echo "[WARN] Less than 8GB RAM detected. Consider smaller local models and reduced concurrency."
fi

echo "==> Installing Node dependencies"
npm ci || npm install

echo "==> Prisma generate and DB push"
npx prisma generate
DATABASE_URL=${DATABASE_URL:-"file:./dev.db"}
echo "    DATABASE_URL=$DATABASE_URL"
npx prisma db push

echo "==> Checking Ollama availability"
OLLAMA_URL=${OLLAMA_BASE_URL:-"http://localhost:11434"}
if curl -sf "$OLLAMA_URL/api/tags" >/dev/null; then
  echo "    Ollama is up at $OLLAMA_URL"
else
  echo "[WARN] Ollama not reachable at $OLLAMA_URL. Install from https://ollama.ai and run 'ollama serve'"
fi

echo "==> Environment checks"
missing=()
[ -z "${OPENAI_API_KEY:-}" ] && missing+=(OPENAI_API_KEY)
[ -z "${ANTHROPIC_API_KEY:-}" ] && missing+=(ANTHROPIC_API_KEY)
[ -z "${GOOGLE_AI_API_KEY:-}" ] && missing+=(GOOGLE_AI_API_KEY)
if [ ${#missing[@]} -gt 0 ]; then
  echo "[INFO] Missing provider env vars: ${missing[*]} (you can still use Ollama locally)."
fi

echo "==> Done. Start dev with: npm run dev"


