import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  ActionsListQueryDto,
  AdvanceActionPlanDto,
  CreateActionPlanDto,
  UpdateActionPlanDto,
  VerifyActionPlanDto,
} from './dto/action-plan.dto';

const actionInclude = {
  owner: { select: { id: true, name: true, email: true } },
  verifiedBy: { select: { id: true, name: true, email: true } },
  evidence: { select: { id: true, name: true, status: true } },
  company: { select: { id: true, name: true } },
} satisfies Prisma.ActionPlanInclude;

@Injectable()
export class ActionPlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Listado -----------------------------------------------------------------

  async findMany(companyId: string, query: ActionsListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.ActionPlanWhereInput = {
      companyId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    // Orden: por vencimiento mas proximo primero dentro de cada estado activo.
    const [data, total] = await this.prisma.$transaction([
      this.prisma.actionPlan.findMany({
        where,
        include: actionInclude,
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.actionPlan.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findByIdScoped(id: string, companyId: string) {
    return this.prisma.actionPlan.findFirst({
      where: { id, companyId },
      include: actionInclude,
    });
  }

  // --- Mutaciones --------------------------------------------------------------

  create(dto: CreateActionPlanDto, companyId: string) {
    return this.prisma.actionPlan.create({
      data: {
        title: dto.title,
        description: dto.description,
        kind: dto.kind,
        sourceType: dto.sourceType ?? null,
        sourceId: dto.sourceId ?? null,
        rootCause: dto.rootCause,
        expectedBenefit: dto.expectedBenefit,
        ownerId: dto.ownerId ?? null,
        dueDate: new Date(dto.dueDate),
        companyId,
      },
      include: actionInclude,
    });
  }

  async updateScoped(id: string, companyId: string, dto: UpdateActionPlanDto) {
    const data: Prisma.ActionPlanUncheckedUpdateInput = {
      title: dto.title,
      description: dto.description,
      rootCause: dto.rootCause,
      expectedBenefit: dto.expectedBenefit,
      result: dto.result,
      ownerId: dto.ownerId === undefined ? undefined : dto.ownerId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      evidenceId: dto.evidenceId === undefined ? undefined : dto.evidenceId,
      // Cancelacion con sello de fecha (service valida la transicion).
      status: dto.status,
      closedAt: dto.status === 'CANCELLED' ? new Date() : undefined,
    };
    const result = await this.prisma.actionPlan.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) {
      return null;
    }
    return this.findByIdScoped(id, companyId);
  }

  /** Persiste la etapa del workflow (scoped por empresa). */
  async updateStatus(
    id: string,
    companyId: string,
    data: Prisma.ActionPlanUncheckedUpdateManyInput,
  ) {
    const result = await this.prisma.actionPlan.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) {
      return null;
    }
    return this.findByIdScoped(id, companyId);
  }

  /** Hard delete con traza (ADR). */
  async removeScoped(id: string, companyId: string) {
    const before = await this.findByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.actionPlan.delete({ where: { id } });
    return before;
  }

  /**
   * Asistente IA (fase G): acciones vencidas sin cerrar, la mas antigua
   * primero. Solo lectura y siempre scoped por companyId.
   */
  /**
   * Asistente IA (fase G): acciones abiertas/vencidas derivadas de
   * hallazgos (sourceType=FINDING), agrupadas por hallazgo. Solo lectura y
   * siempre scoped por companyId.
   */
  async countForFindingsAsistente(companyId: string, findingIds: string[]) {
    if (findingIds.length === 0) {
      return { findings: [] as Array<{ findingId: string; actions: Array<{
        status: string;
        dueDate: Date;
      }> }> };
    }
    const actions = await this.prisma.actionPlan.findMany({
      where: {
        companyId,
        sourceType: 'FINDING',
        sourceId: { in: findingIds },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      select: {
        id: true,
        sourceId: true,
        status: true,
        dueDate: true,
      },
    });
    const byFinding = new Map<
      string,
      Array<{ status: string; dueDate: Date }>
    >();
    for (const action of actions) {
      if (!action.sourceId) continue;
      const list = byFinding.get(action.sourceId) ?? [];
      list.push({ status: action.status, dueDate: action.dueDate });
      byFinding.set(action.sourceId, list);
    }
    return {
      findings: Array.from(byFinding.entries()).map(
        ([findingId, actionsOfFinding]) => ({ findingId, actions: actionsOfFinding }),
      ),
    };
  }

  findOverdueForAssistant(companyId: string, take: number) {
    return this.prisma.actionPlan.findMany({
      where: {
        companyId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        dueDate: { lt: new Date() },
      },
      select: {
        id: true,
        title: true,
        kind: true,
        status: true,
        dueDate: true,
        sourceType: true,
        sourceId: true,
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { dueDate: 'asc' },
      take,
    });
  }
}

export type { AdvanceActionPlanDto, VerifyActionPlanDto };
