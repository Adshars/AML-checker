import * as fs from 'fs';
import { CREDENTIALS_PATH, Credentials } from '../constants/auth';

export function loadCredentials(): Credentials {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Credentials file not found at ${CREDENTIALS_PATH}.\n` +
      'Run global setup first: npm run test:e2e'
    );
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8')) as Credentials;
}
