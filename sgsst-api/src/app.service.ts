import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import IORedis from 'ioredis';
import { env } from './config/env';
import { PrismaService } from './database/prisma.service';

export type HealthResponse = {
  status: 'ok';
  service: string;
  environment: string;
  timestamp: string;
};

export type ReadinessResponse = HealthResponse & {
  dependencies: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
  };
};

type RedisHealthClient = Pick<IORedis, 'connect' | 'ping' | 'disconnect'>;

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'sgsst-api',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    const response: ReadinessResponse = {
      ...this.getHealth(),
      dependencies: { database, redis },
    };

    if (database === 'error' || redis === 'error') {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }

  protected createRedisHealthClient(): RedisHealthClient {
    return new IORedis(env.redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      retryStrategy: () => null,
    });
  }

  private async checkDatabase(): Promise<'ok' | 'error'> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<'ok' | 'error'> {
    const redis = this.createRedisHealthClient();

    try {
      await redis.connect();
      return (await redis.ping()) === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    } finally {
      redis.disconnect();
    }
  }
}
