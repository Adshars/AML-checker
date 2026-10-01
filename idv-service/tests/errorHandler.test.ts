import { redactPath } from '../src/api/middlewares/errorHandler.js';

describe('Error log redaction', () => {
  test('verification link tokens are removed from logged paths', () => {
    expect(redactPath('/public/sessions/Qm9vZ2x5LXRva2Vu/document')).toBe('/public/sessions/:token/document');
    expect(redactPath('/public/sessions/Qm9vZ2x5LXRva2Vu')).toBe('/public/sessions/:token');
    expect(redactPath('/verifications/123/review')).toBe('/verifications/123/review');
  });
});
