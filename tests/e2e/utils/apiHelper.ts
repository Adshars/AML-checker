import { request } from '@playwright/test';

const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://localhost:8080';

/** Login via API and return accessToken */
export async function apiLogin(email: string, password: string): Promise<string> {
  const ctx = await request.newContext({ baseURL: GATEWAY });
  const res = await ctx.post('/auth/login', { data: { email, password } });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await ctx.dispose();
  return body.accessToken as string;
}

/** Register organization and return { admin, apiKey, apiSecret, orgId } */
export async function apiRegisterOrg(
  superadminToken: string,
  payload: Record<string, string>
): Promise<{ adminEmail: string; adminPassword: string; orgId: string; apiKey: string; apiSecret: string }> {
  const ctx = await request.newContext({ baseURL: GATEWAY });
  const res = await ctx.post('/auth/register-organization', {
    headers: { Authorization: `Bearer ${superadminToken}` },
    data: payload,
  });
  if (!res.ok()) throw new Error(`Register org failed: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await ctx.dispose();
  return {
    adminEmail: payload.email,
    adminPassword: payload.password,
    orgId: body.organization.id as string,
    apiKey: body.organization.apiKey as string,
    apiSecret: body.organization.apiSecret as string,
  };
}

/** Create a user via POST /users — returns the created user */
export async function apiCreateUser(
  adminToken: string,
  payload: { firstName: string; lastName: string; email: string; password: string }
): Promise<{ id: string; email: string }> {
  const ctx = await request.newContext({ baseURL: GATEWAY });
  const res = await ctx.post('/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: payload,
  });
  if (!res.ok()) throw new Error(`Create user failed: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await ctx.dispose();
  return body.user as { id: string; email: string };
}

/**
 * Seed audit log entries by firing GET /sanctions/check N times.
 * Used in history tests to ensure the table has enough rows to paginate.
 */
export async function seedSanctionsChecks(
  adminToken: string,
  count: number,
  queryPrefix = 'SeedEntity'
): Promise<void> {
  const ctx = await request.newContext({ baseURL: GATEWAY });
  for (let i = 0; i < count; i++) {
    await ctx.get(`/sanctions/check?name=${encodeURIComponent(`${queryPrefix}${i}`)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  }
  await ctx.dispose();
}
