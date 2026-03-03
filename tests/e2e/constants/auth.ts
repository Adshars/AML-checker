import * as path from 'path';

export const AUTH_DIR = path.join(__dirname, '../setup/.auth');
export const SUPERADMIN_STATE = path.join(AUTH_DIR, 'superadmin.json');
export const ADMIN_STATE = path.join(AUTH_DIR, 'admin.json');
export const USER_STATE = path.join(AUTH_DIR, 'user.json');
export const CREDENTIALS_PATH = path.join(AUTH_DIR, 'credentials.json');

export interface Credentials {
  superadmin: { email: string; password: string };
  admin: { email: string; password: string; orgId: string };
  user: { email: string; password: string };
  apiKey: string;
  apiSecret: string;
  /** Access token obtained during global-setup (valid ~15 min). Use to avoid extra
   *  /auth/login calls inside tests, which would hit the authLimiter (max 20/15 min). */
  adminToken: string;
}
