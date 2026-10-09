import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../database/prisma.service';
import { CreateCorrectiveActionDto } from './dto/create-corrective-action.dto';
import { CreateFindingDto } from './dto/create-finding.dto';
import { CreateSgsstAuditDto } from './dto/create-sgsst-audit.dto';
import { UpdateCorrectiveActionDto } from './dto/update-corrective-action.dto';
import { UpdateFindingDto } from './dto/update-finding.dto';
import { UpdateSgsstAuditDto } from './dto/update-sgsst-audit.dto';
import { CreateAuditProgramDto } from './dto/create-audit-program.dto';
import { ReplaceAuditChecklistDto } from './dto/replace-audit-checklist.dto';
import { UpdateAuditProgramDto } from './dto/update-audit-program.dto';
import { UpdateAuditChecklistItemDto } from './dto/update-audit-checklist-item.dto';

const auditInclude = {
  company: { select: { id: true, name: true, nit: true } },
  program: { select: { id: true, name: true, period: true } },
  findings: {
    include: { actions: true },
    orderBy: { createdAt: 'desc' as const },
  },
  checklist: {
    orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }],
  },
};

@Injectable()
export class SgsstAuditsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId?: string, query: ListQueryDto = new ListQueryDto()) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.AuditWhereInput = {
      companyId,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { scope: { contains: search, mode: 'insensitive' } },
              { auditorName: { contains: search, mode: 'insensitive' } },
              { company: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.audit.findMany({
        where,
        include: auditInclude,
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.audit.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findById(id: string) {
    return this.prisma.audit.findUnique({
      where: { id },
      include: auditInclude,
    });
  }

  create(dto: CreateSgsstAuditDto) {
    return this.prisma.audit.create({
      data: this.toAuditData(dto) as Prisma.AuditUncheckedCreateInput,
    });
  }

  update(id: string, dto: UpdateSgsstAuditDto) {
    return this.prisma.audit.update({
      where: { id },
      data: this.toAuditData(dto),
      include: { findings: { include: { actions: true } } },
    });
  }

  /** Borrado fisico; la cascada elimina findings, acciones y checklist (ADR de borrado). */
  remove(id: string) {
    return this.prisma.audit.delete({ where: { id } });
  }

  createFinding(auditId: string, dto: CreateFindingDto) {
    return this.prisma.auditFinding.create({
      data: {
        auditId,
        title: dto.title,
        description: dto.description,
        severity: dto.severity as never,
      },
      include: { actions: true },
    });
  }

  findFindingById(id: string) {
    return this.prisma.auditFinding.findUnique({
      where: { id },
      include: { audit: true, actions: true },
    });
  }

  /** Variante aislada: el hallazgo solo existe si su auditoría pertenece a la empresa del actor. */
  findFindingByIdScoped(id: string, companyId: string) {
    return this.prisma.auditFinding.findFirst({
      where: { id, audit: { companyId } },
      include: { audit: true, actions: true },
    });
  }

  updateFinding(id: string, dto: UpdateFindingDto) {
    return this.prisma.auditFinding.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        severity: dto.severity as never,
        status: dto.status as never,
      },
      include: { actions: true },
    });
  }

  createAction(findingId: string, dto: CreateCorrectiveActionDto) {
    return this.prisma.correctiveAction.create({
      data: {
        findingId,
        title: dto.title,
        description: dto.description,
        responsible: dto.responsible,
        dueDate: new Date(dto.dueDate),
      },
    });
  }

  findActionById(id: string) {
    return this.prisma.correctiveAction.findUnique({
      where: { id },
      include: { finding: { include: { audit: true } } },
    });
  }

  /** Variante aislada: la acción solo existe si la auditoría dueña pertenece a la empresa del actor. */
  findActionByIdScoped(id: string, companyId: string) {
    return this.prisma.correctiveAction.findFirst({
      where: { id, finding: { audit: { companyId } } },
      include: { finding: { include: { audit: true } } },
    });
  }

