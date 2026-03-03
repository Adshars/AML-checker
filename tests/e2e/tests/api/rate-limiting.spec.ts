import { test, expect, request } from '@playwright/test';
import { loadCredentials } from '../../utils/credentials';

// E2E_GATEWAY_URL is populated by playwright.config.ts's dotenv.config — no need to re-load here
const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://localhost:8080';

test.describe('API — authentication and access control', () => {
  test('RL-01: /health endpoint is reachable without auth', async () => {
    const ctx = await request.newContext({ baseURL: GATEWAY });
    const res = await ctx.get('/health');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('UP');
    await ctx.dispose();
  });

  test('RL-02: /sanctions/check without auth returns 401', async () => {
    const ctx = await request.newContext({ baseURL: GATEWAY });
    const res = await ctx.get('/sanctions/check', { params: { name: 'test' } });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test('RL-03: valid JWT Bearer token allows /sanctions/check', async () => {
    // Uses the pre-fetched adminToken from global-setup instead of calling /auth/login.
    // This avoids hitting the authLimiter (max 20/15 min) and avoids coupling with DK-03
    // (which resets the apiSecret but does not affect JWT tokens).
    const creds = loadCredentials();
    const ctx = await request.newContext({ baseURL: GATEWAY });
    const res = await ctx.get('/sanctions/check', {
      params: { name: 'test' },
      headers: { Authorization: `Bearer ${creds.adminToken}` },
    });
    expect(res.status()).toBe(200);
    await ctx.dispose();
  });

  test('RL-04: valid API key with wrong secret returns 401', async () => {
    const creds = loadCredentials();
    const ctx = await request.newContext({ baseURL: GATEWAY });
    const res = await ctx.get('/sanctions/check', {
      params: { name: 'test' },
      headers: {
        'x-api-key': creds.apiKey,
        'x-api-secret': 'completelywrongsecret',
      },
    });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test('RL-05: auth endpoint responses include RateLimit standard headers', async () => {
    // Gateway uses express-rate-limit v8 with standardHeaders: true, legacyHeaders: false
    // -> headers are RateLimit-Limit / RateLimit-Remaining (lowercase in Playwright)
    const ctx = await request.newContext({ baseURL: GATEWAY });
    const res = await ctx.post('/auth/login', {
      data: { email: 'ratelimit-probe@test.local', password: 'wrongpassword' },
    });
    const headers = res.headers();
    expect(
      'ratelimit-limit' in headers || 'ratelimit-remaining' in headers,
    ).toBe(true);
    await ctx.dispose();
  });
});
