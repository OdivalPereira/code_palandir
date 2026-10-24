#!/usr/bin/env node
import crypto from 'node:crypto';

let apelido = null;
let cliUrl = null;
const args = process.argv.slice(2);

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    cliUrl = args[++i];
  } else if (!args[i].startsWith('--')) {
    if (!apelido) apelido = args[i];
  }
}

if (!apelido) {
  console.error('Uso: node scripts/nova-maquina.mjs <apelido> [--url <url>]');
  process.exit(1);
}

const rawUrl = cliUrl || process.env.SUPABASE_URL || 'http://127.0.0.1:55321';
let parsedUrl;
try {
  parsedUrl = new URL(rawUrl);
} catch {
  console.error(`URL inválida: ${rawUrl}`);
  process.exit(1);
}

if (parsedUrl.hostname !== '127.0.0.1' && parsedUrl.hostname !== 'localhost') {
  console.error(`URL não-local recusada: apenas 127.0.0.1 e localhost são permitidos (${parsedUrl.hostname}).`);
  process.exit(1);
}

const baseUrl = parsedUrl.origin;
const credencial = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(credencial).digest('hex');

function getServiceRoleKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ iss: 'supabase-demo', role: 'service_role', exp: 1983812996 })).toString('base64url');
  const s = crypto.createHmac('sha256', 'super-secret-jwt-token-with-at-least-32-characters-long').update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

const serviceKey = getServiceRoleKey();
let donoId = process.env.PAINEL_DONO_ID;

if (!donoId) {
  const usersRes = await fetch(`${baseUrl}/auth/v1/admin/users`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  });
  if (!usersRes.ok) {
    console.error(`Falha ao consultar usuário dono: HTTP ${usersRes.status}`);
    process.exit(1);
  }
  const usersData = await usersRes.json();
  const users = usersData.users || (Array.isArray(usersData) ? usersData : []);
  const dono = users.find((u) => u.email === 'dono@exemplo.test') || users[0];
  if (!dono?.id) {
    console.error('Nenhum usuário dono encontrado.');
    process.exit(1);
  }
  donoId = dono.id;
}

const insertRes = await fetch(`${baseUrl}/rest/v1/maquinas?on_conflict=dono,apelido`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation'
  },
  body: JSON.stringify({ dono: donoId, apelido, token_hash: tokenHash })
});

if (!insertRes.ok) {
  console.error(`Falha ao registrar máquina: HTTP ${insertRes.status} - ${await insertRes.text()}`);
  process.exit(1);
}

const insertedData = await insertRes.json();
const registro = Array.isArray(insertedData) ? insertedData[0] : insertedData;

console.log('Máquina registrada com sucesso!');
console.log(`ID: ${registro?.id}`);
console.log(`Apelido: ${apelido}`);
console.log(`Token hash: ${tokenHash}`);
console.log(`Credencial: ${credencial}`);
