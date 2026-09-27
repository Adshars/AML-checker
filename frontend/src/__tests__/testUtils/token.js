// Unsigned JWT-shaped token for tests (the frontend never verifies signatures)
const base64Url = (text) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const makeToken = (payload) => `eyJhbGciOiJIUzI1NiJ9.${base64Url(JSON.stringify(payload))}.signature`;

export const makeRawPayloadToken = (rawPayload) => `eyJhbGciOiJIUzI1NiJ9.${base64Url(rawPayload)}.signature`;
