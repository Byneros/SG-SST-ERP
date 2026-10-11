import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import type IORedis from 'ioredis';
import { PrismaService } from './database/prisma.service';
import { AppService } from './app.service';

type RedisHealthClient = Pick<IORedis, 'connect' | 'ping' | 'disconnect'>;

class TestAppService extends AppService {
  constructor(
    prisma: PrismaService,
    private readonly redisClient: RedisHealthClient,
  ) {
    super(prisma);
  }

  protected override createRedisHealthClient(): RedisHealthClient {
    return this.redisClient;
  }
}

function createRedisClient(ping: 'PONG' | Error): RedisHealthClient {
  return {
    connect: jest.fn(() => Promise.resolve('ready')),
    ping: jest.fn(() => {
      if (ping instanceof Error) {
        return Promise.reject(ping);
      }
      return Promise.resolve(ping);
    }),
    disconnect: jest.fn(),
  } as unknown as RedisHealthClient;
}

describe('AppService', () => {
  it('reports readiness when PostgreSQL and Redis are available', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn(() => Promise.resolve([{ '?column?': 1 }])),
    } as unknown as PrismaService;
    const redis = createRedisClient('PONG');
    const service = new TestAppService(prisma, redis);

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: 'ok',
      dependencies: { database: 'ok', redis: 'ok' },
    });
    expect(redis.disconnect).toHaveBeenCalledTimes(1);
  });

  it('rejects readiness when a dependency is unavailable', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn(() =>
        Promise.reject(new Error('database unavailable')),
      ),
    } as unknown as PrismaService;
    const redis = createRedisClient('PONG');
    const service = new TestAppService(prisma, redis);

    await expect(service.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(redis.disconnect).toHaveBeenCalledTimes(1);
  });

  it('retries one transient PostgreSQL health-check failure', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockRejectedValueOnce(new Error('client is already executing a query'))
        .mockResolvedValueOnce([{ '?column?': 1 }]),
    } as unknown as PrismaService;
    const redis = createRedisClient('PONG');
    const service = new TestAppService(prisma, redis);

    await expect(service.getReadiness()).resolves.toMatchObject({
      dependencies: { database: 'ok', redis: 'ok' },
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it('reports individual dependency states without throwing', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn(() => Promise.resolve([{ '?column?': 1 }])),
    } as unknown as PrismaService;
    const redis = createRedisClient(new Error('redis unavailable'));
    const service = new TestAppService(prisma, redis);

    await expect(service.getDependencyHealth()).resolves.toEqual({
      database: 'ok',
      redis: 'error',
    });
  });
});
