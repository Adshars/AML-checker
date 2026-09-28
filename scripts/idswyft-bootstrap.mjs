// One-time bootstrap of the self-hosted idswyft instance.
//
// Creates the owner developer account (first-run setup, no OTP) and prints its API key
// once. The key is NOT saved anywhere — paste it into .env as IDSWYFT_API_KEY.
//
// Usage (idswyft containers must be running):
//   docker compose up -d idswyft-postgres idswyft-engine idswyft-api
//   npm run idv:bootstrap
//
// Optional env: IDSWYFT_API_PORT (default 3010), IDSWYFT_ADMIN_EMAIL.

import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const envFile = path.join(ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const BASE_URL = `http://127.0.0.1:${process.env.IDSWYFT_API_PORT || 3010}`;

async function request(method, urlPath, body) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${urlPath}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    console.error(`Cannot reach idswyft API at ${BASE_URL} (${error.cause?.code || error.message}).`);
    console.error('Start it with: docker compose up -d idswyft-postgres idswyft-engine idswyft-api');
    return null;
  }
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { status: response.status, data };
}

// process.exit() right after fetch() trips a libuv assertion on Windows — return exit codes instead.
async function main() {
  const status = await request('GET', '/api/setup/status');
  if (!status) return 1;
  if (status.status !== 200) {
    console.error(`GET /api/setup/status failed: HTTP ${status.status}`, status.data);
    return 1;
  }

  if (status.data.needs_setup === false) {
    console.log('idswyft is already initialized — use the existing API key from .env (IDSWYFT_API_KEY).');
    console.log('If the key is lost, create a new one in the idswyft developer portal or reset the idswyft volumes.');
    return 0;
  }

  const init = await request('POST', '/api/setup/initialize', {
    name: 'AML-Checker',
    email: process.env.IDSWYFT_ADMIN_EMAIL || 'admin@aml-checker.dev',
    company: 'AML-Checker',
  });

  if (!init) return 1;
  if (init.status !== 201) {
    console.error(`POST /api/setup/initialize failed: HTTP ${init.status}`, init.data);
    return 1;
  }

  const apiKey = init.data.api_key;
  if (!apiKey?.key) {
    console.error('Setup completed, but no API key was returned:', init.data.warning || 'unknown reason');
    console.error('Create a key in the idswyft developer portal.');
    return 1;
  }

  if (apiKey.is_sandbox) {
    console.error('The generated API key is a SANDBOX key (is_sandbox: true).');
    console.error('Sandbox keys are rejected when idswyft runs with NODE_ENV=production — check the idswyft-api environment.');
    return 1;
  }

  console.log('idswyft initialized. API key (shown only once):\n');
  console.log(`  ${apiKey.key}\n`);
  console.log(`is_sandbox: ${apiKey.is_sandbox}`);
  console.log('Add it to .env:');
  console.log('  IDSWYFT_API_KEY=<the key above>');
  return 0;
}

process.exitCode = await main();
