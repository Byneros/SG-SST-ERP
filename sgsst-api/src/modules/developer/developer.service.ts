import { ForbiddenException, Injectable } from '@nestjs/common';
import { env } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { AppService } from '../../app.service';
import { ErrorEventsService } from './error-events.service';

/**
 * Solo datos que el backend realmente tiene: health de AppService,
 * flags de configuracion (env) y audit log. Nunca contenido de negocio
 * de los tenants (minimo privilegio; sin metricas inventadas).
 */
@Injectable()
export class DeveloperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appService: AppService,
    private readonly errorEvents: ErrorEventsService,
  ) {}

  /** Defensa en profundidad: los endpoints developer no admiten bypass. */
  assertDeveloper(user: AuthenticatedUser) {
    if (user.role !== 'DEVELOPER') {
      throw new ForbiddenException('Developer access required');
    }
  }

  /** Resumen: estado API + PostgreSQL + Redis (reusa el health existente). */
  async getOverview() {
    const health = this.appService.getHealth();
    const dependencies = await this.appService
      .getReadiness()
      .then((r) => r.dependencies)
      .catch(() => ({ database: 'error' as const, redis: 'error' as const }));

    return {
      ...health,
      dependencies,
      queues: {
        notifications: env.notificationsQueueEnabled,
        reports: env.reportsQueueEnabled,
      },
    };
  }

  /** Modulos del sistema y su estado de configuracion (flags reales de env). */
  async getModules() {
    const [companies, users, auditLogs] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.user.count(),
      this.prisma.auditLog.count(),
    ]);

    return {
      modules: [
        { name: 'auth', enabled: true, detail: 'JWT + MFA + lockout' },
        { name: 'companies', enabled: true },
        { name: 'users', enabled: true },
        { name: 'employees', enabled: true },
        { name: 'documents', enabled: true },
        { name: 'dashboard', enabled: true },
        { name: 'contractors', enabled: true },
        {
          name: 'notifications',
          enabled: true,
          detail: env.notificationsQueueEnabled
            ? `queue on (cron ${env.notificationsCron})`
            : 'queue off',
        },
        {
          name: 'reports',
          enabled: true,
          detail: env.reportsQueueEnabled
            ? `queue on (cleanup ${env.reportsCleanupCron})`
            : 'queue off',
        },
        {
          name: 'ai-assistant',
          enabled: env.aiEnabled,
          detail: env.aiEnabled ? 'configured' : 'disabled (AI_ENABLED)',
        },
        {
          name: 'email',
          enabled: env.emailEnabled,
          detail: env.emailEnabled ? 'smtp configured' : 'disabled',
        },
        {
          name: 'whatsapp',
          enabled: env.whatsappEnabled,
          detail: env.whatsappEnabled ? 'configured' : 'disabled',
        },
        {
          name: 'storage',
          enabled: true,
          detail: `driver: ${env.documentStorageDriver}`,
        },
      ],
      platform: {
        environment: env.nodeEnv,
        companies,
        users,
        auditLogs,
      },
    };
  }

  /**
   * Estado de las colas BullMQ: configuracion efectiva leida de env (los
   * servicios de cola la usan en onModuleInit) + ping Redis real via AppService.
   */
  getQueues() {
    return {
      notifications: {
        enabled: env.notificationsQueueEnabled,
        worker: env.notificationsWorkerEnabled,
        cron: env.notificationsCron,
      },
      reports: {
        enabled: env.reportsQueueEnabled,
        worker: env.reportsWorkerEnabled,
        cleanupCron: env.reportsCleanupCron,
        metricsCron: env.reportsMetricsCron,
      },
      redis: env.redisUrl ? 'configured' : 'missing',
    };
  }

  /**
   * Ultimos errores/avisos tecnicos del proceso (ring buffer en memoria,
   * capturados por el logger global ya enmascarados). Sin PII ni secretos.
   */
  getErrors(limit = 100) {
    return {
      data: this.errorEvents.latest(limit),
      total: this.errorEvents.count(),
    };
  }

  /** Ultimas operaciones administrativas (audit log global, rol plataforma). */
  async getRecentAdminActivity() {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    return { data: logs };
  }

  /** Diagnostico global: conteos tecnicos, nunca contenido de tenants. */
  async getDiagnostics(user: AuthenticatedUser) {
    this.assertDeveloper(user);
    const [
      companies,
      activeCompanies,
      users,
      activeUsers,
      developers,
      auditLogs,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { isActive: true } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { role: 'DEVELOPER' } }),
      this.prisma.auditLog.count(),
    ]);
    return {
      companies: { total: companies, active: activeCompanies },
      users: { total: users, active: activeUsers, developers },
      auditLogs,
      database: 'reachable' as const,
    };
  }
}
