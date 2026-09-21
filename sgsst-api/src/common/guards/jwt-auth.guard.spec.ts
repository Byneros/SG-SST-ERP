import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextWithAuthorization(authorization?: string) {
  const request = { headers: { authorization }, user: undefined };
  return {
    request,
    context: {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    },
  };
}

describe('JwtAuthGuard', () => {
  it('attaches verified JWT payload to request user', async () => {
    const jwtService = {
      verifyAsync: jest
        .fn()
        .mockResolvedValue({ sub: 'user-1', role: 'ADMIN' }),
    };
    const guard = new JwtAuthGuard(jwtService as never);
    const { request, context } = contextWithAuthorization('Bearer token');

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token');
    expect(request.user).toEqual({
      sub: 'user-1',
      role: 'ADMIN',
      activeCompanyId: null,
    });
  });

  it('rejects missing bearer token', async () => {
    const guard = new JwtAuthGuard({ verifyAsync: jest.fn() } as never);
    const { context } = contextWithAuthorization();

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects invalid or expired token', async () => {
    const jwtService = {
      verifyAsync: jest.fn().mockRejectedValue(new Error('expired')),
    };
    const guard = new JwtAuthGuard(jwtService as never);
    const { context } = contextWithAuthorization('Bearer expired');

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
