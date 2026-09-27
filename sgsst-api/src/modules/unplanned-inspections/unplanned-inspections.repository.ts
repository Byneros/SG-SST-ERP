import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateCorrectiveActionDto,
  CreateUnplannedFindingDto,
  CreateUnplannedInspectionDto,
  UpdateUnplannedFindingDto,
  UpdateUnplannedInspectionDto,
} from './dto/unplanned-inspection.dto';

const unplannedInclude = {
  company: { select: { id: true, name: true, nit: true } },
  site: { select: { id: true, name: true, code: true } },
  inspector: { select: { id: true, name: true, email: true } },
  findings: {
    include: {
      action: true,
      risk: { select: { id: true, title: true, level: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.UnplannedInspectionInclude;

@Injectable()
export class UnplannedInspectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, siteId?: string) {
    return this.prisma.unplannedInspection.findMany({
      where: {
        companyId,
        ...(siteId ? (siteId === 'none' ? { siteId: null } : { siteId }) : {}),
      },
      include: unplannedInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  findByIdScoped(id: string, companyId: string) {
    return this.prisma.unplannedInspection.findFirst({
      where: { id, companyId },
      include: unplannedInclude,
    });
  }

  create(dto: CreateUnplannedInspectionDto, companyId: string) {
    return this.prisma.unplannedInspection.create({
      data: {
        title: dto.title,
        reason: dto.reason,
        area: dto.area,
        status: dto.status,
        executedAt: dto.executedAt ? new Date(dto.executedAt) : null,
        result: dto.result,
        siteId: dto.siteId ?? null,
        inspectorId: dto.inspectorId ?? null,
        companyId,
      },
      include: unplannedInclude,
    });
  }

  /** Update restrictivo por empresa (defensa en profundidad). */
  async updateScoped(
    id: string,
    companyId: string,
    dto: UpdateUnplannedInspectionDto,
  ) {
    const result = await this.prisma.unplannedInspection.updateMany({
      where: { id, companyId },
      data: {
        title: dto.title,
        reason: dto.reason,
        area: dto.area,
        status: dto.status,
        executedAt:
          dto.executedAt === undefined
            ? undefined
            : dto.executedAt
              ? new Date(dto.executedAt)
              : null,
        result: dto.result,
        siteId: dto.siteId === undefined ? undefined : dto.siteId,
        inspectorId:
          dto.inspectorId === undefined ? undefined : dto.inspectorId,
      },
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
    await this.prisma.unplannedInspection.delete({ where: { id } });
    return before;
  }

  createFinding(
    unplannedInspectionId: string,
    dto: CreateUnplannedFindingDto,
    riskId?: string,
  ) {
    return this.prisma.inspectionFinding.create({
      data: {
        unplannedInspectionId,
        description: dto.description,
        severity: dto.severity,
        riskId,
      },
      include: {
        action: true,
        risk: { select: { id: true, title: true, level: true } },
      },
    });
  }

  findFindingByIdScoped(findingId: string, companyId: string) {
    return this.prisma.inspectionFinding.findFirst({
      where: { id: findingId, unplannedInspection: { companyId } },
      include: {
        action: true,
        risk: { select: { id: true, title: true, level: true } },
        unplannedInspection: { select: { id: true, companyId: true } },
      },
    });
  }

  updateFinding(findingId: string, dto: UpdateUnplannedFindingDto) {
    return this.prisma.inspectionFinding.update({
      where: { id: findingId },
      data: {
        description: dto.description,
        severity: dto.severity,
        status: dto.status,
      },
      include: {
        action: true,
        risk: { select: { id: true, title: true, level: true } },
      },
    });
  }

  createRisk(dto: {
    title: string;
    description?: string;
    level: string;
    companyId: string;
    siteId?: string | null;
  }) {
    return this.prisma.risk.create({
      data: {
        title: dto.title,
        description: dto.description,
        level: dto.level as never,
        companyId: dto.companyId,
        siteId: dto.siteId ?? null,
      },
    });
  }

  /** La accion nace del hallazgo de inspeccion: se enlaza por su lado (actionId). */
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
