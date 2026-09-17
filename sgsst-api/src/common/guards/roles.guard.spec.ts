import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function contextWithRole(role?: string) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  };
}

describe('RolesGuard', () => {
  it('allows requests when route has no role metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(contextWithRole('EMPLOYEE') as never)).toBe(true);
  });

  it('allows users with an allowed role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN', 'SST']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(contextWithRole('SST') as never)).toBe(true);
  });

  it('blocks users without an allowed role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() => guard.canActivate(contextWithRole('SST') as never)).toThrow(
      ForbiddenException,
    );
  });
});
