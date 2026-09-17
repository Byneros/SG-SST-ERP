import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationPriority, NotificationType } from '@prisma/client';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { env } from '../../config/env';
import { DocumentsStorageService } from '../documents/documents-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ReportFormat } from './reports.service';
import { ReportsService } from './reports.service';

const QUEUE_NAME = 'sgsst-reports';
const GENERATE_REPORT_JOB = 'generate-report';
const CLEANUP_REPORTS_JOB = 'cleanup-expired-reports';
const CAPTURE_METRICS_JOB = 'capture-report-metrics';
const EVALUATE_ALERTS_JOB = 'evaluate-report-alerts';

type ReportJobData = {
  user: AuthenticatedUser;
  kind: string;
  format: ReportFormat;
  companyId?: string;
  exportId?: string;
};

@Injectable()
export class ReportsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportsQueueService.name);
  private connection?: IORedis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly reportsService: ReportsService,
    private readonly storageService: DocumentsStorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    if (!env.reportsQueueEnabled) {
      this.logger.log('Reports queue disabled');
      return;
    }

    this.connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    if (!env.reportsWorkerEnabled) {
      this.logger.log('Reports worker disabled in this process');
      return;
    }

    this.worker = new Worker(QUEUE_NAME, (job) => this.process(job), {
      connection: this.connection,
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Report job failed: ${job?.id ?? 'unknown'}`, error.stack);
    });
    await this.scheduleMaintenance();
  }

  async enqueue(input: ReportJobData) {
    const reportExport = input.exportId
      ? await this.reportsService.markExportQueued(input.exportId)
      : await this.reportsService.createExport(input);
    const companyId = reportExport.companyId ?? undefined;
    const jobData: ReportJobData = {
      ...input,
      companyId,
      exportId: reportExport.id,
      user: {
        ...input.user,
        companyId: companyId ?? null,
        activeCompanyId: companyId ?? null,
      },
    };

    if (!this.queue) {
      const result = await this.generate(jobData);
      return { success: true, queued: false, exportId: reportExport.id, fileUrl: result.fileUrl };
    }

    const job = await this.queue.add(GENERATE_REPORT_JOB, jobData, {
      removeOnComplete: 50,
      removeOnFail: 100,
    });
    await this.reportsService.markExportQueued(reportExport.id, job.id);
    await this.reportsService.logScheduledExport({
      user: input.user,
      kind: input.kind,
      format: input.format,
      requestedCompanyId: input.companyId,
      status: 'QUEUED',
      jobId: job.id,
    });
    return { success: true, queued: true, exportId: reportExport.id, jobId: job.id };
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  private async process(job: Job) {
    if (job.name === CLEANUP_REPORTS_JOB) {
      return this.cleanupExpiredReports();
    }
    if (job.name === CAPTURE_METRICS_JOB) {
      return this.captureMetricSnapshots();
    }
    if (job.name === EVALUATE_ALERTS_JOB) {
      return this.evaluateMetricAlerts();
    }
    if (job.name === GENERATE_REPORT_JOB) {
      return this.generate(job.data as ReportJobData, job.id);
    }
    this.logger.warn(`Unknown report job: ${job.name}`);
    return { ignored: true };
  }

  private async scheduleMaintenance() {
    if (!this.queue) return;
    await this.queue.upsertJobScheduler(
      `${CLEANUP_REPORTS_JOB}-daily`,
      { pattern: env.reportsCleanupCron },
      {
        name: CLEANUP_REPORTS_JOB,
        data: {},
        opts: {
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      },
    );
    this.logger.log(`Scheduled report cleanup job with cron: ${env.reportsCleanupCron}`);
    await this.queue.upsertJobScheduler(
      `${CAPTURE_METRICS_JOB}-daily`,
      { pattern: env.reportsMetricsCron },
      {
        name: CAPTURE_METRICS_JOB,
        data: {},
        opts: {
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      },
    );
    this.logger.log(`Scheduled report metrics job with cron: ${env.reportsMetricsCron}`);
    await this.queue.upsertJobScheduler(
      `${EVALUATE_ALERTS_JOB}-daily`,
      { pattern: env.reportsAlertsCron },
      {
        name: EVALUATE_ALERTS_JOB,
        data: {},
        opts: {
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      },
    );
    this.logger.log(`Scheduled report alerts job with cron: ${env.reportsAlertsCron}`);
  }

  private cleanupExpiredReports() {
    return this.reportsService.cleanupExpiredExports((storageKey) =>
      this.storageService.delete(storageKey),
    );
  }

  private captureMetricSnapshots() {
    return this.reportsService.captureDailyMetricSnapshots();
  }

  private async evaluateMetricAlerts() {
    const alerts = await this.reportsService.metricAlertCandidates();
    let notifications = 0;
    for (const alert of alerts) {
      const targets = await this.reportsService.metricAlertTargets(alert.companyId);
      const priority = alert.kind === 'FAILURE_RATE' ? NotificationPriority.CRITICAL : NotificationPriority.HIGH;
      for (const target of targets) {
        const notification = await this.notificationsService.create({
          userId: target.id,
          companyId: alert.companyId,
          title: alert.title,
          message: alert.message,
          type: NotificationType.INFO,
          priority,
          entity: 'ReportExportMetricSnapshot',
          entityId: `${alert.snapshotId}:${alert.kind}`,
        });
        if (notification.createdAt.getTime() >= Date.now() - 60_000) {
          notifications += 1;
        }
      }
      await this.notificationsService
        .sendCompanyWhatsAppAlert({
          companyId: alert.companyId,
          title: alert.title,
          message: alert.message,
          priority,
          entity: 'ReportExportMetricSnapshot',
          entityId: `${alert.snapshotId}:${alert.kind}`,
        })
        .catch((error: unknown) => {
          this.logger.warn(`WhatsApp report alert failed: ${String(error)}`);
        });
    }
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 1);
    await this.reportsService.logMetricAlertEvaluation({
      date: date.toISOString().slice(0, 10),
      alerts: alerts.length,
      notifications,
    });
    return { success: true, alerts: alerts.length, notifications };
  }

  private async generate(input: ReportJobData, jobId?: string) {
    let verifiedInput: ReportJobData | undefined;
    try {
      let jobInput = input;
      if (jobInput.exportId) {
        const { reportExport, companyId } = await this.reportsService.getExportForProcessing(
          jobInput.user,
          jobInput.exportId,
        );
        jobInput = {
          ...jobInput,
          companyId,
          user: {
            ...jobInput.user,
            companyId,
            activeCompanyId: companyId,
          },
        };
        verifiedInput = jobInput;
        await this.reportsService.markExportProcessing(reportExport.id, jobId);
      }
      const report = await this.reportsService.file(
        jobInput.user,
        jobInput.kind,
        jobInput.format,
        jobInput.companyId,
      );
      const stored = await this.storageService.uploadReport({
        originalname: report.fileName,
        mimetype: report.mimeType,
        size: report.buffer.length,
        buffer: report.buffer,
      });
      await this.notificationsService.create({
        userId: jobInput.user.sub,
        companyId: jobInput.companyId ?? null,
        title: 'Reporte listo para descargar',
        message: `${report.fileName}: ${stored.fileUrl}`,
        type: NotificationType.INFO,
        priority: NotificationPriority.MEDIUM,
        entity: 'Report',
        entityId: jobInput.exportId ?? jobId,
      });
      if (jobInput.exportId) {
        await this.reportsService.markExportReady(jobInput.exportId, stored);
      }
      await this.reportsService.logScheduledExport({
        user: jobInput.user,
        kind: jobInput.kind,
        format: jobInput.format,
        requestedCompanyId: jobInput.companyId,
        status: 'READY',
        jobId: jobInput.exportId ?? jobId,
        fileUrl: stored.fileUrl,
      });
      return stored;
    } catch (error) {
      if (verifiedInput?.exportId) {
        await this.reportsService.markExportFailed(verifiedInput.exportId, error);
      }
      if (verifiedInput) {
        await this.notificationsService.create({
          userId: verifiedInput.user.sub,
          companyId: verifiedInput.companyId ?? null,
          title: 'No fue posible generar el reporte',
          message: `${verifiedInput.kind}.${verifiedInput.format}: ${error instanceof Error ? error.message : String(error)}`,
          type: NotificationType.INFO,
          priority: NotificationPriority.HIGH,
          entity: 'Report',
          entityId: verifiedInput.exportId ?? jobId,
        });
        await this.reportsService.logScheduledExport({
          user: verifiedInput.user,
          kind: verifiedInput.kind,
          format: verifiedInput.format,
          requestedCompanyId: verifiedInput.companyId,
          status: 'FAILED',
          jobId: verifiedInput.exportId ?? jobId,
          error,
        });
      }
      throw error;
    }
  }
}
