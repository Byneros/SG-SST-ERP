import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const prisma = {
    notification: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const emailService = { send: jest.fn() };
  const whatsAppService = { sendText: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prevents SUPER_ADMIN from marking another user notification as read', async () => {
    // Las notificaciones son personales: solo el dueño puede leerlas/marcarlas.
    prisma.notification.findFirst.mockResolvedValue(null);
    const service = new NotificationsService(
      prisma as never,
      emailService as never,
      whatsAppService as never,
    );
    const superAdmin = {
      sub: 'super-admin',
      email: 'super@platform.test',
      role: 'SUPER_ADMIN',
      companyId: null,
      activeCompanyId: 'company-a',
    };

    await expect(
      service.markRead(superAdmin, 'notification-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });
});
