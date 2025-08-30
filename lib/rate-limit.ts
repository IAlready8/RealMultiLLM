type Key = string

interface LimitConfig {
  windowMs: number
  max: number
}

// Simple in-memory sliding window limiter (dev/default)
const hits = new Map<Key, number[]>()

function now() {
  return Date.now()
}

export function checkAndConsume(key: Key, cfg: LimitConfig) {
  const t = now()
  const windowStart = t - cfg.windowMs
  const arr = hits.get(key) || []
  const recent = arr.filter((ts) => ts > windowStart)
  if (recent.length >= cfg.max) {
    const retryAfterMs = cfg.windowMs - (t - recent[0])
    return { allowed: false as const, remaining: Math.max(0, cfg.max - recent.length), retryAfterMs }
  }
  recent.push(t)
  hits.set(key, recent)
  return { allowed: true as const, remaining: Math.max(0, cfg.max - recent.length), retryAfterMs: 0 }
}

export function resetAll() {
  hits.clear()
}

