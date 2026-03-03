import * as fs from 'fs';
import { CREDENTIALS_PATH } from './constants/auth';

export default async function globalTeardown(): Promise<void> {
  // Remove credentials file — contains apiKey + apiSecret in plaintext
  if (fs.existsSync(CREDENTIALS_PATH)) {
    fs.unlinkSync(CREDENTIALS_PATH);
    console.log('[global-teardown] credentials.json removed.');
  }
}
