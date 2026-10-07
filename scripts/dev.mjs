import net from 'net';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env if present
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Test if a specific port is free
function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

// Find next free port starting at startPort
async function findAvailablePort(startPort, label, maxAttempts = 30) {
  let port = Number(startPort);
  for (let i = 0; i < maxAttempts; i++) {
    const available = await isPortAvailable(port);
    if (available) {
      if (i > 0) {
        console.log(`⚠️  [Port Conflict] A porta ${startPort} para ${label} estava ocupada. Usando porta alternativa livre: ${port}`);
      }
      return port;
    }
    port++;
  }
  throw new Error(`Não foi possível encontrar uma porta livre para ${label} após ${maxAttempts} tentativas a partir de ${startPort}.`);
}

async function main() {
  console.log('\n🔮 ==========================================');
  console.log('🔮 Code Palandir - Iniciando Ambiente Local');
  console.log('🔮 ==========================================\n');

  const configuredBackendPort = process.env.PORT || 8787;
  const configuredFrontendPort = process.env.VITE_PORT || 5174;

  const backendPort = await findAvailablePort(configuredBackendPort, 'Backend (API)');
  const frontendPort = await findAvailablePort(configuredFrontendPort, 'Frontend (Vite)');

  const serverBaseUrl = `http://localhost:${backendPort}`;
  const appBaseUrl = `http://localhost:${frontendPort}`;

  console.log(`📡 Backend URL:   ${serverBaseUrl}`);
  console.log(`🌐 Frontend URL:  ${appBaseUrl}\n`);

  const sharedEnv = {
    ...process.env,
    PORT: String(backendPort),
    SERVER_PORT: String(backendPort),
    SERVER_BASE_URL: serverBaseUrl,
    VITE_PORT: String(frontendPort),
    APP_BASE_URL: appBaseUrl,
  };

  const children = [];

  // Start Backend
  const backend = spawn('node', ['server/index.js'], {
    cwd: rootDir,
    env: sharedEnv,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  backend.stdout.on('data', (data) => {
    const lines = data.toString().trimEnd().split('\n');
    for (const line of lines) {
      console.log(`\x1b[36m[Backend]\x1b[0m ${line}`);
    }
  });

  backend.stderr.on('data', (data) => {
    const lines = data.toString().trimEnd().split('\n');
    for (const line of lines) {
      console.error(`\x1b[31m[Backend Error]\x1b[0m ${line}`);
    }
  });

  children.push(backend);

  // Start Vite Frontend
  const vite = spawn('npx', ['vite', '--port', String(frontendPort), '--strictPort'], {
    cwd: rootDir,
    env: sharedEnv,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  vite.stdout.on('data', (data) => {
    const lines = data.toString().trimEnd().split('\n');
    for (const line of lines) {
      console.log(`\x1b[35m[Vite]\x1b[0m ${line}`);
    }
  });

  vite.stderr.on('data', (data) => {
    const lines = data.toString().trimEnd().split('\n');
    for (const line of lines) {
      console.error(`\x1b[31m[Vite Error]\x1b[0m ${line}`);
    }
  });

  children.push(vite);

  // Clean shutdown
  const shutdown = () => {
    console.log('\n🛑 Encerrando servidores locais...');
    for (const child of children) {
      try {
        child.kill('SIGINT');
      } catch (_) {}
    }
    setTimeout(() => {
      for (const child of children) {
        try {
          child.kill('SIGKILL');
        } catch (_) {}
      }
      process.exit(0);
    }, 1500);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  backend.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Backend encerrou com código ${code}`);
    }
  });

  vite.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Vite encerrou com código ${code}`);
    }
  });
}

main().catch((err) => {
  console.error('Falha ao iniciar ambiente de desenvolvimento:', err);
  process.exit(1);
});
