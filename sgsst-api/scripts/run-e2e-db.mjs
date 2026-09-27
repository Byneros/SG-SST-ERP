#!/usr/bin/env node
/**
 * Runner del e2e de integracion con PostgreSQL real.
 *
 * Levanta un postgres efimero con docker (puerto 5433), aplica migraciones,
 * corre Jest con la config test/jest-e2e-db.json y siempre limpia el contenedor.
 *
 * Uso: npm run test:e2e:db            (requiere docker disponible)
 */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const CONTAINER = `sgsst-e2e-db-${randomUUID().slice(0, 8)}`;
// Puerto elegible: 5433 suele estar tomado por el Postgres del compose local.
const PORT = process.env.E2E_DB_PORT ?? '5439';
const POSTGRES_PASSWORD = process.env.E2E_DB_PASSWORD ?? 'e2epass';
const DATABASE_URL = `postgresql://postgres:${POSTGRES_PASSWORD}@localhost:${PORT}/sgsst_test`;

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with code ${result.status}`);
  }
}

function cleanup() {
  try {
    spawnSync('docker', ['rm', '-f', CONTAINER], {
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
  } catch {
    // best effort
  }
}

function main() {
  run('docker', [
    'run', '--name', CONTAINER, '-e', `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
    '-e', 'POSTGRES_DB=sgsst_test', '-p', `${PORT}:5432`,
    '-d', 'postgres:16-alpine',
  ]);

  // Esperar a que postgres acepte conexiones (pg_isready dentro del contenedor).
  let ready = false;
  for (let i = 0; i < 30; i += 1) {
    const probe = spawnSync('docker', [
      'exec', CONTAINER, 'pg_isready', '-U', 'postgres', '-d', 'sgsst_test',
    ], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (probe.status === 0) { ready = true; break; }
    // Pausa portable entre intentos (1s) sin depender de `sleep` en Windows.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  if (!ready) {
    throw new Error('Postgres E2E container did not become ready in time');
  }

  // Un puerto ocupado hace que docker run falle; si el contenedor no responde
  // en el host, pg_isready interno ya lo detecto arriba.
  run('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL },
  });

  // Jest/PrismaService leen la URL via dotenv (env.ts); DOTENV_CONFIG_PATH
  // apunta al .env alternativo con la BD de pruebas. Las colas BullMQ quedan
  // apagadas: este e2e valida Prisma/HTTP, no workers; --forceExit evita que
  // handles residuales de Prisma cuelguen el proceso.
  const jest = spawnSync(
    'npx',
    [
      'jest', '--config', './test/jest-e2e-db.json', '--runInBand', '--forceExit',
      '--testTimeout=15000',
      ...process.argv.slice(2),
    ],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        DATABASE_URL,
        DOTENV_CONFIG_PATH: 'test/.env.e2e-db',
        NODE_ENV: 'test',
        NOTIFICATIONS_QUEUE_ENABLED: 'false',
        NOTIFICATIONS_WORKER_ENABLED: 'false',
        REPORTS_QUEUE_ENABLED: 'false',
        REPORTS_WORKER_ENABLED: 'false',
      },
    },
  );

  cleanup();
  process.exitCode = jest.status ?? 1;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  cleanup();
  process.exit(1);
}
