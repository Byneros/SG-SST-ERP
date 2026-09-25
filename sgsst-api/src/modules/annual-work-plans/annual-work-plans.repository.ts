import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAnnualWorkPlanDto } from './dto/create-annual-work-plan.dto';
import { UpdateAnnualWorkPlanDto } from './dto/update-annual-work-plan.dto';

const planInclude = {
  company: { select: { id: true, name: true, nit: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class AnnualWorkPlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.annualWorkPlan.findMany({
      where: { companyId },
      include: planInclude,
      orderBy: { year: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.annualWorkPlan.findUnique({
      where: { id },
      include: planInclude,
    });
  }

  /** Variante con aislamiento por empresa: 404 (null) si el plan es de otra empresa. */
  findByIdScoped(id: string, companyId: string) {
    return this.prisma.annualWorkPlan.findFirst({
      where: { id, companyId },
      include: planInclude,
    });
  }

  findByYear(companyId: string, year: number) {
    return this.prisma.annualWorkPlan.findUnique({
      where: { companyId_year: { companyId, year } },
      include: planInclude,
    });
  }

  create(dto: CreateAnnualWorkPlanDto, companyId: string) {
    const data = {
      year: dto.year,
      status: dto.status,
      notes: dto.notes,
      approvedById: dto.approvedById ?? undefined,
      approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : undefined,
      companyId,
    };
    return this.prisma.annualWorkPlan.create({
      data,
      include: planInclude,
    });
  }

  /** Update restrictivo por empresa (defensa en profundidad). */
  async updateScoped(
    id: string,
    companyId: string,
    dto: UpdateAnnualWorkPlanDto,
  ) {
    const result = await this.prisma.annualWorkPlan.updateMany({
      where: { id, companyId },
      data: {
        year: dto.year,
        status: dto.status,
        notes: dto.notes,
        approvedById:
          dto.approvedById === undefined ? undefined : dto.approvedById,
        approvedAt:
          dto.approvedAt === undefined
            ? undefined
            : dto.approvedAt
              ? new Date(dto.approvedAt)
              : null,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findByIdScoped(id, companyId);
  }

  /** Hard delete con traza (ADR de borrado): devuelve el snapshot previo o null. */
  async removeScoped(id: string, companyId: string) {
    const before = await this.findByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.annualWorkPlan.delete({ where: { id } });
    return before;
  }
}
