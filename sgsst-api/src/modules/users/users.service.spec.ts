import { ConflictException } from '@nestjs/common';
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
});
