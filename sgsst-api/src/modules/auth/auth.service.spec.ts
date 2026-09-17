import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const jwtService = {
    signAsync: jest.fn(),
  };
  const usersRepository = {
    findByEmail: jest.fn(),
    findAuthById: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    updateRefreshTokenHash: jest.fn(),
    updatePassword: jest.fn(),
    updatePasswordResetToken: jest.fn(),
  };
  const totpService = {
    verify: jest.fn(),
    generateSecret: jest.fn(),
    otpauthUrl: jest.fn(),
  };
  const prisma = {
    company: {
      findFirst: jest.fn(),
    },
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      usersRepository as never,
      jwtService as never,
      totpService as never,
      prisma as never,
    );
  });

  it('logs in active users and signs JWT payload with role and company scope', async () => {
    const password = await bcrypt.hash('Admin12345', 12);
    usersRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      name: 'Admin',
      email: 'admin@sgsst.com',
      password,
      role: 'ADMIN',
      companyId: 'company-1',
      isActive: true,
    });
    jwtService.signAsync.mockResolvedValue('signed-token');

    const result = await service.login({
      email: 'admin@sgsst.com',
      password: 'Admin12345',
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'admin@sgsst.com',
      role: 'ADMIN',
      companyId: 'company-1',
      activeCompanyId: 'company-1',
      type: 'access',
    });
    expect(result.accessToken).toBe('signed-token');
    expect(result.refreshToken).toBe('signed-token');
    expect(usersRepository.updateRefreshTokenHash).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
    );
    expect(result.user).toMatchObject({
      id: 'user-1',
      role: 'ADMIN',
      companyId: 'company-1',
      activeCompanyId: 'company-1',
    });
  });

  it('rejects inactive users even with a valid password', async () => {
    const password = await bcrypt.hash('Admin12345', 12);
    usersRepository.findByEmail.mockResolvedValue({
      password,
      isActive: false,
    });

    await expect(
      service.login({ email: 'inactive@sgsst.com', password: 'Admin12345' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials', async () => {
    usersRepository.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@sgsst.com', password: 'bad-pass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows bootstrap admin only when there are no users', async () => {
    usersRepository.count.mockResolvedValue(1);

    await expect(
      service.bootstrapAdmin({
        name: 'Admin',
        email: 'admin@sgsst.com',
        password: 'Admin12345',
        role: 'ADMIN',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
