// Probe of the self-hosted idswyft instance on real (or synthetic) images.
//
// Runs the full identity flow directly against idswyft-api on 127.0.0.1:
//   initialize (verification_mode: identity) → front-document → live-capture → status
// and prints timings plus responses with personal data MASKED (text values → first
// letter + "***", dates → "YYYY-**-**", face embeddings → "[N numbers]").
//
// Usage:
//   npm run idv:probe -- <document.jpg> <selfie.jpg> [options]
//
// Options:
//   --save-fixtures   save masked responses to idv-service/tests/fixtures/idswyft/
//   --expect-reject   the document is expected to be rejected (saves front-document-rejected.json)
//   --type <t>        document_type: auto (default) | national_id | passport | drivers_license
//   --country <CC>    issuing_country, 2-letter ISO code (e.g. PL)
//
// Requires IDSWYFT_API_KEY in .env (from `npm run idv:bootstrap`).

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const envFile = path.join(ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const BASE_URL = `http://127.0.0.1:${process.env.IDSWYFT_API_PORT || 3010}/api/v2/verify`;
const FIXTURES_DIR = path.join(ROOT, 'idv-service', 'tests', 'fixtures', 'idswyft');
const REQUEST_TIMEOUT_MS = 180_000;

// ---------- arguments ----------

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg === '--save-fixtures' || arg === '--expect-reject'));
function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
const optionValues = new Set([option('--type'), option('--country')].filter(Boolean));
const files = args.filter((arg) => !arg.startsWith('--') && !optionValues.has(arg));
const saveFixtures = flags.has('--save-fixtures');
const expectReject = flags.has('--expect-reject');
const documentType = option('--type') || 'auto';
const issuingCountry = option('--country');

if (files.length < 1 || (!expectReject && files.length < 2)) {
  console.error('Usage: npm run idv:probe -- <document.jpg> <selfie.jpg> [--save-fixtures] [--expect-reject] [--type auto] [--country PL]');
  process.exit(1);
}
const [documentPath, selfiePath] = files;
for (const file of [documentPath, selfiePath].filter(Boolean)) {
  if (!existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }
}

const apiKey = process.env.IDSWYFT_API_KEY;
if (!apiKey) {
  console.error('IDSWYFT_API_KEY is not set — run `npm run idv:bootstrap` and add the key to .env.');
  process.exit(1);
}

// ---------- masking ----------

// Containers whose every text value is personal data
const PII_CONTAINERS = new Set([
  'ocr_data', 'barcode_data', 'cross_validation_results', 'geo_analysis',
  'age_verification', 'age_estimation', 'qr_payload', 'mrz', 'raw_text',
]);
// Keys that hold personal data wherever they appear (matched on key parts: full_name → full, name)
const PII_KEY_PARTS = new Set([
  'name', 'names', 'surname', 'given', 'birth', 'dob', 'number', 'address', 'pesel', 'personal',
  'mrz', 'raw', 'text', 'nationality', 'sex', 'gender', 'place', 'parents', 'ip', 'email', 'phone',
]);
const keyParts = (key) => key.split(/[_\-.\s]|(?=[A-Z])/).map((part) => part.toLowerCase());
const isPiiKey = (key) => keyParts(key).some((part) => PII_KEY_PARTS.has(part));
// Session tokens, links with tokens and secrets are never printed
const SECRET_KEY_PARTS = new Set(['token', 'url', 'secret', 'key', 'session']);
const isSecretKey = (key) => keyParts(key).some((part) => SECRET_KEY_PARTS.has(part));
const SAFE_KEYS = new Set([
  'verification_id', 'user_id', 'document_id', 'status', 'current_step', 'total_steps',
  'final_result', 'rejection_reason', 'verification_mode', 'message', 'created_at', 'updated_at',
]);

function maskString(value) {
  const isoDate = value.match(/^(\d{4})-\d{2}-\d{2}/);
  if (isoDate) return `${isoDate[1]}-**-**`;
  const euDate = value.match(/^\d{2}[./-]\d{2}[./-](\d{4})$/);
  if (euDate) return `**.**.${euDate[1]}`;
  return value.length === 0 ? value : `${value[0]}***`;
}

function mask(value, key = '', insidePii = false) {
  if (Array.isArray(value)) {
    if (value.length > 16 && value.every((item) => typeof item === 'number')) return `[${value.length} numbers]`;
    return value.map((item) => mask(item, key, insidePii));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [childKey, child] of Object.entries(value)) {
      out[childKey] = mask(child, childKey, insidePii || PII_CONTAINERS.has(childKey));
    }
    return out;
  }
  if (typeof value === 'string' && isSecretKey(key)) return '<redacted>';
  const sensitive = !SAFE_KEYS.has(key) && (insidePii || isPiiKey(key));
  if (!sensitive) return value;
  if (typeof value === 'string') return maskString(value);
  if (typeof value === 'number' && isPiiKey(key)) return '#***';
  return value;
}

