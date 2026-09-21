import { BadRequestException, Injectable } from '@nestjs/common';
import {
  IncidentStatus,
  Prisma,
  ReportExportStatus,
  RiskLevel,
  Role,
} from '@prisma/client';
import type { Request } from 'express';
import PDFDocument from 'pdfkit';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { env } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReportExportsQueryDto } from './dto/report-exports-query.dto';

export type ReportKind =
  'employees' | 'expired-documents' | 'audits' | 'summary';
export type ReportFormat = 'csv' | 'pdf';
type ExportWhereBuildOptions = {
  includeSearch?: boolean;
  includeStatusFilter?: boolean;
};
type MetricAlertKind = 'FAILURE_RATE' | 'STORAGE';
const reportKinds: ReportKind[] = [
  'employees',
  'expired-documents',
  'audits',
  'summary',
];
const reportFormats: ReportFormat[] = ['csv', 'pdf'];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async csv(user: AuthenticatedUser, kind: ReportKind, companyId?: string) {
    this.assertReportKind(kind);
    const rows = await this.getRows(user, kind, companyId);
    return this.toCsv(rows);
  }

  async pdf(user: AuthenticatedUser, kind: ReportKind, companyId?: string) {
    this.assertReportKind(kind);
    const rows = await this.getRows(user, kind, companyId);
    return this.toPdf(this.reportTitle(kind), rows);
  }

  async file(
    user: AuthenticatedUser,
    kind: string,
    format: ReportFormat,
    companyId?: string,
  ) {
    this.assertReportKind(kind);
    this.assertReportFormat(format);
    if (format === 'csv') {
      const content = await this.csv(user, kind, companyId);
      return {
        buffer: Buffer.from(content, 'utf8'),
        fileName: `${kind}-${new Date().toISOString().slice(0, 10)}.csv`,
        mimeType: 'text/csv',
      };
    }
    const content = await this.pdf(user, kind, companyId);
    return {
      buffer: content,
      fileName: `${kind}-${new Date().toISOString().slice(0, 10)}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  async findExports(user: AuthenticatedUser, query: ReportExportsQueryDto) {
    await this.expireOldExports();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where = this.buildExportsWhere(user, query, {
      includeSearch: true,
      includeStatusFilter: true,
    });
    const [data, total] = await this.prisma.$transaction([
      this.prisma.reportExport.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, nit: true } },
          requestedBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.reportExport.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async metrics(user: AuthenticatedUser, query: ReportExportsQueryDto) {
    await this.expireOldExports();
    const where = this.buildExportsWhere(user, query, {
      includeSearch: true,
      includeStatusFilter: false,
    });
    const metrics = await this.computeExportMetrics(where);
    // Los exportes de plataforma (sin empresa) solo son visibles para SUPER_ADMIN.
    if (user.role !== 'SUPER_ADMIN') {
      const platformTotals = await this.computeExportMetrics({
        ...where,
        companyId: null,
      });
      metrics.totals = {
        total: metrics.totals.total - platformTotals.totals.total,
        queued: metrics.totals.queued - platformTotals.totals.queued,
        processing:
          metrics.totals.processing - platformTotals.totals.processing,
        ready: metrics.totals.ready - platformTotals.totals.ready,
        failed: metrics.totals.failed - platformTotals.totals.failed,
        expired: metrics.totals.expired - platformTotals.totals.expired,
        storageBytes:
          metrics.totals.storageBytes - platformTotals.totals.storageBytes,
        averageGenerationSeconds: metrics.totals.averageGenerationSeconds,
      };
    }
    return metrics;
  }

  async metricHistory(user: AuthenticatedUser, query: ReportExportsQueryDto) {
    const dateRange = this.requestedAtRange(query.dateFrom, query.dateTo);
    const companyId = resolveCompanyScope(user, query.companyId);
    const snapshots = await this.prisma.reportExportMetricSnapshot.findMany({
      where: {
        ...(companyId
          ? { companyId }
          : user.role === 'SUPER_ADMIN'
            ? {}
            : { companyId: null }),
        ...(dateRange ? { date: dateRange } : {}),
      },
      include: { company: { select: { id: true, name: true, nit: true } } },
      orderBy: { date: 'asc' },
      take: 60,
    });
    return snapshots;
  }

  async captureDailyMetricSnapshots(date = this.previousDayStart()) {
    const dayRange = {
      gte: date,
      lte: this.endOfDay(date.toISOString()),
    };
    const companies = await this.prisma.company.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const scopes: Array<{ scopeKey: string; companyId?: string }> = [
      { scopeKey: 'platform' },
      ...companies.map((company) => ({
        scopeKey: `company:${company.id}`,
        companyId: company.id,
      })),
    ];

    let written = 0;
    for (const scope of scopes) {
      const metrics = await this.computeExportMetrics({
        requestedAt: dayRange,
        ...(scope.companyId ? { companyId: scope.companyId } : {}),
      });
      await this.prisma.reportExportMetricSnapshot.upsert({
        where: { date_scopeKey: { date, scopeKey: scope.scopeKey } },
        create: {
          date,
          scopeKey: scope.scopeKey,
          companyId: scope.companyId,
          ...metrics.totals,
        },
        update: {
          companyId: scope.companyId,
          ...metrics.totals,
        },
      });
      written += 1;
    }

    await this.auditService.log({
      action: 'CAPTURE_REPORT_EXPORT_METRICS',
      entity: 'ReportExportMetricSnapshot',
      after: { date: date.toISOString().slice(0, 10), written },
    });
    return { success: true, date: date.toISOString().slice(0, 10), written };
  }

  async metricAlertCandidates(date = this.previousDayStart()) {
    if (!env.reportAlertsEnabled) {
      return [];
    }
    const snapshots = await this.prisma.reportExportMetricSnapshot.findMany({
      where: { date },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            reportFailureRateAlertPercent: true,
            reportStorageAlertBytes: true,
          },
        },
      },
      orderBy: { companyId: 'asc' },
    });

    return snapshots.flatMap((snapshot) => {
      const alerts: Array<{
        kind: MetricAlertKind;
        snapshotId: string;
        companyId: string | null;
        companyName: string;
        title: string;
        message: string;
      }> = [];
      const failureRate = snapshot.total
        ? Math.round((snapshot.failed / snapshot.total) * 100)
        : 0;
      const scopeName = snapshot.company?.name ?? 'Plataforma';
      const failureRateThreshold =
        snapshot.company?.reportFailureRateAlertPercent ??
        env.reportFailureRateAlertPercent;
      const storageThreshold =
        snapshot.company?.reportStorageAlertBytes ??
        env.reportStorageAlertBytes;
      if (
        snapshot.total > 0 &&
        failureRateThreshold > 0 &&
        failureRate >= failureRateThreshold
      ) {
        alerts.push({
          kind: 'FAILURE_RATE',
          snapshotId: snapshot.id,
          companyId: snapshot.companyId,
          companyName: scopeName,
          title: 'Alerta por fallos en reportes',
          message: `${scopeName}: tasa de fallos ${failureRate}% (${snapshot.failed}/${snapshot.total}); umbral ${failureRateThreshold}%`,
        });
      }
      if (storageThreshold > 0 && snapshot.storageBytes >= storageThreshold) {
        alerts.push({
          kind: 'STORAGE',
          snapshotId: snapshot.id,
          companyId: snapshot.companyId,
          companyName: scopeName,
          title: 'Alerta por almacenamiento de reportes',
          message: `${scopeName}: ${snapshot.storageBytes} bytes usados en reportes generados; umbral ${storageThreshold} bytes`,
        });
      }
      return alerts;
    });
  }

  async metricAlertTargets(companyId?: string | null) {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(companyId
          ? {
              OR: [
                { role: Role.ADMIN, companyId: null },
                { role: Role.ADMIN, companyId },
                { role: Role.SST, companyId },
              ],
            }
          : { role: Role.ADMIN }),
      },
      select: { id: true, companyId: true, role: true },
    });
  }

  async logMetricAlertEvaluation(input: {
    date: string;
    alerts: number;
    notifications: number;
  }) {
    await this.auditService.log({
      action: 'EVALUATE_REPORT_EXPORT_ALERTS',
      entity: 'ReportExportMetricSnapshot',
      after: input,
    });
  }

  private async computeExportMetrics(where: Prisma.ReportExportWhereInput) {
    const records = await this.prisma.reportExport.findMany({
      where,
      select: {
        status: true,
        companyId: true,
        kind: true,
        size: true,
        startedAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const companyIds = Array.from(
      new Set(
        records
          .map((item) => item.companyId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const companies = companyIds.length
      ? await this.prisma.company.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, name: true },
        })
      : [];
    const companyNameById = new Map(
      companies.map((item) => [item.id, item.name]),
    );
    const statusCountByKey = new Map<ReportExportStatus, number>();
    const companyTotals = new Map<
      string,
      { companyId: string | null; total: number; storageBytes: number }
    >();
    const failuresByKind = new Map<string, number>();
    let totalStorageBytes = 0;
    let totalGenerationMs = 0;
    let timedCount = 0;

    for (const item of records) {
      statusCountByKey.set(
        item.status,
        (statusCountByKey.get(item.status) ?? 0) + 1,
      );
      const companyKey = item.companyId ?? 'none';
      const currentCompany = companyTotals.get(companyKey) ?? {
        companyId: item.companyId,
        total: 0,
        storageBytes: 0,
      };
      currentCompany.total += 1;
      currentCompany.storageBytes += item.size ?? 0;
      companyTotals.set(companyKey, currentCompany);

      if (item.status === ReportExportStatus.FAILED) {
        failuresByKind.set(item.kind, (failuresByKind.get(item.kind) ?? 0) + 1);
      }
      totalStorageBytes += item.size ?? 0;
      if (item.startedAt && item.completedAt) {
        totalGenerationMs += Math.max(
          item.completedAt.getTime() - item.startedAt.getTime(),
          0,
        );
        timedCount += 1;
      }
    }

    const averageGenerationSeconds = timedCount
      ? Math.round(totalGenerationMs / timedCount / 1000)
      : 0;

    return {
      totals: {
        total: records.length,
        queued: statusCountByKey.get(ReportExportStatus.QUEUED) ?? 0,
        processing: statusCountByKey.get(ReportExportStatus.PROCESSING) ?? 0,
        ready: statusCountByKey.get(ReportExportStatus.READY) ?? 0,
        failed: statusCountByKey.get(ReportExportStatus.FAILED) ?? 0,
        expired: statusCountByKey.get(ReportExportStatus.EXPIRED) ?? 0,
        storageBytes: totalStorageBytes,
        averageGenerationSeconds,
      },
      byCompany: Array.from(companyTotals.values())
        .map((item) => ({
          companyId: item.companyId,
          companyName: item.companyId
            ? (companyNameById.get(item.companyId) ?? 'Empresa no encontrada')
            : 'Sin empresa',
          total: item.total,
          storageBytes: item.storageBytes,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
      failuresByKind: Array.from(failuresByKind.entries())
        .map(([kind, failed]) => ({ kind, failed }))
        .sort((a, b) => b.failed - a.failed),
    };
  }

  async createExport(input: {
    user: AuthenticatedUser;
    kind: string;
    format: ReportFormat;
    companyId?: string;
  }) {
    this.assertReportKind(input.kind);
    this.assertReportFormat(input.format);
    const companyId = this.auditCompanyId(input.user, input.companyId);
    return this.prisma.reportExport.create({
      data: {
        kind: input.kind,
        format: input.format,
        requestedCompanyId: input.companyId,
        companyId,
        requestedById: input.user.sub,
        status: ReportExportStatus.QUEUED,
        expiresAt: await this.defaultExpiration(companyId),
      },
    });
  }

  async prepareRetry(user: AuthenticatedUser, id: string) {
    const current = await this.findOwnedExport(user, id);
    if (
      current.status !== ReportExportStatus.FAILED &&
      current.status !== ReportExportStatus.EXPIRED
    ) {
      throw new BadRequestException(
        'Only failed or expired report exports can be retried',
      );
    }
    return this.prisma.reportExport.update({
      where: { id },
      data: {
        status: ReportExportStatus.QUEUED,
        fileUrl: null,
        fileName: null,
        mimeType: null,
        storageKey: null,
        size: null,
        jobId: null,
        error: null,
        startedAt: null,
        completedAt: null,
        expiresAt: await this.defaultExpiration(current?.companyId),
      },
    });
  }

  async getDownloadableExport(user: AuthenticatedUser, id: string) {
    const reportExport = await this.findOwnedExport(user, id);
    if (
      reportExport.status !== ReportExportStatus.READY ||
      !reportExport.storageKey ||
      !reportExport.fileName
    ) {
      throw new BadRequestException(
        'Report export is not available for download',
      );
    }
    return reportExport;
  }

  async getExportForProcessing(user: AuthenticatedUser, id: string) {
    const reportExport = await this.prisma.reportExport.findUnique({
      where: { id },
    });
    // El exporte pertenece a quien lo solicitó; para SUPER_ADMIN se exige que la empresa
    // del exporte coincida con la empresa activa seleccionada (o que no tenga empresa,
    // exportes de plataforma).
    const activeCompany =
      user.role === 'SUPER_ADMIN' ? (user.activeCompanyId ?? null) : null;
    const ownershipValid =
      reportExport &&
      reportExport.requestedById === user.sub &&
      !!reportExport.companyId &&
      (user.role !== 'SUPER_ADMIN' || reportExport.companyId === activeCompany);
    if (!ownershipValid) {
      throw new BadRequestException(
        'Report export is not available for processing',
      );
    }
    const companyId = resolveCompanyScope(user, reportExport.companyId);
    return { reportExport, companyId };
  }

  async markExportQueued(id: string, jobId?: string) {
    return this.prisma.reportExport.update({
      where: { id },
      data: { status: ReportExportStatus.QUEUED, jobId },
    });
  }

  async markExportProcessing(id: string, jobId?: string) {
    return this.prisma.reportExport.update({
      where: { id },
      data: {
        status: ReportExportStatus.PROCESSING,
        startedAt: new Date(),
        jobId,
      },
    });
  }

  async markExportReady(
    id: string,
    stored: {
      fileUrl: string;
      fileName: string;
      mimeType: string;
      size: number;
      storageKey?: string;
    },
  ) {
    const current = await this.prisma.reportExport.findUnique({
      where: { id },
      select: { companyId: true },
    });
    return this.prisma.reportExport.update({
      where: { id },
      data: {
        status: ReportExportStatus.READY,
        fileUrl: stored.fileUrl,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        size: stored.size,
        storageKey: stored.storageKey,
        completedAt: new Date(),
        expiresAt: await this.defaultExpiration(current?.companyId),
        error: null,
      },
    });
  }

  async markExportFailed(id: string, error: unknown) {
    return this.prisma.reportExport.update({
      where: { id },
      data: {
        status: ReportExportStatus.FAILED,
        error: this.errorMessage(error),
        completedAt: new Date(),
      },
    });
  }

  async cleanupExpiredExports(
    deleteFile: (storageKey: string) => Promise<unknown>,
  ) {
    await this.expireOldExports();
    const retentionCutoff = new Date(
      Date.now() -
        Math.max(env.reportExportRetentionDays, 0) * 24 * 60 * 60 * 1000,
    );
    const expiredExports = await this.prisma.reportExport.findMany({
      where: {
        status: ReportExportStatus.EXPIRED,
        storageKey: { not: null },
      },
      select: { id: true, storageKey: true },
      take: 100,
    });

    let deleted = 0;
    let failed = 0;
    const deletedIds: string[] = [];
    for (const reportExport of expiredExports) {
      if (!reportExport.storageKey) continue;
      if (!(await this.isPastRetention(reportExport.id, retentionCutoff)))
        continue;
      try {
        await deleteFile(reportExport.storageKey);
        deleted += 1;
        deletedIds.push(reportExport.id);
      } catch {
        failed += 1;
      }
    }

    if (deletedIds.length > 0) {
      await this.prisma.reportExport.updateMany({
        where: { id: { in: deletedIds } },
        data: {
          fileUrl: null,
          storageKey: null,
          size: null,
        },
      });
    }

    await this.auditService.log({
      action: 'CLEANUP_EXPIRED_REPORT_EXPORTS',
      entity: 'ReportExport',
      after: {
        scanned: expiredExports.length,
        deleted,
        failed,
        retentionDays: env.reportExportRetentionDays,
      },
    });

    return { success: true, scanned: expiredExports.length, deleted, failed };
  }

  logExport(input: {
    user: AuthenticatedUser;
    kind: string;
    format: ReportFormat;
    requestedCompanyId?: string;
    request: Request;
    status: 'SUCCESS' | 'FAILED';
    error?: unknown;
  }) {
    return this.auditService.log({
      user: input.user,
      action: input.status === 'SUCCESS' ? 'EXPORT' : 'EXPORT_FAILED',
      entity: 'Report',
      entityId: input.kind,
      after: {
        kind: input.kind,
        format: input.format,
        status: input.status,
        companyId: this.auditCompanyId(input.user, input.requestedCompanyId),
        requestedCompanyId: input.requestedCompanyId ?? null,
        ip: input.request.ip,
        userAgent: input.request.get('user-agent') ?? '',
        error: input.error ? this.errorMessage(input.error) : null,
      },
    });
  }

  logScheduledExport(input: {
    user: AuthenticatedUser;
    kind: string;
    format: ReportFormat;
    requestedCompanyId?: string;
    status: 'QUEUED' | 'READY' | 'FAILED';
    jobId?: string;
    fileUrl?: string;
    error?: unknown;
  }) {
    return this.auditService.log({
      user: input.user,
      action:
        input.status === 'QUEUED'
          ? 'EXPORT_QUEUED'
          : input.status === 'READY'
            ? 'EXPORT_READY'
            : 'EXPORT_FAILED',
      entity: 'Report',
      entityId: input.kind,
      after: {
        kind: input.kind,
        format: input.format,
        status: input.status,
        jobId: input.jobId ?? null,
        fileUrl: input.fileUrl ?? null,
        companyId: this.auditCompanyId(input.user, input.requestedCompanyId),
        requestedCompanyId: input.requestedCompanyId ?? null,
        error: input.error ? this.errorMessage(input.error) : null,
      },
    });
  }

  private async getRows(
    user: AuthenticatedUser,
    kind: ReportKind,
    companyId?: string,
  ) {
    const scopedCompanyId = this.resolveCompanyId(user, companyId);
    const companyScope = scopedCompanyId ? { companyId: scopedCompanyId } : {};

    if (kind === 'employees') {
      const employees = await this.prisma.employee.findMany({
        where: { ...companyScope, isActive: true },
        include: { company: { select: { name: true, nit: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return employees.map((item) => ({
        empresa: item.company.name,
        nit: item.company.nit,
        empleado: `${item.firstName} ${item.lastName}`,
        documento: item.document,
        cargo: item.position,
        centroTrabajo: item.workCenter ?? '',
        estado: item.employmentStatus,
      }));
    }

    if (kind === 'expired-documents') {
      const now = new Date();
      const documents = await this.prisma.document.findMany({
        where: { ...companyScope, isActive: true, expiresAt: { lt: now } },
        include: { company: { select: { name: true, nit: true } } },
        orderBy: { expiresAt: 'asc' },
      });
      return documents.map((item) => ({
        empresa: item.company.name,
        nit: item.company.nit,
        documento: item.name,
        categoria: item.category,
        estado: item.status,
        vencimiento: item.expiresAt?.toISOString().slice(0, 10) ?? '',
        version: item.version,
      }));
    }

    if (kind === 'audits') {
      const audits = await this.prisma.audit.findMany({
        where: { ...companyScope, isActive: true },
        include: {
          company: { select: { name: true, nit: true } },
          findings: { include: { actions: true } },
        },
        orderBy: { scheduledAt: 'desc' },
      });
      return audits.map((item) => ({
        empresa: item.company.name,
        nit: item.company.nit,
        auditoria: item.title,
        estado: item.status,
        auditor: item.auditorName ?? '',
        fecha: item.scheduledAt.toISOString().slice(0, 10),
        hallazgos: item.findings.length,
        acciones: item.findings.reduce(
          (total, finding) => total + finding.actions.length,
          0,
        ),
      }));
    }

    const [employees, criticalRisks, openIncidents, expiredDocuments, audits] =
      await this.prisma.$transaction([
        this.prisma.employee.count({
          where: { ...companyScope, isActive: true },
        }),
        this.prisma.risk.count({
          where: { ...companyScope, level: RiskLevel.CRITICAL },
        }),
        this.prisma.incident.count({
          where: { ...companyScope, status: { not: IncidentStatus.RESOLVED } },
        }),
        this.prisma.document.count({
          where: {
            ...companyScope,
            isActive: true,
            expiresAt: { lt: new Date() },
          },
        }),
        this.prisma.audit.count({ where: { ...companyScope, isActive: true } }),
      ]);
    return [
      {
        empleadosActivos: employees,
        riesgosCriticos: criticalRisks,
        incidentesAbiertos: openIncidents,
        documentosVencidos: expiredDocuments,
        auditoriasActivas: audits,
      },
    ];
  }

  private resolveCompanyId(user: AuthenticatedUser, companyId?: string) {
    return resolveCompanyScope(user, companyId);
  }

  private auditCompanyId(user: AuthenticatedUser, requestedCompanyId?: string) {
    return resolveCompanyScope(user, requestedCompanyId);
  }

  private assertReportKind(kind: string): asserts kind is ReportKind {
    if (!reportKinds.includes(kind as ReportKind)) {
      throw new BadRequestException('Unsupported report type');
    }
  }

  private assertReportFormat(format: string): asserts format is ReportFormat {
    if (!reportFormats.includes(format as ReportFormat)) {
      throw new BadRequestException('Unsupported report format');
    }
  }

  private async findOwnedExport(user: AuthenticatedUser, id: string) {
    const reportExport = await this.prisma.reportExport.findUnique({
      where: { id },
    });
    if (!reportExport || !this.canAccessExport(user, reportExport)) {
      throw new BadRequestException('Report export not found');
    }
    return reportExport;
  }

  private async expireOldExports() {
    await this.prisma.reportExport.updateMany({
      where: {
        status: ReportExportStatus.READY,
        expiresAt: { lt: new Date() },
      },
      data: { status: ReportExportStatus.EXPIRED },
    });
  }

  private async defaultExpiration(companyId?: string | null) {
    const company = companyId
      ? await this.prisma.company.findUnique({
          where: { id: companyId },
          select: { reportExportExpirationDays: true },
        })
      : null;
    const days =
      company?.reportExportExpirationDays ?? env.reportExportExpirationDays;
    return new Date(Date.now() + Math.max(days, 1) * 24 * 60 * 60 * 1000);
  }

  private statusSearch(search: string) {
    const upper = search.toUpperCase();
    return Object.values(ReportExportStatus).includes(
      upper as ReportExportStatus,
    )
      ? (upper as ReportExportStatus)
      : undefined;
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private exportVisibilityWhere(
    user: AuthenticatedUser,
  ): Prisma.ReportExportWhereInput {
    if (user.role === 'SUPER_ADMIN') {
      return user.activeCompanyId ? { companyId: user.activeCompanyId } : {};
    }
    return { requestedById: user.sub };
  }

  private buildExportsWhere(
    user: AuthenticatedUser,
    query: ReportExportsQueryDto,
    options: ExportWhereBuildOptions,
  ): Prisma.ReportExportWhereInput {
    const search = query.search?.trim();
    const statusFromSearch = search ? this.statusSearch(search) : undefined;
    const dateRange = this.requestedAtRange(query.dateFrom, query.dateTo);
    return {
      ...this.exportVisibilityWhere(user),
      ...(options.includeStatusFilter && query.status
        ? { status: query.status as ReportExportStatus }
        : {}),
      ...(this.canFilterCompany(user) && query.companyId
        ? { companyId: query.companyId }
        : {}),
      ...(this.canFilterRequester(user) && query.requestedById
        ? { requestedById: query.requestedById }
        : {}),
      ...(dateRange ? { requestedAt: dateRange } : {}),
      ...(options.includeSearch && search
        ? {
            OR: [
              { kind: { contains: search, mode: 'insensitive' } },
              { format: { contains: search, mode: 'insensitive' } },
              ...(statusFromSearch
                ? [{ status: { equals: statusFromSearch } }]
                : []),
              { fileName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private canFilterCompany(user: AuthenticatedUser) {
    return user.role === 'SUPER_ADMIN';
  }

  private canFilterRequester(user: AuthenticatedUser) {
    return user.role === 'SUPER_ADMIN';
  }

  private canAccessExport(
    user: AuthenticatedUser,
    reportExport: { requestedById: string; companyId: string | null },
  ) {
    if (reportExport.requestedById === user.sub) return true;
    if (user.role !== 'SUPER_ADMIN') return false;
    return user.activeCompanyId
      ? reportExport.companyId === user.activeCompanyId
      : true;
  }

  private async isPastRetention(id: string, defaultRetentionCutoff: Date) {
    const reportExport = await this.prisma.reportExport.findUnique({
      where: { id },
      select: {
        expiresAt: true,
        company: { select: { reportExportRetentionDays: true } },
      },
    });
    if (!reportExport?.expiresAt) return false;
    const retentionDays =
      reportExport.company?.reportExportRetentionDays ??
      env.reportExportRetentionDays;
    const cutoff = new Date(
      Date.now() - Math.max(retentionDays, 0) * 24 * 60 * 60 * 1000,
    );
    return (
      reportExport.expiresAt <
      (reportExport.company ? cutoff : defaultRetentionCutoff)
    );
  }

  private requestedAtRange(
    dateFrom?: string,
    dateTo?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!dateFrom && !dateTo) return undefined;
    return {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: this.endOfDay(dateTo) } : {}),
    };
  }

  private endOfDay(value: string) {
    const date = new Date(value);
    date.setUTCHours(23, 59, 59, 999);
    return date;
  }

  private previousDayStart() {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 1);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private toCsv(rows: Array<Record<string, unknown>>) {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => this.escapeCsv(row[header])).join(','),
      ),
    ];
    return lines.join('\n');
  }

  /** Convierte un valor a texto plano evitando '[object Object]' en reportes. */
  private toText(value: unknown) {
    if (value === null || value === undefined) return '';
    switch (typeof value) {
      case 'string':
        return value;
      case 'number':
      case 'boolean':
        return String(value);
      case 'bigint':
      case 'symbol':
        return value.toString();
      case 'function':
        return value.name || '[function]';
      default:
        return JSON.stringify(value);
    }
  }

  private escapeCsv(value: unknown) {
    const text = this.toText(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  private toPdf(title: string, rows: Array<Record<string, unknown>>) {
    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text(title);
      doc.fontSize(10).text(`Generado: ${new Date().toISOString()}`);
      doc.moveDown();

      if (rows.length === 0) {
        doc.text('Sin datos para el reporte.');
      } else {
        rows.forEach((row, index) => {
          doc
            .fontSize(12)
            .text(
              `${index + 1}. ${Object.values(row).slice(0, 2).join(' - ')}`,
            );
          doc.fontSize(9);
          Object.entries(row).forEach(([key, value]) => {
            doc.text(`${key}: ${this.toText(value)}`);
          });
          doc.moveDown();
        });
      }
      doc.end();
    });
  }

  private reportTitle(kind: ReportKind) {
    const titles: Record<ReportKind, string> = {
      employees: 'Reporte de empleados',
      'expired-documents': 'Reporte de documentos vencidos',
      audits: 'Reporte de auditorias SG-SST',
      summary: 'Resumen ejecutivo SG-SST',
    };
    return titles[kind];
  }
}
