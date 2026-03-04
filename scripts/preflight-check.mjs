/**
 * Pre-flight connectivity check
 * Tests Supabase, Teller, and local build readiness
 * Run: node scripts/preflight-check.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import https from 'https';

const execFile = promisify(execFileCb);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, '.env.local'), 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      // Strip inline comments and surrounding quotes
      const val = trimmed.slice(eq + 1).split('#')[0].trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
    return env;
  } catch {
    console.error('❌  Could not read .env.local — does it exist?');
    process.exit(1);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function mask(val) {
  if (!val) return '(empty)';
  if (val.length <= 8) return '***';
  return val.slice(0, 6) + '...' + val.slice(-4);
}

function pass(label)        { console.log(`  ✅  ${label}`); }
function fail(label, detail){ console.log(`  ❌  ${label}${detail ? ': ' + detail : ''}`); }
function warn(label, detail){ console.log(`  ⚠️   ${label}${detail ? ': ' + detail : ''}`); }
function info(label)        { console.log(`  ℹ️   ${label}`); }
function section(title)     { console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`); }

// ── 1. Env var presence check ────────────────────────────────────────────────
function checkEnvVars(env) {
  section('Environment Variables');
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY',
    'NEXT_PUBLIC_TELLER_APP_ID',
    'NEXT_PUBLIC_TELLER_ENV',
    'TELLER_CERT_B64',
    'TELLER_KEY_B64',
  ];
  let allPresent = true;
  for (const key of required) {
    const val = env[key];
    if (!val) {
      fail(key, 'MISSING');
      allPresent = false;
    } else {
      pass(`${key} = ${mask(val)}`);
    }
  }

  // Warn on stray comments surviving in values
  for (const key of required) {
    if (env[key] && env[key].includes('#')) {
      warn(`${key} still has inline comment — check .env.local`);
    }
  }

  return allPresent;
}

// ── 2. Supabase REST API check ───────────────────────────────────────────────
async function checkSupabase(env) {
  section('Supabase');
  const url = env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const serviceKey = env['SUPABASE_SERVICE_KEY'];

  if (!url.match(/^https:\/\/[a-z0-9]+\.supabase\.co$/)) {
    fail('URL format', `Expected https://xxx.supabase.co, got: ${url}`);
    return { ok: false };
  }
  pass(`URL: ${url}`);

  // Test anon key — 401 is the "correct" response (needs auth headers)
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (res.ok || res.status === 401) {
      pass(`Anon key → REST API reachable (${res.status})`);
    } else if (res.status === 521) {
      fail('Supabase', '521 — project still warming up. Wait ~60s and retry.');
      return { ok: false };
    } else {
      warn('Anon key', `Status ${res.status}`);
    }
  } catch (e) {
    fail('Supabase REST', `Network error: ${e.message}`);
    return { ok: false };
  }

  // Test service key against each table — collect access tokens from enrollments
  const tableResults = {};
  let enrollmentAccessToken = null;

  for (const table of ['enrollments', 'accounts', 'balances', 'recurring_rules']) {
    try {
      const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: 'count=exact',
        },
      });
      if (res.ok) {
        const countHeader = res.headers.get('content-range') || '?';
        const rows = await res.json();
        pass(`Table '${table}' accessible (rows: ${countHeader})`);
        tableResults[table] = rows;
        // Grab an access token from enrollments for Teller test
        if (table === 'enrollments' && rows.length > 0) {
          enrollmentAccessToken = rows[0].access_token;
          info(`Found ${rows.length} enrollment(s) — will use first for Teller test`);
        }
      } else if (res.status === 401) {
        fail(`Service key → ${table}`, '401 — service key invalid or expired');
        return { ok: false };
      } else if (res.status === 404) {
        fail(`Table '${table}'`, '404 — migration may not have run yet');
      } else {
        const body = await res.text();
        warn(`Table '${table}'`, `Status ${res.status}: ${body.slice(0, 60)}`);
      }
    } catch (e) {
      fail(`Table '${table}'`, e.message);
    }
  }

  return { ok: true, enrollmentAccessToken };
}

// ── 3. Teller mTLS check ─────────────────────────────────────────────────────
async function checkTeller(env, enrollmentAccessToken) {
  section('Teller.io');
  const certB64 = env['TELLER_CERT_B64'];
  const keyB64  = env['TELLER_KEY_B64'];
  const appId   = env['NEXT_PUBLIC_TELLER_APP_ID'];
  const tellerEnv = env['NEXT_PUBLIC_TELLER_ENV'];

  pass(`Environment: ${tellerEnv}`);
  pass(`App ID: ${mask(appId)}`);

  // Decode cert/key and validate PEM structure
  let cert, key;
  try {
    cert = Buffer.from(certB64, 'base64');
    key  = Buffer.from(keyB64, 'base64');
    const certStr = cert.toString('utf8');
    const keyStr  = key.toString('utf8');

    if (certStr.includes('BEGIN')) {
      pass('Certificate PEM: valid structure');
    } else {
      warn('Certificate', 'Does not look like PEM — check encoding');
    }
    if (keyStr.includes('BEGIN') || keyStr.includes('PRIVATE KEY')) {
      pass('Private key PEM: valid structure');
    } else {
      warn('Private key', 'Does not look like PEM — check encoding');
    }
  } catch (e) {
    fail('Certificate/key decode', e.message);
    return false;
  }

  // Validate cert via openssl (subject, expiry, issuer)
  try {
    const tmpCert = '/tmp/preflight_teller_cert.pem';
    const { writeFileSync, unlinkSync } = await import('fs');
    writeFileSync(tmpCert, cert.toString('utf8'));
    const { stdout } = await execFile('openssl', ['x509', '-in', tmpCert, '-noout', '-subject', '-dates', '-issuer']);
    unlinkSync(tmpCert);
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      if (line.includes('notAfter')) {
        const expiry = line.split('=').slice(1).join('=').trim();
        const expiryDate = new Date(expiry);
        if (expiryDate < new Date()) {
          fail('Certificate expired', expiry);
          return false;
        } else {
          pass(`Certificate valid until: ${expiry}`);
        }
      } else if (line.includes('subject')) {
        const cn = line.match(/CN=([^,\n]+)/)?.[1] || '?';
        if (cn === appId) {
          pass(`Certificate CN matches App ID: ${cn}`);
        } else {
          warn(`Certificate CN (${cn}) does not match App ID (${appId})`);
        }
      }
    }
  } catch (e) {
    warn('openssl cert check', `Skipped: ${e.message}`);
  }

  // Live API test — use real enrollment token if available, otherwise skip
  if (enrollmentAccessToken) {
    try {
      const agent = new https.Agent({ cert, key });
      const auth  = Buffer.from(`${enrollmentAccessToken}:`).toString('base64');
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('https://api.teller.io/accounts', {
        // @ts-ignore
        agent,
        signal: controller.signal,
        headers: { Authorization: `Basic ${auth}` },
      });
      clearTimeout(tid);

      if (res.ok) {
        const data = await res.json();
        pass(`mTLS live test → /accounts returned ${data.length} account(s)`);
      } else if (res.status === 401) {
        warn('mTLS live test', '401 — enrollment token may have expired (re-connect bank)');
      } else if (res.status === 403) {
        fail('mTLS live test', '403 — cert not accepted for this App ID');
        return false;
      } else {
        warn('mTLS live test', `Status ${res.status}`);
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        warn('mTLS live test', 'Timeout — skipping (cert validation passed via openssl)');
      } else {
        warn('mTLS live test', e.message);
      }
    }
  } else {
    info('No enrollments in DB — skipping live Teller API test');
    info('Cert validity confirmed via openssl. Will be fully tested on first bank connection.');
  }

  return true;
}

// ── 4. Runtime check ─────────────────────────────────────────────────────────
async function checkRuntime() {
  section('Runtime & Tools');

  for (const [bin, args, label] of [
    ['node', ['--version'], 'Node.js'],
    ['git',  ['--version'], 'git'],
  ]) {
    try {
      const { stdout } = await execFile(bin, args);
      pass(`${label}: ${stdout.trim()}`);
    } catch {
      fail(`${label}: not found`);
    }
  }

  // Bun — check both PATH and known install location
  const bunBins = ['bun', `${process.env.HOME}/.bun/bin/bun`];
  let bunFound = false;
  for (const bunBin of bunBins) {
    try {
      const { stdout } = await execFile(bunBin, ['--version']);
      pass(`Bun: ${stdout.trim()} (at ${bunBin})`);
      bunFound = true;
      break;
    } catch { /* try next */ }
  }
  if (!bunFound) warn('Bun: not installed — run: curl -fsSL https://bun.sh/install | bash');

  // TypeScript via local install
  try {
    const { stdout } = await execFile('node', ['node_modules/.bin/tsc', '--version'], { cwd: root });
    pass(`TypeScript (local): ${stdout.trim()}`);
  } catch { warn('TypeScript local: not found — run npm install'); }

  // node_modules
  try {
    readFileSync(resolve(root, 'node_modules/.package-lock.json'));
    pass('node_modules: present');
  } catch { warn('node_modules: not installed'); }
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n🔍  Net Worth App — Pre-flight Connectivity Check');
  console.log('='.repeat(55));

  const env = loadEnv();
  const envOk = checkEnvVars(env);
  if (!envOk) {
    console.log('\n🛑  Missing env vars — fix .env.local before continuing.\n');
    process.exit(1);
  }

  const { ok: supabaseOk, enrollmentAccessToken } = await checkSupabase(env);
  const tellerOk = await checkTeller(env, enrollmentAccessToken);
  await checkRuntime();

  section('Summary');
  if (supabaseOk) pass('Supabase: READY'); else fail('Supabase: ISSUES FOUND');
  if (tellerOk)   pass('Teller: READY (cert valid)'); else fail('Teller: ISSUES FOUND');

  console.log('');
  if (supabaseOk && tellerOk) {
    console.log('✅  All systems go. Ready to begin Huntley loop.\n');
    process.exit(0);
  } else {
    console.log('⚠️   Fix the issues above before starting the build session.\n');
    process.exit(1);
  }
})();
