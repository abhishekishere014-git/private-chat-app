/**
 * NEXUS Rate Limiter
 *
 * Provides in-memory sliding window rate limiting.
 * Protects against:
 * - Room creation abuse
 * - Room code brute forcing
 * - Connection flooding
 * - Message spamming
 */

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfterMs: number;
}

export class SlidingWindowRateLimiter {
  private timestamps: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
  }

  /**
   * Checks if an action is allowed for a given key and records the attempt if allowed.
   */
  public check(key: string, now: number = Date.now()): RateLimitResult {
    this.cleanup(now);

    const windowStart = now - this.windowMs;
    let list = this.timestamps.get(key) || [];

    // Filter out timestamps outside the active sliding window
    list = list.filter((ts) => ts > windowStart);

    if (list.length >= this.maxRequests) {
      const oldest = list[0];
      const resetTime = oldest + this.windowMs;
      const retryAfterMs = Math.max(0, resetTime - now);

      this.timestamps.set(key, list);
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfterMs,
      };
    }

    // Record request
    list.push(now);
    this.timestamps.set(key, list);

    const remaining = this.maxRequests - list.length;
    const resetTime = list[0] + this.windowMs;

    return {
      allowed: true,
      remaining,
      resetTime,
      retryAfterMs: 0,
    };
  }

  /**
   * Resets rate limit for a given key.
   */
  public reset(key: string): void {
    this.timestamps.delete(key);
  }

  /**
   * Clears all stored rate limit records.
   */
  public resetAll(): void {
    this.timestamps.clear();
  }

  /**
   * Periodic pruning of inactive keys to prevent memory leaks.
   */
  private cleanup(now: number): void {
    if (this.timestamps.size > 2000) {
      const windowStart = now - this.windowMs;
      for (const [k, list] of this.timestamps.entries()) {
        const fresh = list.filter((ts) => ts > windowStart);
        if (fresh.length === 0) {
          this.timestamps.delete(k);
        } else {
          this.timestamps.set(k, fresh);
        }
      }
    }
  }
}

// Global preconfigured rate limiters for server endpoints
export const roomCreationLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,     // 10 room creations per minute per IP
});

export const joinAttemptLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,     // 20 attempts per minute per IP
});

export const messageLimiter = new SlidingWindowRateLimiter({
  windowMs: 10 * 1000, // 10 seconds
  maxRequests: 30,     // 30 messages per 10s per participant
});
