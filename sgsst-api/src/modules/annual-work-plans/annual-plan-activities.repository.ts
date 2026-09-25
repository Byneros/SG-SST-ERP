import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { UpdateAnnualPlanActivityDto } from './dto/annual-plan-activity.dto';

const activityInclude = {
  plan: { select: { id: true, year: true, status: true } },
  owner: { select: { id: true, name: true, email: true } },
  evidence: {
    select: {
      id: true,
      name: true,
      fileName: true,
      mimeType: true,
      status: true,
    },
  },
} as const;

@Injectable()
export class AnnualPlanActivitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByPlan(companyId: string, planId: string) {
    return this.prisma.annualPlanActivity.findMany({
      where: { companyId, planId },
      include: activityInclude,
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  findByIdScoped(id: string, companyId: string) {
    return this.prisma.annualPlanActivity.findFirst({
      where: { id, companyId },
      include: activityInclude,
    });
  }

  findByIdScopedInPlan(id: string, companyId: string, planId: string) {
    return this.prisma.annualPlanActivity.findFirst({
      where: { id, companyId, planId },
      include: activityInclude,
    });
  }

  create(data: {
    companyId: string;
    planId: string;
    cycle?: string;
    name: string;
    frequency?: string;
    dueDate?: Date | null;
    progress?: number;
    status?: string;
    budget?: number | null;
    ownerId?: string | null;
    evidenceId?: string | null;
  }) {
    return this.prisma.annualPlanActivity.create({
      data,
      include: activityInclude,
    });
  }

  /** Update restrictivo: la actividad debe ser de la empresa del actor. */
  async updateScoped(
    id: string,
    companyId: string,
    dto: UpdateAnnualPlanActivityDto,
  ) {
    const result = await this.prisma.annualPlanActivity.updateMany({
      where: { id, companyId },
      data: {
        cycle: dto.cycle,
        name: dto.name,
        frequency: dto.frequency,
        dueDate:
          dto.dueDate === undefined
            ? undefined
            : dto.dueDate
              ? new Date(dto.dueDate)
              : null,
        progress: dto.progress,
        status: dto.status,
        budget: dto.budget === undefined ? undefined : dto.budget,
        ownerId: dto.ownerId === undefined ? undefined : dto.ownerId,
        evidenceId: dto.evidenceId === undefined ? undefined : dto.evidenceId,
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
    await this.prisma.annualPlanActivity.delete({ where: { id } });
    return before;
  }

  /** Avance del plan: promedio de progreso de sus actividades. */
  async computePlanProgress(
    companyId: string,
    planId: string,
  ): Promise<number | null> {
    const aggregate = await this.prisma.annualPlanActivity.aggregate({
      where: { companyId, planId, status: { not: 'CANCELLED' } },
      _avg: { progress: true },
    });
    return aggregate._avg.progress === null
      ? null
      : Math.round(aggregate._avg.progress * 100) / 100;
  }
}
