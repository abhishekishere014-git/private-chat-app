import { describe, it, expect } from 'vitest';
import { SlidingWindowRateLimiter } from '../worker/rate-limit.ts';

describe('Sliding Window Rate Limiter', () => {
  it('allows requests within normal threshold', () => {
    const limiter = new SlidingWindowRateLimiter({
      windowMs: 1000,
      maxRequests: 5,
    });

    const ip = '192.168.1.100';
    for (let i = 0; i < 5; i++) {
      const result = limiter.check(ip, 1000 + i * 10);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5 - (i + 1));
    }
  });

  it('blocks burst requests that exceed max limit', () => {
    const limiter = new SlidingWindowRateLimiter({
      windowMs: 1000,
      maxRequests: 3,
    });

    const ip = '10.0.0.1';
    expect(limiter.check(ip, 1000).allowed).toBe(true);
    expect(limiter.check(ip, 1010).allowed).toBe(true);
    expect(limiter.check(ip, 1020).allowed).toBe(true);

    // 4th request exceeds maxRequests = 3
    const blocked = limiter.check(ip, 1030);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets window after elapsed time', () => {
    const limiter = new SlidingWindowRateLimiter({
      windowMs: 1000,
      maxRequests: 2,
    });

    const ip = '172.16.0.1';
    expect(limiter.check(ip, 1000).allowed).toBe(true);
    expect(limiter.check(ip, 1050).allowed).toBe(true);
    expect(limiter.check(ip, 1100).allowed).toBe(false);

    // Advance beyond 1000ms window
    const afterWindow = limiter.check(ip, 2100);
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remaining).toBe(1);
  });

  it('supports explicit key reset and resetAll', () => {
    const limiter = new SlidingWindowRateLimiter({
      windowMs: 5000,
      maxRequests: 1,
    });

    const ip1 = '1.1.1.1';
    const ip2 = '2.2.2.2';

    expect(limiter.check(ip1).allowed).toBe(true);
    expect(limiter.check(ip1).allowed).toBe(false);

    limiter.reset(ip1);
    expect(limiter.check(ip1).allowed).toBe(true);

    expect(limiter.check(ip2).allowed).toBe(true);
    expect(limiter.check(ip2).allowed).toBe(false);

    limiter.resetAll();
    expect(limiter.check(ip2).allowed).toBe(true);
  });
});
