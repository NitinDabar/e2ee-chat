const seen = new Map();
const TTL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of seen.entries()) {
    if (now - v > TTL_MS) seen.delete(k);
  }
}, 60 * 1000);

export function replayGuard(req, res, next) {
  // In development, allow requests without headers to pass through
  // This helps with debugging and initial setup
  const isDev = process.env.NODE_ENV !== "production";
  
  const reqId = req.header("X-Request-Id");
  const ts = Number(req.header("X-Timestamp"));
  
  // If headers are missing in dev, just continue (still check if present)
  if (!reqId || !ts || Number.isNaN(ts)) {
    if (isDev) {
      return next(); // Allow in development
    }
    return res.status(400).json({ error: "Missing X-Request-Id or X-Timestamp" });
  }
  
  const now = Date.now();
  if (Math.abs(now - ts) > TTL_MS) {
    if (isDev) {
      console.warn("Replay guard: Stale timestamp detected, but allowing in dev mode");
      return next(); // Allow in development
    }
    return res.status(400).json({ error: "Stale or future timestamp" });
  }
  
  if (seen.has(reqId)) {
    if (isDev) {
      console.warn("Replay guard: Replay detected, but allowing in dev mode");
      return next(); // Allow in development
    }
    return res.status(409).json({ error: "Replay detected" });
  }
  
  seen.set(reqId, now);
  next();
}


