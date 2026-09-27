import { DEFAULT_SERVICES, normalizeServices } from '../constants/services';

export const TOKEN_UPDATED_EVENT = 'auth:token-updated';

/**
 * Decode the JWT payload without verifying the signature (the gateway verifies it).
 * @param {string} token
 * @returns {Object|null} payload or null for a malformed token
 */
export const decodeJwtPayload = (token) => {
  if (typeof token !== 'string') return null;

  try {
    const [, payloadPart] = token.split('.');
    if (!payloadPart) return null;

    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    // atob returns a binary string; decode it as UTF-8 (organization names may contain diacritics)
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));

    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
};

/**
 * Organization services from the access token; defaults for old or malformed tokens.
 * @param {string} token
 */
export const getServicesFromToken = (token) => {
  const payload = decodeJwtPayload(token);
  return payload ? normalizeServices(payload.services) : { ...DEFAULT_SERVICES };
};

/**
 * Notify listeners (AuthContext) that the stored access token has changed.
 */
export const notifyTokenUpdated = () => {
  window.dispatchEvent(new Event(TOKEN_UPDATED_EVENT));
};
