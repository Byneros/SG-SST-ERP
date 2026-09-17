import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { MetricsTokenGuard } from './metrics-token.guard';
import { env } from '../../config/env';

function contextWithToken(token?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ header: jest.fn(() => token) }),
    }),
  };
}

describe('MetricsTokenGuard', () => {
  it('allows the configured metrics token', () => {
    const originalToken = env.metricsToken;
    Object.assign(env, { metricsToken: 'metrics-test-token' });
    const guard = new MetricsTokenGuard();

    expect(
      guard.canActivate(contextWithToken('metrics-test-token') as never),
    ).toBe(true);

    Object.assign(env, { metricsToken: originalToken });
  });

  it('rejects missing or invalid metrics tokens', () => {
    const originalToken = env.metricsToken;
    Object.assign(env, { metricsToken: 'metrics-test-token' });
    const guard = new MetricsTokenGuard();

    expect(() => guard.canActivate(contextWithToken() as never)).toThrow(
      ForbiddenException,
    );
    expect(() =>
      guard.canActivate(contextWithToken('invalid') as never),
    ).toThrow(ForbiddenException);

    Object.assign(env, { metricsToken: originalToken });
  });
});
