import {
  HttpException,
  HttpStatus,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import IORedis from 'ioredis';
import { env } from '../../config/env';

const buckets = new Map<string, { count: number; resetAt: number }>();
let redis: IORedis | undefined;
let redisDisabled = false;

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  async use(request: Request, response: Response, next: NextFunction) {
    const key = this.resolveKey(request);

    try {
      if (!redisDisabled) {
        const count = await this.incrementRedisBucket(key);
        this.setHeaders(response, count);
        if (count > env.rateLimitMaxRequests) {
          this.reject();
        }
        next();
        return;
      }
    } catch {
      redisDisabled = true;
    }

    const count = this.incrementMemoryBucket(key);
    this.setHeaders(response, count);
    if (count > env.rateLimitMaxRequests) {
      this.reject();
    }
    next();
  }

  private async incrementRedisBucket(key: string) {
    redis = redis ?? new IORedis(env.redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    if (redis.status === 'wait') {
      await redis.connect();
    }

    const redisKey = `rate-limit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, env.rateLimitWindowMs);
    }
    return count;
  }

  private incrementMemoryBucket(key: string) {
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + env.rateLimitWindowMs });
      return 1;
    }

    bucket.count += 1;
    return bucket.count;
  }

  private setHeaders(response: Response, count: number) {
    response.setHeader('X-RateLimit-Limit', env.rateLimitMaxRequests);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, env.rateLimitMaxRequests - count));
  }

  private reject(): never {
    throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
  }

  private resolveKey(request: Request) {
    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }
}
