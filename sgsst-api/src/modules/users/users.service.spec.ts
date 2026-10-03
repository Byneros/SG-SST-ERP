import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
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
    findLockState: jest.fn(),
    unlockLogin: jest.fn(),
  };
  const auditService = {
    log: jest.fn(),
  };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(usersRepository as never, auditService as never);
  });

  it('rejects duplicate emails when creating users', async () => {
    usersRepository.findByEmail.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.create({
        name: 'SST',
        email: 'sst@sgsst.com',
        password: 'Admin12345',
        role: 'SST',
        companyId: 'company-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(usersRepository.create).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('writes audit log when updating a user', async () => {
    const before = {
      id: 'user-1',
      name: 'Old',
      email: 'old@sgsst.com',
      role: 'SST',
      companyId: 'company-1',
      isActive: true,
    };
    const after = { ...before, name: 'New' };
    usersRepository.findByIdScoped.mockResolvedValue(before);
    usersRepository.updateScoped.mockResolvedValue({ count: 1 });
    usersRepository.findByIdScoped.mockResolvedValue(after);

    await service.update(
      'user-1',
      { name: 'New' },
      {
        sub: 'admin-1',
        email: 'admin@sgsst.com',
        role: 'ADMIN',
        companyId: 'company-1',
      },
    );

    expect(usersRepository.updateScoped).toHaveBeenCalledWith(
      'user-1',
      'company-1',
      { name: 'New' },
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        entity: 'User',
        entityId: 'user-1',
      }),
    );
  });

  it('writes deactivate audit log when removing a user', async () => {
    const before = {
      id: 'user-1',
      email: 'sst@sgsst.com',
      role: 'SST',
      isActive: true,
    };
    const after = { ...before, isActive: false };
    usersRepository.findByIdScoped.mockResolvedValue(before);
    usersRepository.removeScoped.mockResolvedValue({ count: 1 });
    usersRepository.findByIdScoped.mockResolvedValue(after);

    await service.remove('user-1', {
      sub: 'admin-1',
      email: 'admin@sgsst.com',
      role: 'ADMIN',
      companyId: 'company-1',
    });

    expect(usersRepository.removeScoped).toHaveBeenCalledWith(
      'user-1',
      'company-1',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DEACTIVATE',
        entity: 'User',
        entityId: 'user-1',
      }),
    );
  });

  describe('unlock (H-5)', () => {
    const admin = {
      sub: 'admin-1',
      email: 'admin@sgsst.com',
      role: 'ADMIN',
      companyId: 'company-1',
    };

    it('unlocks a locked user of the same company and writes UNLOCK audit log', async () => {
      const target = {
        id: 'user-2',
        email: 'sst@sgsst.com',
        role: 'SST',
        companyId: 'company-1',
        isActive: true,
      };
      const lockState: {
        id: string;
        failedLoginAttempts: number;
        lockedUntil: Date | null;
      } = {
        id: 'user-2',
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 10 * 60_000),
      };
      usersRepository.findByIdScoped.mockResolvedValue(target);
      usersRepository.findLockState.mockResolvedValue(lockState);
      usersRepository.unlockLogin.mockResolvedValue({ count: 1 });

      const result = await service.unlock('user-2', admin);

      expect(usersRepository.unlockLogin).toHaveBeenCalledWith(
        'user-2',
        'company-1',
      );
      expect(result).toEqual(
        expect.objectContaining({ id: 'user-2', unlocked: true }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UNLOCK',
          entity: 'User',
          entityId: 'user-2',
          before: expect.objectContaining({ locked: true }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('rejects with 409 when the user is not locked and audits the rejection', async () => {
      usersRepository.findByIdScoped.mockResolvedValue({
        id: 'user-2',
        companyId: 'company-1',
      });
      usersRepository.findLockState.mockResolvedValue({
        id: 'user-2',
        failedLoginAttempts: 2,
        lockedUntil: null,
      });

      await expect(service.unlock('user-2', admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(usersRepository.unlockLogin).not.toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UNLOCK_REJECTED_NOT_LOCKED',
          entityId: 'user-2',
        }),
      );
    });

    it('treats a user of another company as nonexistent (404) and never unlocks', async () => {
      usersRepository.findByIdScoped.mockResolvedValue(null);

      await expect(service.unlock('user-9', admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(usersRepository.findLockState).not.toHaveBeenCalled();
      expect(usersRepository.unlockLogin).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('lets a platform role with an active company unlock users of that company', async () => {
      const target = {
        id: 'user-3',
        email: 'sst@other.com',
        companyId: 'company-2',
        isActive: true,
      };
      usersRepository.findByIdScoped.mockResolvedValue(target);
      usersRepository.findLockState.mockResolvedValue({
        id: 'user-3',
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 60_000),
      });
      usersRepository.unlockLogin.mockResolvedValue({ count: 1 });

      const result = await service.unlock('user-3', {
        sub: 'super-1',
        email: 'super@sgsst.com',
        role: 'SUPER_ADMIN',
        companyId: '',
        activeCompanyId: 'company-2',
      });

      expect(usersRepository.findByIdScoped).toHaveBeenCalledWith(
        'user-3',
        'company-2',
      );
      expect(usersRepository.unlockLogin).toHaveBeenCalledWith(
        'user-3',
        'company-2',
      );
      expect(result.unlocked).toBe(true);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UNLOCK' }),
      );
    });
  });
});
