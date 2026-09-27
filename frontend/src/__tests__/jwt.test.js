import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  decodeJwtPayload,
  getServicesFromToken,
  notifyTokenUpdated,
  TOKEN_UPDATED_EVENT,
} from '../utils/jwt';
import { makeToken, makeRawPayloadToken } from './testUtils/token';

describe('jwt utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('decodes a valid token payload (including UTF-8 characters)', () => {
    const token = makeToken({ userId: 'u1', organizationName: 'Zażółć Sp. z o.o.' });

    expect(decodeJwtPayload(token)).toEqual({ userId: 'u1', organizationName: 'Zażółć Sp. z o.o.' });
  });

  it.each([
    ['undefined', undefined],
    ['empty string', ''],
    ['no payload part', 'abc'],
    ['invalid base64 JSON', 'a.@@@.c'],
    ['non-object payload', makeRawPayloadToken('42')],
  ])('returns null for a malformed token (%s)', (_label, token) => {
    expect(decodeJwtPayload(token)).toBeNull();
  });

  it('reads services from the token', () => {
    const token = makeToken({ services: { sanctions: false, identityMode: 'FULL_AML' } });

    expect(getServicesFromToken(token)).toEqual({ sanctions: false, identityMode: 'FULL_AML' });
  });

  it('falls back to defaults for a token without services', () => {
    expect(getServicesFromToken(makeToken({ userId: 'u1' }))).toEqual({ sanctions: true, identityMode: 'NONE' });
  });

  it('falls back to defaults for a missing or malformed token', () => {
    expect(getServicesFromToken(null)).toEqual({ sanctions: true, identityMode: 'NONE' });
    expect(getServicesFromToken('garbage')).toEqual({ sanctions: true, identityMode: 'NONE' });
  });

  it('normalizes an unknown identity mode', () => {
    const token = makeToken({ services: { sanctions: true, identityMode: 'BOGUS' } });

    expect(getServicesFromToken(token)).toEqual({ sanctions: true, identityMode: 'NONE' });
  });

  it('notifyTokenUpdated dispatches the token-updated event', () => {
    const listener = vi.fn();
    window.addEventListener(TOKEN_UPDATED_EVENT, listener);

    notifyTokenUpdated();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(TOKEN_UPDATED_EVENT, listener);
  });
});
