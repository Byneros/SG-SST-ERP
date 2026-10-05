import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateFindingCauseDto,
  CreateFindingDto,
  FindingsListQueryDto,
  UpdateFindingDto,
} from './dto/finding.dto';

const findingInclude = {
  owner: { select: { id: true, name: true, email: true } },
  company: { select: { id: true, name: true } },
  causes: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.FindingInclude;

@Injectable()
export class FindingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Listado -----------------------------------------------------------------

  async findMany(companyId: string, query: FindingsListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.FindingWhereInput = {
      companyId,
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
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
    // Orden: severidad desc (CRITICAL primero) y luego mas recientes.
    const [data, total] = await this.prisma.$transaction([
      this.prisma.finding.findMany({
        where,
        include: findingInclude,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.finding.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findByIdScoped(id: string, companyId: string) {
    return this.prisma.finding.findFirst({
      where: { id, companyId },
      include: findingInclude,
    });
  }

  // --- Mutaciones --------------------------------------------------------------

  create(dto: CreateFindingDto, companyId: string) {
    return this.prisma.finding.create({
      data: {
        title: dto.title,
        description: dto.description,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId ?? null,
        type: dto.type ?? 'NON_CONFORMITY',
        severity: dto.severity ?? 'MINOR',
        ownerId: dto.ownerId ?? null,
        companyId,
      },
      include: findingInclude,
    });
  }

  async updateScoped(id: string, companyId: string, dto: UpdateFindingDto) {
    const data: Prisma.FindingUncheckedUpdateInput = {
      title: dto.title,
      description: dto.description,
      type: dto.type,
      severity: dto.severity,
      ownerId: dto.ownerId === undefined ? undefined : dto.ownerId,
      status: dto.status,
      // Cierre: sella la fecha de cierre (patron de unsafe-reports).
      closedAt:
        dto.status === 'CLOSED'
          ? new Date()
          : dto.status === undefined
            ? undefined
            : null,
    };
    const result = await this.prisma.finding.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) {
      return null;
    }
    return this.findByIdScoped(id, companyId);
  }

  /** Hard delete con traza (ADR); las causas caen por cascada. */
  async removeScoped(id: string, companyId: string) {
    const before = await this.findByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.finding.delete({ where: { id } });
    return before;
  }

  // --- Causas ------------------------------------------------------------------

  createCause(findingId: string, dto: CreateFindingCauseDto) {
    return this.prisma.findingCause.create({
      data: {
        findingId,
        causeType: dto.causeType,
        description: dto.description,
      },
    });
  }

  findCauseByIdScoped(causeId: string, findingId: string, companyId: string) {
    return this.prisma.findingCause.findFirst({
      where: { id: causeId, findingId, finding: { companyId } },
    });
  }

  removeCause(causeId: string) {
    return this.prisma.findingCause.delete({ where: { id: causeId } });
  }
}
