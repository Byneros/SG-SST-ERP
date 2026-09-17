import { afterEach, describe, expect, it } from '@jest/globals';
import { assertProductionEnv, env } from './env';

const originalEnv = { ...env };

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
  });

  it('rejects the metrics token from the example environment file', () => {
    configureProductionEnv('change-me-with-a-unique-metrics-token');

    expect(assertProductionEnv).toThrow('METRICS_TOKEN must be a unique value');
  });

  it('accepts a configured metrics token', () => {
    configureProductionEnv('a-unique-metrics-token-with-at-least-32-chars');

    expect(assertProductionEnv).not.toThrow();
  });
});