// ---------- HTTP ----------

function fileBlob(file) {
  const mime = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
  return new Blob([readFileSync(file)], { type: mime });
}

async function call(step, method, url, { json, form } = {}) {
  const headers = { 'X-API-Key': apiKey };
  if (method === 'POST') headers['Idempotency-Key'] = `probe-${randomUUID()}`;
  let body;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const started = Date.now();
  let response;
  try {
    response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    throw new Error(`[${step}] request failed after ${Date.now() - started} ms: ${error.cause?.code || error.name}`);
  }
  const ms = Date.now() - started;
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { non_json_response: `${text.length} bytes` };
  }
  const masked = mask(data);
  console.log(`\n=== ${step}: HTTP ${response.status} in ${ms} ms`);
  console.log(JSON.stringify(masked, null, 2));
  return { status: response.status, ok: response.ok, data, masked, ms };
}

function saveFixture(name, masked) {
  if (!saveFixtures) return;
  mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(path.join(FIXTURES_DIR, name), `${JSON.stringify(masked, null, 2)}\n`);
  console.log(`(saved fixture ${path.relative(ROOT, path.join(FIXTURES_DIR, name))})`);
}

// ---------- flow ----------

const timings = {};

// process.exit() right after fetch() trips a libuv assertion on Windows — return exit codes instead.
async function main() {

  const init = await call('initialize', 'POST', `${BASE_URL}/initialize`, {
    json: {
      user_id: randomUUID(),
      verification_mode: 'identity',
      document_type: documentType,
      ...(issuingCountry && { issuing_country: issuingCountry }),
    },
  });
  timings.initialize = init.ms;
  if (!init.ok || !init.data.verification_id) {
    console.error('\ninitialize failed — see the response above.');
    return 1;
  }
  saveFixture('initialize.json', init.masked);
  const verificationId = init.data.verification_id;

  const documentForm = new FormData();
  documentForm.append('document', fileBlob(documentPath), path.basename(documentPath));
  documentForm.append('document_type', documentType);
  if (issuingCountry) documentForm.append('issuing_country', issuingCountry);
  const front = await call('front-document', 'POST', `${BASE_URL}/${verificationId}/front-document`, { form: documentForm });
  timings.frontDocument = front.ms;

  const frontRejected = !front.ok || front.data.final_result === 'failed' || Boolean(front.data.rejection_reason);
  if (expectReject) {
    saveFixture('front-document-rejected.json', front.masked);
    const statusAfterReject = await call('status (after rejection)', 'GET', `${BASE_URL}/${verificationId}/status`);
    saveFixture('status-rejected.json', statusAfterReject.masked);
    console.log(frontRejected
      ? '\nOK: the document was rejected as expected.'
      : '\nWARNING: --expect-reject was set, but the document was accepted.');
    printSummary();
    return frontRejected ? 0 : 2;
  }
  if (frontRejected) {
    saveFixture('front-document-rejected.json', front.masked);
    console.error('\nThe document was rejected — see rejection_reason above. Use a sharper photo or --expect-reject.');
    printSummary();
    return 2;
  }
  saveFixture('front-document.json', front.masked);

  const selfieForm = new FormData();
  selfieForm.append('selfie', fileBlob(selfiePath), path.basename(selfiePath));
  const live = await call('live-capture', 'POST', `${BASE_URL}/${verificationId}/live-capture`, { form: selfieForm });
  timings.liveCapture = live.ms;
  saveFixture(live.ok ? 'live-capture.json' : 'live-capture-rejected.json', live.masked);

  // The result is normally final right after live-capture; poll briefly in case it is not.
  let status;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    status = await call(`status (#${attempt})`, 'GET', `${BASE_URL}/${verificationId}/status`);
    if (!status.ok || status.data.final_result) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  timings.status = status.ms;
  saveFixture('status.json', status.masked);
  printSummary(status.data);
  return 0;
}

function printSummary(result) {
  console.log('\n=== Summary');
  console.log(`timings (ms): ${JSON.stringify(timings)}`);
  if (!result) return;
  const ocr = result.ocr_data || {};
  console.log(`final_result: ${result.final_result}`);
  console.log(`rejection_reason: ${result.rejection_reason ?? '-'} | manual_review_reason: ${result.manual_review_reason ?? '-'}`);
  console.log(`liveness_passed: ${result.liveness_passed} | face_match_passed: ${result.face_match_passed}`);
  console.log(`OCR fields present: ${Object.keys(ocr).filter((key) => ocr[key] !== null && ocr[key] !== '').join(', ') || '(none)'}`);
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`
${error.message}`);
  process.exitCode = 1;
}
