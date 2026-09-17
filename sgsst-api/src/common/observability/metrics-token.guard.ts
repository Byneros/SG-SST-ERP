import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { env } from '../../config/env';

@Injectable()
export class MetricsTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.header('x-metrics-token');

    if (!token || !env.metricsToken || !this.matches(token, env.metricsToken)) {
      throw new ForbiddenException('Metrics access denied');
    }

    return true;
  }

  private matches(token: string, expected: string) {
    const provided = Buffer.from(token);
    const configured = Buffer.from(expected);

    return (
      provided.length === configured.length &&
      timingSafeEqual(provided, configured)
    );
  }
}
