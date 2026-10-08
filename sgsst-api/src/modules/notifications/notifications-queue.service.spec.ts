import { env } from '../../config/env';
import { NotificationsQueueService } from './notifications-queue.service';

describe('NotificationsQueueService', () => {
  const notificationsService = {
    generateDueAlertsForCompany: jest.fn(),
    retryFailedExternalDeliveries: jest.fn(),
    escalateOverdueTasks: jest.fn(),
  };
  const prismaService = {
    company: { findMany: jest.fn().mockResolvedValue([{ id: 'company-a' }]) },
  };
  const user = {
    sub: 'admin-a',
    email: 'admin@company-a.test',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes manually requested due alerts to the authenticated company', async () => {
    notificationsService.generateDueAlertsForCompany.mockResolvedValue({
      success: true,
    });
    const service = new NotificationsQueueService(
      notificationsService as never,
      prismaService as never,
    );

    await service.enqueueDueAlerts(user);

    expect(
      notificationsService.generateDueAlertsForCompany,
    ).toHaveBeenCalledWith('company-a');
  });

  it('scopes manual external delivery retries to the authenticated company', async () => {
    notificationsService.retryFailedExternalDeliveries.mockResolvedValue({
      success: true,
    });
    const service = new NotificationsQueueService(
      notificationsService as never,
      prismaService as never,
    );

    await service.enqueueExternalDeliveryRetries(user);

    expect(
      notificationsService.retryFailedExternalDeliveries,
    ).toHaveBeenCalledWith(25, 'company-a');
  });

  it('S16.1: scopes manual task escalation to the authenticated company (sin cola corre directo)', async () => {
    notificationsService.escalateOverdueTasks.mockResolvedValue({
      success: true,
      created: 2,
    });
    const service = new NotificationsQueueService(
      notificationsService as never,
      prismaService as never,
    );

    const result = await service.enqueueTaskEscalation(user);

    expect(notificationsService.escalateOverdueTasks).toHaveBeenCalledWith(
      'company-a',
    );
    expect(result).toEqual({ success: true, created: 2 });
  });

  it('S16.1: el cron global procesa empresa por empresa', async () => {
    notificationsService.escalateOverdueTasks.mockResolvedValue({
      success: true,
      created: 1,
    });
    // Habilitar el escalamiento para la prueba (por defecto esta OFF en env).
    Object.assign(env, { taskEscalationEnabled: true });
    prismaService.company.findMany.mockResolvedValue([
      { id: 'company-a' },
      { id: 'company-b' },
    ]);
    const service = new NotificationsQueueService(
      notificationsService as never,
      prismaService as never,
    );
    const processFn = (
      service as unknown as {
        process: (job: {
          name: string;
          data: Record<string, unknown>;
        }) => Promise<unknown>;
      }
    ).process.bind(service) as (job: {
      name: string;
      data: Record<string, unknown>;
    }) => Promise<unknown>;

    const result = (await processFn({ name: 'task-escalation', data: {} })) as {
      companies: number;
      created: number;
    };

    expect(notificationsService.escalateOverdueTasks).toHaveBeenCalledWith(
      'company-a',
    );
    expect(notificationsService.escalateOverdueTasks).toHaveBeenCalledWith(
      'company-b',
    );
    expect(result).toEqual({ success: true, companies: 2, created: 2 });

    Object.assign(env, { taskEscalationEnabled: false });
  });
});
