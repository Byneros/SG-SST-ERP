import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class RequestObservabilityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestObservabilityMiddleware.name);

  constructor(private readonly metricsService: MetricsService) {}

  use(request: Request, response: Response, next: NextFunction) {
    const requestId = this.resolveRequestId(request.header('x-request-id'));
    const startedAt = process.hrtime.bigint();

    response.setHeader('X-Request-Id', requestId);
    response.once('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const path = request.path || '/';
      const statusCode = response.statusCode;

      this.metricsService.recordHttpRequest(
        request.method,
        statusCode,
        durationMs,
      );
      this.logger.log(
        JSON.stringify({
          event: 'http_request',
          requestId,
          method: request.method,
          path,
          statusCode,
          durationMs: Number(durationMs.toFixed(3)),
        }),
      );
    });

    next();
  }

  private resolveRequestId(value: string | undefined) {
    return value && /^[A-Za-z0-9._-]{1,128}$/.test(value)
      ? value
      : randomUUID();
  }
}
