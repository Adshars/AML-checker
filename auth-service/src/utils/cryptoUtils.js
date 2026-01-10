import crypto from 'crypto';

export const generateKey = (size = 32) => crypto.randomBytes(size).toString('hex');