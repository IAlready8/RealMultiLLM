#!/usr/bin/env bash
# 3-STEP PLAN:
# 1) Hit an endpoint N times concurrently
# 2) Capture per-request total time via curl
# 3) Aggregate mean/p95 to identify barriers
# Optimization: pure bash + curl, no extra deps
# Scalability: parameterize concurrency/iterations
# // ✅
set -euo pipefail

URL="${1:-http://localhost:3000/api/health}"
CONCURRENCY="${2:-5}"
ITERATIONS="${3:-50}"

echo "Profiling ${URL} with ${CONCURRENCY} concurrency, ${ITERATIONS} requests..."

tmpfile="$(mktemp)"
trap 'rm -f "${tmpfile}"' EXIT

seq "${ITERATIONS}" | xargs -I{} -P "${CONCURRENCY}" bash -c \
  'TIME_TOTAL=$(curl -s -o /dev/null -w "%{time_total}" "'"${URL}"'"); echo "${TIME_TOTAL}"' \
  > "${tmpfile}"

COUNT=$(wc -l < "${tmpfile}")
SUM=$(awk '{s+=$1} END {print s}' "${tmpfile}")
AVG=$(awk -v sum="${SUM}" -v count="${COUNT}" 'BEGIN {print (count>0?sum/count:0)}')

# p95
P95=$(sort -n "${tmpfile}" | awk 'BEGIN{c=0} {a[c++]=$1} END{idx=int(0.95*c); if(idx>=c) idx=c-1; print a[idx]}')

echo "Requests: ${COUNT}"
echo "Average:  ${AVG}s"
echo "p95:      ${P95}s"
echo "✅ Done."