  updateAction(id: string, dto: UpdateCorrectiveActionDto) {
    return this.prisma.correctiveAction.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        responsible: dto.responsible,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status as never,
        closedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
      },
    });
  }

  // ----- FASE 7.1: programas de auditoría ---------------------------------

  findPrograms(companyId: string, query: ListQueryDto = new ListQueryDto()) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const search = query.search?.trim();
    const where: Prisma.AuditProgramWhereInput = {
      companyId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { objective: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.auditProgram.findMany({
      where,
      include: { _count: { select: { audits: true } } },
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  findProgramById(id: string) {
    return this.prisma.auditProgram.findUnique({
      where: { id },
      include: { _count: { select: { audits: true } } },
    });
  }

  /** Variante aislada: el programa solo existe si pertenece a la empresa del actor. */
  findProgramByIdScoped(id: string, companyId: string) {
    return this.prisma.auditProgram.findFirst({ where: { id, companyId } });
  }

  createProgram(dto: CreateAuditProgramDto) {
    return this.prisma.auditProgram.create({ data: dto });
  }

  updateProgram(id: string, dto: UpdateAuditProgramDto) {
    return this.prisma.auditProgram.update({
      where: { id },
      data: { ...dto },
    });
  }

  /** Borrado fisico del programa; las auditorias asociadas quedan huerfanas de programa. */
  removeProgram(id: string) {
    return this.prisma.auditProgram.delete({ where: { id } });
  }

  // ----- FASE 7.1: checklist por auditoría ---------------------------------

  findChecklist(auditId: string) {
    return this.prisma.auditChecklistItem.findMany({
      where: { auditId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Reemplaza el checklist completo en una transacción. */
  async replaceChecklist(auditId: string, dto: ReplaceAuditChecklistDto) {
    await this.prisma.$transaction(async (tx) => {
      await tx.auditChecklistItem.deleteMany({ where: { auditId } });
      if (dto.items.length > 0) {
        await tx.auditChecklistItem.createMany({
          data: dto.items.map((item, index) => ({
            auditId,
            order: item.order ?? index + 1,
            section: item.section,
            question: item.question,
          })),
        });
      }
    });
    return this.findChecklist(auditId);
  }

  findChecklistItemById(id: string) {
    return this.prisma.auditChecklistItem.findUnique({
      where: { id },
      include: { audit: { select: { id: true, companyId: true } } },
    });
  }

  updateChecklistItem(id: string, dto: UpdateAuditChecklistItemDto) {
    return this.prisma.auditChecklistItem.update({ where: { id }, data: dto });
  }

  // ----- FASE J1 (S16): agregaciones READ para el asistente de auditorías -----

  /** Resumen de auditorías por estado, con hallazgos abiertos por auditoría. */
  async summaryForAssistant(
    companyId: string,
    take = 10,
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    openFindings: number;
    audits: Array<{
      id: string;
      title: string;
      status: string;
      scheduledAt: Date;
      auditorName: string | null;
      findings: number;
      openActions: number;
    }>;
  }> {
    const takeCapped = Math.max(1, Math.min(Math.floor(take) || 10, 20));
    const [total, grouped, audits] = await Promise.all([
      this.prisma.audit.count({ where: { companyId } }),
      this.prisma.audit.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { _all: true },
      }),
      this.prisma.audit.findMany({
        where: { companyId },
        orderBy: { scheduledAt: 'desc' },
        take: takeCapped,
        select: {
          id: true,
          title: true,
          status: true,
          scheduledAt: true,
          auditorName: true,
          findings: {
            select: {
              id: true,
              status: true,
              actions: { select: { status: true } },
            },
          },
        },
      }),
    ]);
    const byStatus: Record<string, number> = {};
    for (const row of grouped) {
      byStatus[row.status] = row._count._all;
    }
    const openFindings = audits.reduce(
      (acc, audit) =>
        acc + audit.findings.filter((f) => f.status !== 'CLOSED').length,
      0,
    );
    return {
      total,
      byStatus,
      openFindings,
      audits: audits.map((audit) => ({
        id: audit.id,
        title: audit.title,
        status: audit.status,
        scheduledAt: audit.scheduledAt,
        auditorName: audit.auditorName,
        findings: audit.findings.length,
        openActions: audit.findings.reduce(
          (acc, finding) =>
            acc +
            finding.actions.filter((action) => action.status !== 'COMPLETED')
              .length,
          0,
        ),
      })),
    };
  }

  private toAuditData(dto: CreateSgsstAuditDto | UpdateSgsstAuditDto) {
    const closedAt = 'closedAt' in dto ? dto.closedAt : undefined;
    return {
      ...dto,
      status: dto.status as never,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      closedAt: closedAt ? new Date(closedAt) : undefined,
    };
  }
}
