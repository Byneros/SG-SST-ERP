import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  ChangeRequestListQueryDto,
  CreateChangeRequestDto,
  UpdateChangeRequestDto,
} from './dto/change-request.dto';

const changeRequestInclude = {
  risk: {
    select: { id: true, title: true, level: true },
  },
  approvedBy: {
    select: { id: true, name: true, email: true },
  },
  implementationEvidence: {
    select: { id: true, name: true, status: true },
  },
} satisfies Prisma.ChangeRequestInclude;

@Injectable()
export class ChangeRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Listado -----------------------------------------------------------------

  async findMany(companyId: string, query: ChangeRequestListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.ChangeRequestWhereInput = {
      companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { process: { contains: search, mode: 'insensitive' } },
              { responsible: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.changeRequest.findMany({
        where,
        include: changeRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.changeRequest.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findByIdScoped(id: string, companyId: string) {
    return this.prisma.changeRequest.findFirst({
      where: { id, companyId },
      include: changeRequestInclude,
    });
  }

  create(dto: CreateChangeRequestDto, companyId: string) {
    return this.prisma.changeRequest.create({
      data: {
        title: dto.title,
        reason: dto.reason,
        process: dto.process,
        responsible: dto.responsible,
        riskId: dto.riskId,
        hazards: dto.hazards,
        impacts: dto.impacts,
        controls: dto.controls,
        requestedAt: dto.requestedAt ? new Date(dto.requestedAt) : undefined,
        companyId,
      },
    });
  }

  async updateScoped(
    id: string,
    companyId: string,
    dto: UpdateChangeRequestDto,
  ) {
    const result = await this.prisma.changeRequest.updateMany({
      where: { id, companyId },
      data: {
        title: dto.title,
        reason: dto.reason,
        process: dto.process,
        responsible: dto.responsible,
        // undefined = no tocar; null = desasignar (solo permitido fuera de
        // aprobacion; el service valida).
        riskId: dto.riskId !== undefined ? dto.riskId : undefined,
        hazards: dto.hazards,
        impacts: dto.impacts,
        controls: dto.controls,
        implementationNotes: dto.implementationNotes,
        // undefined = no tocar; null = desasignar evidencia.
        implementationEvidenceId:
          dto.implementationEvidenceId !== undefined
            ? dto.implementationEvidenceId
            : undefined,
        verificationNotes: dto.verificationNotes,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findByIdScoped(id, companyId);
  }

  /** S14.2: persiste la etapa del workflow (scoped por empresa). */
  async updateStatus(
    id: string,
    companyId: string,
    data: Prisma.ChangeRequestUncheckedUpdateManyInput,
  ) {
    const result = await this.prisma.changeRequest.updateMany({
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
    await this.prisma.changeRequest.delete({ where: { id } });
    return before;
  }
}
