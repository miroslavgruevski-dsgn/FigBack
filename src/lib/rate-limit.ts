const windowMs = 60 * 1000;
const maxRequests = 20;

const windows = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const window = windows.get(key);

  if (!window || now > window.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (window.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  window.count++;
  return { allowed: true, remaining: maxRequests - window.count };
}
