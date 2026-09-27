import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateCorrectiveActionDto,
  CreateInspectionFindingDto,
  CreatePlannedInspectionDto,
  UpdateInspectionFindingDto,
  UpdateInspectionItemDto,
  UpdatePlannedInspectionDto,
} from './dto/planned-inspection.dto';

const inspectionInclude = {
  company: { select: { id: true, name: true, nit: true } },
  site: { select: { id: true, name: true, code: true } },
  inspector: { select: { id: true, name: true, email: true } },
  items: {
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  },
  findings: {
    include: { action: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.PlannedInspectionInclude;

@Injectable()
export class PlannedInspectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, siteId?: string) {
    return this.prisma.plannedInspection.findMany({
      where: {
        companyId,
        ...(siteId ? (siteId === 'none' ? { siteId: null } : { siteId }) : {}),
      },
      include: inspectionInclude,
      orderBy: { scheduledAt: 'desc' },
    });
  }

  findByIdScoped(id: string, companyId: string) {
    return this.prisma.plannedInspection.findFirst({
      where: { id, companyId },
      include: inspectionInclude,
    });
  }

  findByYear(companyId: string, year: number) {
    return this.prisma.plannedInspection.findFirst({
      where: {
        companyId,
        scheduledAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
      include: inspectionInclude,
    });
  }

  create(dto: CreatePlannedInspectionDto, companyId: string) {
    return this.prisma.plannedInspection.create({
      data: {
        title: dto.title,
        type: dto.type,
        frequency: dto.frequency,
        scheduledAt: new Date(dto.scheduledAt),
        status: dto.status,
        siteId: dto.siteId ?? null,
        inspectorId: dto.inspectorId ?? null,
        companyId,
        items: dto.items?.length
          ? {
              create: dto.items.map((item, index) => ({
                order: item.order ?? index,
                section: item.section,
                question: item.question,
              })),
            }
          : undefined,
      },
      include: inspectionInclude,
    });
  }

  /** Update restrictivo por empresa (defensa en profundidad). */
  async updateScoped(
    id: string,
    companyId: string,
    dto: UpdatePlannedInspectionDto,
  ) {
    const result = await this.prisma.plannedInspection.updateMany({
      where: { id, companyId },
      data: {
        title: dto.title,
        type: dto.type,
        frequency: dto.frequency,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        executedAt:
          dto.executedAt === undefined
            ? undefined
            : dto.executedAt
              ? new Date(dto.executedAt)
              : null,
        result: dto.result === undefined ? undefined : dto.result,
        status: dto.status,
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

  /** Hard delete con traza (ADR): devuelve el snapshot previo o null. */
  async removeScoped(id: string, companyId: string) {
    const before = await this.findByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.plannedInspection.delete({ where: { id } });
    return before;
  }

  /** Item del checklist: solo existe si su inspeccion es de la empresa. */
  findItemByIdScoped(itemId: string, companyId: string) {
    return this.prisma.inspectionItem.findFirst({
      where: { id: itemId, inspection: { companyId } },
      include: { inspection: { select: { id: true, companyId: true } } },
    });
  }

  async updateItemScoped(
    itemId: string,
    companyId: string,
    dto: UpdateInspectionItemDto,
  ) {
    const result = await this.prisma.inspectionItem.updateMany({
      where: { id: itemId, inspection: { companyId } },
      data: {
        answer: dto.answer === undefined ? undefined : dto.answer,
        notes: dto.notes === undefined ? undefined : dto.notes,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findItemByIdScoped(itemId, companyId);
  }

  /** Agrega preguntas al checklist de una inspeccion existente. */
  addItems(inspectionId: string, questions: string[]) {
    return this.prisma.$transaction(
      questions.map((question, index) =>
        this.prisma.inspectionItem.create({
          data: {
            inspectionId,
            question,
            order: index,
          },
        }),
      ),
    );
  }

  createFinding(inspectionId: string, dto: CreateInspectionFindingDto) {
    return this.prisma.inspectionFinding.create({
      data: {
        inspectionId,
        description: dto.description,
        severity: dto.severity,
      },
      include: { action: true },
    });
  }

  findFindingByIdScoped(findingId: string, companyId: string) {
    return this.prisma.inspectionFinding.findFirst({
      where: { id: findingId, inspection: { companyId } },
      include: {
        action: true,
        inspection: { select: { id: true, companyId: true } },
      },
    });
  }

  updateFinding(findingId: string, dto: UpdateInspectionFindingDto) {
    return this.prisma.inspectionFinding.update({
      where: { id: findingId },
      data: {
        description: dto.description,
        severity: dto.severity,
        status: dto.status,
      },
      include: { action: true },
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
