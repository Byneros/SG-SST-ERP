import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Seguridad del rol DEVELOPER: ninguna via de la API de usuarios permite
 * crear o promover cuentas DEVELOPER (solo seed/consola).
 */
describe('UsersService - DEVELOPER role protection', () => {
  const usersRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByIdScoped: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateScoped: jest.fn(),
    remove: jest.fn(),
    removeScoped: jest.fn(),
    count: jest.fn(),
  };
  const auditService = { log: jest.fn() };

  const service = new UsersService(
    usersRepository as never,
    auditService as never,
  );

  const adminActor = {
    sub: 'admin-1',
    email: 'admin@company.test',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  const superAdminActor = {
    sub: 'super-1',
    email: 'super@platform.test',
    role: 'SUPER_ADMIN',
    companyId: null,
    activeCompanyId: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('ADMIN de empresa no puede crear un DEVELOPER', async () => {
    await expect(
      service.create(
        {
          name: 'Hacker Dev',
          email: 'dev@company.test',
          password: 'Password123',
          // El DTO ya rechaza 'DEVELOPER'; se prueba la defensa del servicio.
          role: 'DEVELOPER',
          companyId: 'company-a',
        },
        adminActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usersRepository.create).not.toHaveBeenCalled();
  });

  it('ni siquiera SUPER_ADMIN puede crear DEVELOPER via API', async () => {
    await expect(
      service.create(
        {
          name: 'Sneaky Dev',
          email: 'dev2@platform.test',
          password: 'Password123',
          role: 'DEVELOPER',
        },
        superAdminActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usersRepository.create).not.toHaveBeenCalled();
  });

  it('no se puede promover un usuario existente a DEVELOPER', async () => {
    usersRepository.findByIdScoped.mockResolvedValue({
      id: 'user-1',
      role: 'EMPLOYEE',
      companyId: 'company-a',
    });

    await expect(
      service.update('user-1', { role: 'DEVELOPER' }, adminActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usersRepository.updateScoped).not.toHaveBeenCalled();
  });

  it('un DEVELOPER no puede mutar su propio rol via users API', async () => {
    const developerActor = {
      sub: 'dev-1',
      email: 'dev@platform.test',
      role: 'DEVELOPER',
      companyId: null,
      activeCompanyId: null,
    };
    usersRepository.findById.mockResolvedValue({
      id: 'dev-1',
      role: 'DEVELOPER',
      companyId: null,
    });
    usersRepository.findByIdScoped.mockResolvedValue(null);

    await expect(
      service.update('dev-1', { role: 'SUPER_ADMIN' }, developerActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
