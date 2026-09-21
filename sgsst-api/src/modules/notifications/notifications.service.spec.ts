import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExternalDeliveryStatus } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const prisma = {
    notification: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    externalDelivery: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const emailService = { send: jest.fn() };
  const whatsAppService = { sendText: jest.fn() };
  const auditService = { log: jest.fn() };

  const buildService = () =>
    new NotificationsService(
      prisma as never,
      emailService as never,
      whatsAppService as never,
      auditService as never,
    );

  const adminOfCompanyA = {
    sub: 'admin-a',
    email: 'admin-a@company.test',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: null,
  };

  const superAdmin = {
    sub: 'super-admin',
    email: 'super@platform.test',
    role: 'SUPER_ADMIN',
    companyId: null,
    activeCompanyId: 'company-a',
  };

  const deliveryFromCompanyA = {
    id: 'delivery-a',
    companyId: 'company-a',
    provider: 'WHATSAPP',
    status: ExternalDeliveryStatus.FAILED,
    attemptCount: 2,
    maxAttempts: 5,
    target: '+573001112222',
    payload: { text: 'hola' },
    response: null,
    error: 'boom',
    nextAttemptAt: new Date('2026-01-01T00:00:00Z'),
    deliveredAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prevents SUPER_ADMIN from marking another user notification as read', async () => {
    // Las notificaciones son personales: solo el dueño puede leerlas/marcarlas.
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(
      buildService().markRead(superAdmin, 'notification-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  describe('retryExternalDeliveryForUser', () => {
    it('rejects with 404 when the delivery does not exist', async () => {
      prisma.externalDelivery.findUnique.mockResolvedValue(null);

      await expect(
        buildService().retryExternalDeliveryForUser(adminOfCompanyA, 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.externalDelivery.update).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('rejects with 403 when the delivery belongs to another company', async () => {
      prisma.externalDelivery.findUnique.mockResolvedValue({
        ...deliveryFromCompanyA,
        companyId: 'company-b',
      });

      await expect(
        buildService().retryExternalDeliveryForUser(
          adminOfCompanyA,
          'delivery-b',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.externalDelivery.update).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('rejects with 403 when SUPER_ADMIN active company does not match', async () => {
      prisma.externalDelivery.findUnique.mockResolvedValue({
        ...deliveryFromCompanyA,
        companyId: 'company-b',
      });

      await expect(
        buildService().retryExternalDeliveryForUser(superAdmin, 'delivery-b'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.externalDelivery.update).not.toHaveBeenCalled();
    });

    it('retries a failed WhatsApp delivery, resets attempts and audits the action', async () => {
      const delivered = {
        ...deliveryFromCompanyA,
        status: ExternalDeliveryStatus.SENT,
        attemptCount: 3,
        error: null,
        nextAttemptAt: null,
      };
      prisma.externalDelivery.findUnique.mockResolvedValue(
        deliveryFromCompanyA,
      );
      prisma.externalDelivery.update
        .mockResolvedValueOnce({ ...deliveryFromCompanyA, attemptCount: 3 })
        .mockResolvedValueOnce(delivered);
      whatsAppService.sendText.mockResolvedValue({ sent: true, response: {} });

      const result = await buildService().retryExternalDeliveryForUser(
        adminOfCompanyA,
        'delivery-a',
      );

      expect(result.status).toBe(ExternalDeliveryStatus.SENT);
      expect(prisma.externalDelivery.update).toHaveBeenCalledWith({
        where: { id: 'delivery-a' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          status: ExternalDeliveryStatus.PENDING,
          attemptCount: 3,
          nextAttemptAt: null,
        }),
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          user: adminOfCompanyA,
          action: 'EXTERNAL_DELIVERY_RETRY',
          entity: 'ExternalDelivery',
          entityId: 'delivery-a',
          before: { status: 'FAILED', attemptCount: 2 },
          after: {
            status: 'SENT',
            attemptCount: 3,
            error: null,
          },
        }),
      );
    });

    it('does not audit when the retry is rejected by company scope', async () => {
      prisma.externalDelivery.findUnique.mockResolvedValue({
        ...deliveryFromCompanyA,
        companyId: 'company-b',
      });

      await buildService()
        .retryExternalDeliveryForUser(adminOfCompanyA, 'delivery-b')
        .catch(() => undefined);

      expect(auditService.log).not.toHaveBeenCalled();
    });
  });
});
