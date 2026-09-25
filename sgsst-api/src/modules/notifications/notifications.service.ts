import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import {
  ExternalDeliveryProvider,
  ExternalDeliveryStatus,
  IncidentStatus,
  NotificationPriority,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import {
  assertCompanyScope,
  resolveCompanyScope,
} from '../../common/pipes/company-scope';
import { env } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';
import { ExternalDeliveriesQueryDto } from './dto/external-deliveries-query.dto';
import { EmailService } from './email.service';
import { WhatsAppDeliveryError, WhatsAppService } from './whatsapp.service';

type NotificationInput = {
  userId: string;
  companyId?: string | null;
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  entity?: string;
  entityId?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService,
    private readonly auditService: AuditService,
  ) {}

  async findForUser(user: AuthenticatedUser, query: ListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.NotificationWhereInput = {
      userId: user.sub,
      read: query.isActive === undefined ? undefined : !query.isActive,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { message: { contains: search, mode: 'insensitive' } },
              { entity: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId: user.sub, read: false },
      }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        unread,
      },
    };
  }

  async markRead(user: AuthenticatedUser, id: string) {
    // Solo el dueño marca como leída; actores con empresa activa no leen notificaciones
    // ajenas aunque compartan empresa (las notificaciones son personales).
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: user.sub },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllRead(user: AuthenticatedUser) {
    await this.prisma.notification.updateMany({
      where: { userId: user.sub, read: false },
      data: { read: true, readAt: new Date() },
    });
    return { success: true };
  }

  async create(input: NotificationInput) {
    const existing = input.entityId
      ? await this.prisma.notification.findFirst({
          where: {
            userId: input.userId,
            type: input.type ?? NotificationType.INFO,
            entity: input.entity,
            entityId: input.entityId,
            read: false,
          },
        })
      : null;
    if (existing) {
      return existing;
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        companyId: input.companyId,
        title: input.title,
        message: input.message,
        type: input.type ?? NotificationType.INFO,
        priority: input.priority ?? NotificationPriority.MEDIUM,
        entity: input.entity,
        entityId: input.entityId,
      },
      include: {
        user: { select: { email: true, name: true } },
      },
    });
    void this.sendNotificationEmail(notification).catch((error: unknown) => {
      this.logger.warn(`Notification email failed: ${String(error)}`);
    });
    return notification;
  }

  async sendCompanyWhatsAppAlert(input: {
    companyId?: string | null;
    title: string;
    message: string;
    priority: NotificationPriority;
    entity?: string;
    entityId?: string;
  }) {
    if (
      !input.companyId ||
      (input.priority !== NotificationPriority.HIGH &&
        input.priority !== NotificationPriority.CRITICAL)
    ) {
      return this.createExternalDelivery({
        provider: ExternalDeliveryProvider.WHATSAPP,
        status: ExternalDeliveryStatus.SKIPPED,
        companyId: input.companyId,
        subject: input.title,
        error:
          'Alert is not company-scoped or priority does not require WhatsApp',
        entity: input.entity,
        entityId: input.entityId,
      });
    }

    const company = await this.prisma.company.findUnique({
      where: { id: input.companyId },
      select: {
        name: true,
        whatsappAlertsEnabled: true,
        whatsappAlertPhone: true,
      },
    });
    if (!company?.whatsappAlertsEnabled || !company.whatsappAlertPhone) {
      return this.createExternalDelivery({
        provider: ExternalDeliveryProvider.WHATSAPP,
        status: ExternalDeliveryStatus.SKIPPED,
        companyId: input.companyId,
        subject: input.title,
        target: company?.whatsappAlertPhone,
        error: 'WhatsApp alerts are disabled or phone is missing for company',
        entity: input.entity,
        entityId: input.entityId,
      });
    }

    const text = [
      `SG-SST ERP - ${input.title}`,
      `Empresa: ${company.name}`,
      `Prioridad: ${input.priority}`,
      input.message,
    ].join('\n');
    const delivery = await this.createExternalDelivery({
      provider: ExternalDeliveryProvider.WHATSAPP,
      status: ExternalDeliveryStatus.PENDING,
      companyId: input.companyId,
      target: company.whatsappAlertPhone,
      subject: input.title,
      payload: { text, priority: input.priority },
      entity: input.entity,
      entityId: input.entityId,
    });

    try {
      const result = await this.whatsAppService.sendText({
        to: company.whatsappAlertPhone,
        text,
      });
      if (!result.sent) {
        return this.updateExternalDelivery(delivery.id, {
          status: ExternalDeliveryStatus.SKIPPED,
          response: result as Prisma.InputJsonObject,
          error: result.disabled
            ? 'WhatsApp channel is globally disabled'
            : 'WhatsApp channel is misconfigured',
        });
      }

      return this.updateExternalDelivery(delivery.id, {
        status: ExternalDeliveryStatus.SENT,
        response: result.response as Prisma.InputJsonValue,
        deliveredAt: new Date(),
      });
    } catch (error) {
      const deliveryError =
        error instanceof WhatsAppDeliveryError ? error : null;
      const attemptCount = 1;
      return this.updateExternalDelivery(delivery.id, {
        status: ExternalDeliveryStatus.FAILED,
        response: deliveryError?.response as Prisma.InputJsonValue,
        error: error instanceof Error ? error.message : String(error),
        attemptCount,
        nextAttemptAt:
          attemptCount >= env.externalDeliveryMaxAttempts
            ? null
            : this.nextRetryDate(attemptCount),
      });
    }
  }

  private createExternalDelivery(data: {
    provider: ExternalDeliveryProvider;
    status: ExternalDeliveryStatus;
    companyId?: string | null;
    target?: string | null;
    subject?: string;
    payload?: Prisma.InputJsonValue;
    response?: Prisma.InputJsonValue;
    error?: string;
    entity?: string;
    entityId?: string;
  }) {
    return this.prisma.externalDelivery.create({
      data: {
        provider: data.provider,
        status: data.status,
        maxAttempts: Math.max(env.externalDeliveryMaxAttempts, 1),
        companyId: data.companyId,
        target: data.target,
        subject: data.subject,
        payload: data.payload,
        response: data.response,
        error: data.error,
        entity: data.entity,
        entityId: data.entityId,
        deliveredAt:
          data.status === ExternalDeliveryStatus.SENT ? new Date() : undefined,
      },
    });
  }

  private updateExternalDelivery(
    id: string,
    data: {
      status: ExternalDeliveryStatus;
      response?: Prisma.InputJsonValue;
      error?: string | null;
      deliveredAt?: Date;
      attemptCount?: number;
      nextAttemptAt?: Date | null;
    },
  ) {
    return this.prisma.externalDelivery.update({
      where: { id },
      data,
    });
  }

  async retryFailedExternalDeliveries(limit = 25, companyId?: string) {
    const now = new Date();
    const deliveries = await this.prisma.externalDelivery.findMany({
      where: {
        status: ExternalDeliveryStatus.FAILED,
        ...(companyId ? { companyId } : {}),
        attemptCount: { lt: env.externalDeliveryMaxAttempts },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { attemptedAt: 'asc' },
      take: limit,
    });

    let retried = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const delivery of deliveries) {
      retried += 1;
      const result = await this.retryExternalDelivery(delivery.id);
      if (result.status === ExternalDeliveryStatus.SENT) sent += 1;
      if (result.status === ExternalDeliveryStatus.FAILED) failed += 1;
      if (result.status === ExternalDeliveryStatus.SKIPPED) skipped += 1;
    }

    return {
      success: true,
      scanned: deliveries.length,
      retried,
      sent,
      failed,
      skipped,
    };
  }

  async findExternalDeliveries(
    user: AuthenticatedUser,
    query: ExternalDeliveriesQueryDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.ExternalDeliveryWhereInput = {
      provider: query.provider as ExternalDeliveryProvider | undefined,
      status: query.status as ExternalDeliveryStatus | undefined,
      companyId: resolveCompanyScope(user, query.companyId),
      ...(search
        ? {
            OR: [
              { target: { contains: search, mode: 'insensitive' } },
              { subject: { contains: search, mode: 'insensitive' } },
              { error: { contains: search, mode: 'insensitive' } },
              { entity: { contains: search, mode: 'insensitive' } },
              { entityId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.externalDelivery.findMany({
        where,
        include: { company: { select: { id: true, name: true, nit: true } } },
        orderBy: { attemptedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.externalDelivery.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async retryExternalDelivery(id: string, options?: { force?: boolean }) {
    const delivery = await this.prisma.externalDelivery.findUnique({
      where: { id },
    });
    if (!delivery) {
      throw new NotFoundException('External delivery not found');
    }
    if (
      !options?.force &&
      (delivery.status !== ExternalDeliveryStatus.FAILED ||
        (delivery.nextAttemptAt && delivery.nextAttemptAt > new Date()))
    ) {
      return delivery;
    }
    if (delivery.provider !== ExternalDeliveryProvider.WHATSAPP) {
      return this.updateExternalDelivery(delivery.id, {
        status: ExternalDeliveryStatus.SKIPPED,
        error: `Retry not implemented for provider ${delivery.provider}`,
      });
    }
    if (!delivery.target || !this.isTextPayload(delivery.payload)) {
      return this.updateExternalDelivery(delivery.id, {
        status: ExternalDeliveryStatus.SKIPPED,
        error: 'WhatsApp retry requires target and text payload',
      });
    }

    const attemptCount = delivery.attemptCount + 1;
    await this.prisma.externalDelivery.update({
      where: { id: delivery.id },
      data: {
        status: ExternalDeliveryStatus.PENDING,
        attemptCount,
        attemptedAt: new Date(),
        nextAttemptAt: null,
      },
    });

    try {
      const result = await this.whatsAppService.sendText({
        to: delivery.target,
        text: delivery.payload.text,
      });
      if (!result.sent) {
        return this.updateExternalDelivery(delivery.id, {
          status: ExternalDeliveryStatus.SKIPPED,
          response: result as Prisma.InputJsonObject,
          error: result.disabled
            ? 'WhatsApp channel is globally disabled'
            : 'WhatsApp channel is misconfigured',
        });
      }

      return this.updateExternalDelivery(delivery.id, {
        status: ExternalDeliveryStatus.SENT,
        response: result.response as Prisma.InputJsonValue,
        error: null,
        deliveredAt: new Date(),
        nextAttemptAt: null,
      });
    } catch (error) {
      const nextAttemptAt =
        attemptCount >= delivery.maxAttempts
          ? null
          : this.nextRetryDate(attemptCount);
      const deliveryError =
        error instanceof WhatsAppDeliveryError ? error : null;
      return this.updateExternalDelivery(delivery.id, {
        status: ExternalDeliveryStatus.FAILED,
        response: deliveryError?.response as Prisma.InputJsonValue,
        error: error instanceof Error ? error.message : String(error),
        nextAttemptAt,
      });
    }
  }

  async retryExternalDeliveryForUser(user: AuthenticatedUser, id: string) {
    const delivery = await this.prisma.externalDelivery.findUnique({
      where: { id },
    });
    if (!delivery) {
      throw new NotFoundException('External delivery not found');
    }
    assertCompanyScope(user, delivery.companyId);
    const result = await this.retryExternalDelivery(id, { force: true });
    // Reintento manual: queda registrado para trazabilidad operativa.
    void this.auditService.log({
      user,
      action: 'EXTERNAL_DELIVERY_RETRY',
      entity: 'ExternalDelivery',
      entityId: id,
      before: {
        status: delivery.status,
        attemptCount: delivery.attemptCount,
      },
      after: {
        status: result.status,
        attemptCount: result.attemptCount,
        error: result.error,
      },
    });
    return result;
  }

  private nextRetryDate(attemptCount: number) {
    const seconds =
      env.externalDeliveryRetryBaseSeconds *
      Math.max(1, 2 ** (attemptCount - 1));
    return new Date(Date.now() + seconds * 1000);
  }

  private isTextPayload(
    payload: Prisma.JsonValue,
  ): payload is { text: string } {
    return Boolean(
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      'text' in payload &&
      typeof payload.text === 'string',
    );
  }

  async generateDueAlerts(user: AuthenticatedUser) {
    return this.generateDueAlertsForCompany(resolveCompanyScope(user));
  }

  async generateDueAlertsForAllCompanies() {
    const companies = await this.prisma.company.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const results = await Promise.all(
      companies.map((company) => this.generateDueAlertsForCompany(company.id)),
    );
    return {
      success: true,
      companies: companies.length,
      created: results.reduce((total, result) => total + result.created, 0),
    };
  }

  async generateDueAlertsForCompany(companyId: string) {
    const targetUsers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [Role.ADMIN, Role.SST] },
        companyId,
      },
      select: { id: true, companyId: true, role: true },
    });

    const now = new Date();
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const companyScope = { companyId };

    const [documents, trainings, incidents, planActivities] =
      await this.prisma.$transaction([
        this.prisma.document.findMany({
          where: {
            ...companyScope,
            expiresAt: { gte: now, lte: next30Days },
          },
          select: { id: true, name: true, expiresAt: true, companyId: true },
        }),
        this.prisma.training.findMany({
          where: { ...companyScope, date: { lt: now } },
          select: { id: true, title: true, date: true, companyId: true },
        }),
        this.prisma.incident.findMany({
          where: {
            ...companyScope,
            status: { not: IncidentStatus.RESOLVED },
          },
          select: { id: true, title: true, status: true, companyId: true },
        }),
        // S8.3: actividades del plan anual proximas (30 dias), vencidas o
        // sin evidencia cerca del vencimiento. Se excluyen cerradas/canceladas.
        this.prisma.annualPlanActivity.findMany({
          where: {
            ...companyScope,
            status: { notIn: ['DONE', 'CANCELLED'] },
            OR: [
              // Vencidas: fecha compromiso pasada.
              { dueDate: { lt: now } },
              // Proximas: vencen dentro de los proximos 30 dias.
              { dueDate: { gte: now, lte: next30Days } },
              // Sin evidencia y a punto de vencer (30 dias) o ya vencidas.
              { evidenceId: null, dueDate: { lte: next30Days } },
            ],
          },
          select: {
            id: true,
            name: true,
            dueDate: true,
            status: true,
            evidenceId: true,
            companyId: true,
            plan: { select: { year: true } },
          },
        }),
      ]);

    let created = 0;
    for (const targetUser of targetUsers) {
      const visibleDocuments = documents.filter((item) =>
        this.isVisibleForUser(targetUser, item.companyId),
      );
      const visibleTrainings = trainings.filter((item) =>
        this.isVisibleForUser(targetUser, item.companyId),
      );
      const visibleIncidents = incidents.filter((item) =>
        this.isVisibleForUser(targetUser, item.companyId),
      );

      for (const document of visibleDocuments) {
        const notification = await this.create({
          userId: targetUser.id,
          companyId: document.companyId,
          title: 'Documento proximo a vencer',
          message: `${document.name} vence el ${document.expiresAt?.toISOString().slice(0, 10)}`,
          type: NotificationType.DOCUMENT_EXPIRING,
          priority: NotificationPriority.HIGH,
          entity: 'Document',
          entityId: document.id,
        });
        if (notification.createdAt.getTime() >= now.getTime()) created += 1;
      }

      for (const training of visibleTrainings) {
        const notification = await this.create({
          userId: targetUser.id,
          companyId: training.companyId,
          title: 'Capacitacion vencida',
          message: `${training.title} estaba programada para ${training.date.toISOString().slice(0, 10)}`,
          type: NotificationType.TRAINING_OVERDUE,
          priority: NotificationPriority.MEDIUM,
          entity: 'Training',
          entityId: training.id,
        });
        if (notification.createdAt.getTime() >= now.getTime()) created += 1;
      }

      for (const incident of visibleIncidents) {
        const notification = await this.create({
          userId: targetUser.id,
          companyId: incident.companyId,
          title: 'Incidente abierto',
          message: `${incident.title} continua en estado ${incident.status}`,
          type: NotificationType.INCIDENT_OPEN,
          priority: NotificationPriority.CRITICAL,
          entity: 'Incident',
          entityId: incident.id,
        });
        if (notification.createdAt.getTime() >= now.getTime()) created += 1;
      }

      // S8.3: alertas de actividades del plan anual de trabajo.
      for (const activity of planActivities.filter((item) =>
        this.isVisibleForUser(targetUser, item.companyId),
      )) {
        const isOverdue = activity.dueDate !== null && activity.dueDate < now;
        const missingEvidence = activity.evidenceId === null;
        const dueLabel = activity.dueDate
          ? activity.dueDate.toISOString().slice(0, 10)
          : 'sin fecha';
        // Vencida sin evidencia = mayor criticidad: alta prioridad.
        const priority = isOverdue
          ? NotificationPriority.CRITICAL
          : NotificationPriority.HIGH;
        const notification = await this.create({
          userId: targetUser.id,
          companyId: activity.companyId,
          title: isOverdue
            ? 'Actividad del plan anual vencida'
            : 'Actividad del plan anual proxima',
          message: isOverdue
            ? `${activity.name} (plan ${activity.plan.year}) vencio el ${dueLabel}${missingEvidence ? ' y aun no tiene evidencia' : ''}`
            : `${activity.name} (plan ${activity.plan.year}) vence el ${dueLabel}${missingEvidence ? ' y aun no tiene evidencia' : ''}`,
          type: NotificationType.TASK,
          priority,
          entity: 'AnnualPlanActivity',
          entityId: activity.id,
        });
        if (notification.createdAt.getTime() >= now.getTime()) created += 1;
      }
    }

    return {
      success: true,
      created,
      scanned: {
        documents: documents.length,
        trainings: trainings.length,
        incidents: incidents.length,
        planActivities: planActivities.length,
      },
    };
  }

  private isVisibleForUser(
    user: { role: Role; companyId: string | null },
    companyId: string,
  ) {
    return user.role === Role.SUPER_ADMIN || user.companyId === companyId;
  }

  private async sendNotificationEmail(notification: {
    title: string;
    message: string;
    priority: NotificationPriority;
    user: { email: string; name: string };
  }) {
    if (
      notification.priority !== NotificationPriority.HIGH &&
      notification.priority !== NotificationPriority.CRITICAL
    ) {
      return;
    }

    await this.emailService.send({
      to: notification.user.email,
      subject: `[SG-SST] ${notification.title}`,
      text: `Hola ${notification.user.name},\n\n${notification.message}\n\nPrioridad: ${notification.priority}\n\nSG-SST ERP`,
      html: `<p>Hola ${notification.user.name},</p><p>${notification.message}</p><p><strong>Prioridad:</strong> ${notification.priority}</p><p>SG-SST ERP</p>`,
    });
  }
}
