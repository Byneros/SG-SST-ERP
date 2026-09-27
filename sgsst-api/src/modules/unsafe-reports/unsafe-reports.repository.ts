import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateCorrectiveActionDto,
  CreateUnsafeFindingDto,
  CreateUnsafeReportDto,
  UpdateUnsafeReportDto,
} from './dto/unsafe-report.dto';

const unsafeInclude = {
  company: { select: { id: true, name: true, nit: true } },
  site: { select: { id: true, name: true, code: true } },
  reporter: { select: { id: true, name: true, email: true } },
  findings: {
    include: { action: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.UnsafeReportInclude;

@Injectable()
export class UnsafeReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, kind?: string, status?: string) {
    return this.prisma.unsafeReport.findMany({
      where: {
        companyId,
        ...(kind && kind !== 'all' ? { kind } : {}),
        ...(status && status !== 'all' ? { status } : {}),
      },
      include: unsafeInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  findByIdScoped(id: string, companyId: string) {
    return this.prisma.unsafeReport.findFirst({
      where: { id, companyId },
      include: unsafeInclude,
    });
  }

  create(dto: CreateUnsafeReportDto, companyId: string, reporterId?: string) {
    return this.prisma.unsafeReport.create({
      data: {
        kind: dto.kind,
        description: dto.description,
        severity: dto.severity,
        area: dto.area,
        isAnonymous: dto.isAnonymous ?? false,
        // Anonimo: no se guarda el nombre declarado ni el reporter (trazabilidad
        // interna queda en AuditLog, el contenido del reporte no se expone).
        reporterName: dto.isAnonymous ? null : (dto.reporterName ?? null),
        reporterId: dto.isAnonymous ? null : (reporterId ?? null),
        siteId: dto.siteId ?? null,
        companyId,
      },
      include: unsafeInclude,
    });
  }

  async updateScoped(
    id: string,
    companyId: string,
    dto: UpdateUnsafeReportDto,
  ) {
    const data: Prisma.UnsafeReportUncheckedUpdateInput = {
      kind: dto.kind,
      description: dto.description,
      severity: dto.severity,
      area: dto.area,
      siteId: dto.siteId === undefined ? undefined : dto.siteId,
      status: dto.status,
      // Cierre: sella la fecha de cierre.
      closedAt:
        dto.status === 'CLOSED'
          ? new Date()
          : dto.status === undefined
            ? undefined
            : null,
    };
    const result = await this.prisma.unsafeReport.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) {
      return null;
    }
    return this.findByIdScoped(id, companyId);
  }

  /** Hard delete con traza (ADR); la cascada elimina sus hallazgos. */
  async removeScoped(id: string, companyId: string) {
    const before = await this.findByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.unsafeReport.delete({ where: { id } });
    return before;
  }

  createFinding(unsafeReportId: string, dto: CreateUnsafeFindingDto) {
    return this.prisma.inspectionFinding.create({
      data: {
        unsafeReportId,
        description: dto.description,
        severity: dto.severity,
      },
      include: { action: true },
    });
  }

  findFindingByIdScoped(findingId: string, companyId: string) {
    return this.prisma.inspectionFinding.findFirst({
      where: { id: findingId, unsafeReport: { companyId } },
      include: {
        action: true,
        unsafeReport: { select: { id: true, companyId: true } },
      },
    });
  }

  /** La accion nace del hallazgo del reporte: se enlaza por su lado (actionId). */
  createCorrectiveAction(findingId: string, dto: CreateCorrectiveActionDto) {
    return this.prisma.correctiveAction.create({
      data: {
        title: dto.title,
        description: dto.description,
        responsible: dto.responsible,
        dueDate: new Date(dto.dueDate),
        inspectionFinding: { connect: { id: findingId } },
      },
    });
  }
}
