import { NotificationsQueueService } from './notifications-queue.service';

describe('NotificationsQueueService', () => {
  const notificationsService = {
    generateDueAlertsForCompany: jest.fn(),
    retryFailedExternalDeliveries: jest.fn(),
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
    );

    await service.enqueueExternalDeliveryRetries(user);

    expect(
      notificationsService.retryFailedExternalDeliveries,
    ).toHaveBeenCalledWith(25, 'company-a');
  });
});
