// Docker smoke test for the AML-Checker stack.
//
// Checks that the Docker setup stays healthy: every service has a .dockerignore,
// docker-compose.yml has no obsolete `version` field, the frontend uses Compose Watch
// instead of a bind mount, all images run Node 22, and the frontend image contains
// only Linux native binaries and no files excluded by .dockerignore.
//
// Run after changing Dockerfiles, .dockerignore files or docker-compose.yml:
//   npm run test:docker              (builds the images first)
//   npm run test:docker -- --no-build
//
// Requires a running Docker Desktop and a .env file in the repo root
// (docker compose needs it to resolve variables).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BACKEND_SERVICES = ['api-gateway', 'auth-service', 'core-service', 'op-adapter'];
const SERVICES = [...BACKEND_SERVICES, 'frontend'];

let passed = 0;
let failed = 0;

function pass(description) {
  passed += 1;
  console.log(`PASS  ${description}`);
}

function fail(description, details) {
  failed += 1;
  console.log(`FAIL  ${description} — ${details}`);
}

function docker(args, options = {}) {
  const result = spawnSync('docker', args, { cwd: ROOT, encoding: 'utf8', ...options });
  if (result.error) {
    console.error(`Docker is not available: ${result.error.message}`);
    process.exit(1);
  }
  return result;
}

function runInService(service, command) {
  return docker(['compose', 'run', '--rm', '--no-deps', '-T', service, ...command]);
}

function summarize() {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Preflight: Docker CLI and daemon reachable
const info = docker(['info', '--format', '{{.ServerVersion}}']);
if (info.status !== 0 || !info.stdout.trim()) {
  console.error(`Docker is not available: ${info.stderr.trim()}`);
  process.exit(1);
}

if (!process.argv.includes('--no-build')) {
  console.log(`Building images: ${SERVICES.join(', ')}`);
  const build = docker(['compose', 'build', ...SERVICES], { stdio: 'inherit' });
  if (build.status !== 0) {
    console.error('Docker build failed');
    process.exit(1);
  }
}

// 1. .dockerignore exists in every service and excludes node_modules
for (const service of SERVICES) {
  const description = `${service}/.dockerignore exists and excludes node_modules`;
  const file = path.join(ROOT, service, '.dockerignore');
  if (!existsSync(file)) {
    fail(description, 'file not found');
    continue;
  }
  const lines = readFileSync(file, 'utf8').split('\n').map((line) => line.trim());
  if (lines.includes('node_modules')) pass(description);
  else fail(description, 'no "node_modules" line');
}

// 2. Compose config is valid and has no obsolete `version` field
let config = null;
{
  const description = 'docker compose config has no obsolete version warning';
  const result = docker(['compose', 'config', '--format', 'json']);
  if (result.status !== 0) {
    fail(description, result.stderr.trim());
  } else if (/obsolete/i.test(result.stderr)) {
    fail(description, result.stderr.trim());
  } else {
    pass(description);
  }
  try {
    config = JSON.parse(result.stdout);
  } catch {
    config = null;
  }
}

// 3. Frontend uses Compose Watch instead of a bind mount
{
  const description = 'frontend has no volumes and rebuilds on package-lock.json change';
  const frontend = config?.services?.frontend;
  const watch = frontend?.develop?.watch;
  if (!frontend) {
    fail(description, 'frontend service missing in compose config');
  } else if (frontend.volumes !== undefined && frontend.volumes.length > 0) {
    fail(description, `volumes defined: ${JSON.stringify(frontend.volumes)}`);
  } else if (!Array.isArray(watch) || watch.length === 0) {
    fail(description, 'develop.watch is missing or empty');
  } else if (!watch.some((rule) => rule.action === 'rebuild' && rule.path?.endsWith('package-lock.json'))) {
    fail(description, 'no rebuild rule for package-lock.json');
  } else {
    pass(description);
  }
}

// 4. All images run Node 22
for (const service of SERVICES) {
  const description = `${service} image runs Node 22`;
  const result = runInService(service, ['node', '-v']);
  const version = result.stdout.trim();
  if (result.status === 0 && version.startsWith('v22.')) pass(description);
  else fail(description, version || result.stderr.trim());
}

// 5. Frontend image contains only Linux native binaries (no host node_modules)
{
  const description = 'frontend node_modules has only Linux esbuild/rollup binaries';
  const result = runInService('frontend', ['ls', 'node_modules/@esbuild', 'node_modules/@rollup']);
  const output = result.stdout;
  if (result.status !== 0) fail(description, result.stderr.trim());
  else if (/win32|darwin/.test(output)) fail(description, `foreign binaries found: ${output.trim()}`);
  else if (!output.includes('linux')) fail(description, 'no linux binaries found');
  else pass(description);
}

// 6. Frontend .dockerignore is applied to the image
{
  const description = 'frontend image respects .dockerignore';
  const result = runInService('frontend', ['ls', '-A', '/app']);
  const entries = result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  const forbidden = ['Dockerfile', 'README.md', '.dockerignore', '.env', 'dist', 'coverage'];
  const required = ['src', 'node_modules', 'package.json', 'index.html'];
  const unexpected = forbidden.filter((name) => entries.includes(name));
  const missing = required.filter((name) => !entries.includes(name));
  if (result.status !== 0) fail(description, result.stderr.trim());
  else if (unexpected.length > 0) fail(description, `unexpected entries: ${unexpected.join(', ')}`);
  else if (missing.length > 0) fail(description, `missing entries: ${missing.join(', ')}`);
  else pass(description);
}

summarize();
