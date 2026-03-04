import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = readFileSync(resolve(root, '.env.local'), 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

console.log('SUPABASE_URL (raw):', JSON.stringify(env['NEXT_PUBLIC_SUPABASE_URL']));
console.log('TELLER_ENV (raw):', JSON.stringify(env['NEXT_PUBLIC_TELLER_ENV']));
console.log('TELLER_APP_ID (raw):', JSON.stringify(env['NEXT_PUBLIC_TELLER_APP_ID']));
