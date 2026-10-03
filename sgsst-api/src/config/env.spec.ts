import { afterEach, describe, expect, it } from '@jest/globals';
import { assertProductionEnv, env, PUBLIC_SEED_PASSWORD } from './env';

const originalEnv = { ...env };
const originalSeedPassword = process.env.SEED_ADMIN_PASSWORD;

function configureProductionEnv(metricsToken: string) {
  Object.assign(env, {
    nodeEnv: 'production',
    jwtSecret: 'a-unique-jwt-secret-with-at-least-32-chars',
    databaseUrl: 'postgresql://user:password@db.example/sgsst',
    redisUrl: 'redis://redis.example:6379',
    metricsToken,
    corsOrigins: ['https://app.example.com'],
    documentStorageDriver: 'local',
  });
}

describe('assertProductionEnv', () => {
  afterEach(() => {
    Object.assign(env, originalEnv);
    if (originalSeedPassword === undefined) {
      delete process.env.SEED_ADMIN_PASSWORD;
    } else {
      process.env.SEED_ADMIN_PASSWORD = originalSeedPassword;
    }
  });

  it('rejects the metrics token from the example environment file', () => {
    configureProductionEnv('change-me-with-a-unique-metrics-token');

    expect(assertProductionEnv).toThrow('METRICS_TOKEN must be a unique value');
  });

  it('accepts a configured metrics token and a rotated seed password', () => {
    configureProductionEnv('a-unique-metrics-token-with-at-least-32-chars');
    process.env.SEED_ADMIN_PASSWORD = 'una-contrasena-de-seed-rotada-unica';

    expect(assertProductionEnv).not.toThrow();
  });

  it('rejects the public default seed password (H-4)', () => {
    configureProductionEnv('a-unique-metrics-token-with-at-least-32-chars');
    process.env.SEED_ADMIN_PASSWORD = PUBLIC_SEED_PASSWORD;

    expect(assertProductionEnv).toThrow('SEED_ADMIN_PASSWORD must be rotated');
  });

  it('accepts a rotated seed password (H-4)', () => {
    configureProductionEnv('a-unique-metrics-token-with-at-least-32-chars');
    process.env.SEED_ADMIN_PASSWORD = 'una-contrasena-de-seed-rotada-unica';

    expect(assertProductionEnv).not.toThrow();
  });
});
