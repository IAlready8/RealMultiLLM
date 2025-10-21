/**
 * 3-STEP PLAN:
 * 1) Run concurrent fetches against an endpoint
 * 2) Measure durations and compute stats
 * 3) Keep deps zero; Node18+ only
 * Optimization: shared agent; minimal allocations
 * Scalability: adapt to LLM streaming endpoints as needed
 * // ✅
 */
const url = process.argv[2] || 'http://localhost:3000/api/health';
const concurrency = Number(process.argv[3] || 5);
const total = Number(process.argv[4] || 50);

async function runOnce() {
  const t0 = performance.now();
  const res = await fetch(url, { method: 'GET' });
  await res.text(); // drain
  const t1 = performance.now();
  return (t1 - t0) / 1000;
}

async function main() {
  const durations = [];
  const workers = Array.from({ length: concurrency }, async () => {
    for (let i = 0; i < Math.ceil(total / concurrency); i++) {
      durations.push(await runOnce());
    }
  });

  await Promise.all(workers);

  durations.sort((a, b) => a - b);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p95 = durations[Math.min(durations.length - 1, Math.floor(0.95 * durations.length))];

  console.log(`URL: ${url}`);
  console.log(`Requests: ${durations.length}`);
  console.log(`Average: ${avg.toFixed(4)}s`);
  console.log(`p95: ${p95.toFixed(4)}s`);
  console.log('✅ Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
