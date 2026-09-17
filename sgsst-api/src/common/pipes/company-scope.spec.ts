import { ForbiddenException } from '@nestjs/common';
import { assertCompanyScope, resolveCompanyScope } from './company-scope';

describe('company scope', () => {
  const companyAUser = {
    sub: 'user-a',
    email: 'admin@company-a.test',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  it('derives the tenant from the authenticated user', () => {
    expect(resolveCompanyScope(companyAUser)).toBe('company-a');
    expect(resolveCompanyScope(companyAUser, 'company-a')).toBe('company-a');
  });

  it('rejects a client companyId outside the authenticated tenant', () => {
    expect(() => resolveCompanyScope(companyAUser, 'company-b')).toThrow(
      ForbiddenException,
    );
  });

  it('requires SUPER_ADMIN to use its active company context', () => {
    const superAdmin = {
      sub: 'super-admin',
      email: 'super@platform.test',
      role: 'SUPER_ADMIN',
      companyId: null,
      activeCompanyId: 'company-a',
    };

    expect(() => assertCompanyScope(superAdmin, 'company-b')).toThrow(
      ForbiddenException,
    );
    expect(() =>
      resolveCompanyScope({ ...superAdmin, activeCompanyId: null }),
    ).toThrow(ForbiddenException);
  });

  it('ignores client-sent activeCompanyId for regular users (companyId tampering)', () => {
    // Un usuario normal no puede escapar de su empresa enviando activeCompanyId.
    const tamperedUser = {
      ...companyAUser,
      activeCompanyId: 'company-b',
    };

    expect(resolveCompanyScope(tamperedUser)).toBe('company-a');
    expect(() => assertCompanyScope(tamperedUser, 'company-b')).toThrow(
      ForbiddenException,
    );
    expect(() => resolveCompanyScope(tamperedUser, 'company-b')).toThrow(
      ForbiddenException,
    );
  });

  it('rejects non-SUPER_ADMIN users without an account company', () => {
    const orphanUser = {
      ...companyAUser,
      companyId: null as unknown as string,
      activeCompanyId: undefined,
    };

    expect(() => resolveCompanyScope(orphanUser)).toThrow(ForbiddenException);
  });
});
