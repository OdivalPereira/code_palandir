#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

let cliUrl = null;
let cliToken = null;
let cliMaquina = null;
const args = process.argv.slice(2);

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    cliUrl = args[++i];
  } else if (args[i] === '--token' && args[i + 1]) {
    cliToken = args[++i];
  } else if (args[i] === '--maquina' && args[i + 1]) {
    cliMaquina = args[++i];
  }
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
const token = cliToken || process.env.PAINEL_TOKEN || 'token-teste-notebook-exemplo-local-0000';

const exemploPath = fileURLToPath(new URL('../sociedade/central/painel-1.exemplo.json', import.meta.url));
const payload = JSON.parse(await readFile(exemploPath, 'utf8'));
payload.coletado_em = new Date().toISOString();
if (cliMaquina || process.env.PAINEL_MAQUINA) {
  payload.maquina = cliMaquina || process.env.PAINEL_MAQUINA;
}

const res = await fetch(`${baseUrl}/functions/v1/ingest`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-painel-token': token
  },
  body: JSON.stringify(payload)
});

console.log(`HTTP ${res.status}`);
const resText = await res.text();
try {
  console.log(JSON.stringify(JSON.parse(resText), null, 2));
} catch {
  console.log(resText);
}

if (res.status !== 200) {
  process.exit(1);
}
