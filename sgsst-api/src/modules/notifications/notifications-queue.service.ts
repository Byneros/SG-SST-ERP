import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../../config/env';
import { NotificationsService } from './notifications.service';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { PrismaService } from '../../database/prisma.service';

const QUEUE_NAME = 'sgsst-notifications';
const DUE_ALERTS_JOB = 'generate-due-alerts';
const RETRY_EXTERNAL_DELIVERIES_JOB = 'retry-external-deliveries';
const TASK_ESCALATION_JOB = 'task-escalation';
type TenantJobData = { companyId?: string };

@Injectable()
export class NotificationsQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationsQueueService.name);
  private connection?: IORedis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prismaService: PrismaService,
  ) {}

  async onModuleInit() {
    if (!env.notificationsQueueEnabled) {
      this.logger.log('Notifications queue disabled');
      return;
    }

    this.connection = new IORedis(env.redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    if (!env.notificationsWorkerEnabled) {
      this.logger.log('Notifications worker disabled in this process');
      return;
    }

    this.worker = new Worker(QUEUE_NAME, (job) => this.process(job), {
      connection: this.connection,
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Notification job failed: ${job?.name}`, error.stack);
    });

    await this.scheduleDueAlerts();
    await this.scheduleExternalDeliveryRetries();
    await this.scheduleTaskEscalation();
  }

  async enqueueDueAlerts(user: AuthenticatedUser) {
    const companyId = resolveCompanyScope(user);
    if (!this.queue) {
      return this.notificationsService.generateDueAlertsForCompany(companyId);
    }

    const job = await this.queue.add(
      DUE_ALERTS_JOB,
      { companyId } satisfies TenantJobData,
      {
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
    return { success: true, queued: true, jobId: job.id };
  }

  async enqueueExternalDeliveryRetries(user: AuthenticatedUser) {
    const companyId = resolveCompanyScope(user);
    if (!this.queue) {
      return this.notificationsService.retryFailedExternalDeliveries(
        25,
        companyId,
      );
    }

    const job = await this.queue.add(
      RETRY_EXTERNAL_DELIVERIES_JOB,
      { companyId } satisfies TenantJobData,
      {
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
    return { success: true, queued: true, jobId: job.id };
  }

  /** S16.1: pasada manual de escalamiento de tareas para la empresa activa. */
  async enqueueTaskEscalation(user: AuthenticatedUser) {
    const companyId = resolveCompanyScope(user);
    if (!this.queue) {
      return this.notificationsService.escalateOverdueTasks(companyId);
    }

    const job = await this.queue.add(
      TASK_ESCALATION_JOB,
      { companyId } satisfies TenantJobData,
      {
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
    return { success: true, queued: true, jobId: job.id };
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  private async scheduleDueAlerts() {
    if (!this.queue) {
      return;
    }

    await this.queue.upsertJobScheduler(
      `${DUE_ALERTS_JOB}-daily`,
      { pattern: env.notificationsCron },
      {
        name: DUE_ALERTS_JOB,
        data: {},
        opts: {
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      },
    );
    this.logger.log(
      `Scheduled notifications job with cron: ${env.notificationsCron}`,
    );
  }

  private async scheduleExternalDeliveryRetries() {
    if (!this.queue) {
      return;
    }

    await this.queue.upsertJobScheduler(
      `${RETRY_EXTERNAL_DELIVERIES_JOB}-cron`,
      { pattern: env.externalDeliveryRetryCron },
      {
        name: RETRY_EXTERNAL_DELIVERIES_JOB,
        data: {},
        opts: {
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      },
    );
    this.logger.log(
      `Scheduled external delivery retries with cron: ${env.externalDeliveryRetryCron}`,
    );
  }

  private async scheduleTaskEscalation() {
    if (!this.queue || !env.taskEscalationEnabled) {
      return;
    }

    await this.queue.upsertJobScheduler(
      `${TASK_ESCALATION_JOB}-cron`,
      { pattern: env.taskEscalationCron },
      {
        name: TASK_ESCALATION_JOB,
        data: {},
        opts: {
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      },
    );
    this.logger.log(
      `Scheduled task escalation with cron: ${env.taskEscalationCron}`,
    );
  }

  private async process(job: Job) {
    if (job.name === DUE_ALERTS_JOB) {
      const { companyId } = job.data as TenantJobData;
      return companyId
        ? this.notificationsService.generateDueAlertsForCompany(companyId)
        : this.notificationsService.generateDueAlertsForAllCompanies();
    }
    if (job.name === RETRY_EXTERNAL_DELIVERIES_JOB) {
      const { companyId } = job.data as TenantJobData;
      return this.notificationsService.retryFailedExternalDeliveries(
        25,
        companyId,
      );
    }
    if (job.name === TASK_ESCALATION_JOB) {
      const { companyId } = job.data as TenantJobData;
      return companyId
        ? this.notificationsService.escalateOverdueTasks(companyId)
        : this.escalateForAllCompanies();
    }
    this.logger.warn(`Unknown notification job: ${job.name}`);
    return { ignored: true };
  }

  /** Cron global: la pasada corre por empresa para respetar el anti-duplicado scoping. */
  private async escalateForAllCompanies() {
    if (!env.taskEscalationEnabled) {
      return {
        success: false,
        skipped: 'TASK_ESCALATION_ENABLED=false',
        created: 0,
      };
    }
    const companies = await this.prismaService.company.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const results: Array<{ success: boolean; created: number }> = [];
    for (const company of companies) {
      results.push(
        await this.notificationsService.escalateOverdueTasks(company.id),
      );
    }
    return {
      success: true,
      companies: companies.length,
      created: results.reduce((total, result) => total + result.created, 0),
    };
  }
}
