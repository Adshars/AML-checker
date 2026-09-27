import { describe, it, expect } from 'vitest';
import { getHomeRoute } from '../utils/homeRoute';

describe('getHomeRoute', () => {
  it('sends anonymous users to /login', () => {
    expect(getHomeRoute(null, { sanctions: true, identityMode: 'NONE' })).toBe('/login');
  });

  it('sends a superadmin to /superadmin regardless of services', () => {
    expect(getHomeRoute({ role: 'superadmin' }, { sanctions: false, identityMode: 'IDENTITY' })).toBe('/superadmin');
  });

  it.each([['admin'], ['user']])('sends %s with sanctions to /dashboard', (role) => {
    expect(getHomeRoute({ role }, { sanctions: true, identityMode: 'NONE' })).toBe('/dashboard');
    expect(getHomeRoute({ role }, { sanctions: true, identityMode: 'FULL_AML' })).toBe('/dashboard');
  });

  it.each([['IDENTITY'], ['FULL_AML']])('sends a user without sanctions (%s) to /settings', (identityMode) => {
    expect(getHomeRoute({ role: 'admin' }, { sanctions: false, identityMode })).toBe('/settings');
  });

  it('treats missing services as no sanctions access', () => {
    expect(getHomeRoute({ role: 'user' }, undefined)).toBe('/settings');
  });
});
