import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { AnnualPlanActivitiesRepository } from './annual-plan-activities.repository';
import { AnnualWorkPlansRepository } from './annual-work-plans.repository';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateAnnualPlanActivityDto,
  UpdateAnnualPlanActivityDto,
} from './dto/annual-plan-activity.dto';

@Injectable()
export class AnnualPlanActivitiesService {
  constructor(
    private readonly activitiesRepository: AnnualPlanActivitiesRepository,
    private readonly plansRepository: AnnualWorkPlansRepository,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  /** El plan contenedor debe existir y ser de la empresa del actor (404 si no). */
  private async assertPlanInScope(planId: string, companyId: string) {
    const plan = await this.plansRepository.findByIdScoped(planId, companyId);
    if (!plan) {
      throw new NotFoundException('Annual work plan not found');
    }
    return plan;
  }

  /**
   * Evidencia integrada con documents: debe ser un documento de la misma
   * empresa; uno ajeno "no existe" para el actor (404, mismo criterio 404
   * cross-tenant del resto del API).
   */
  private async assertEvidenceInScope(evidenceId: string, companyId: string) {
    const evidence = await this.prisma.document.findFirst({
      where: { id: evidenceId, companyId },
      select: { id: true },
    });
    if (!evidence) {
      throw new NotFoundException('Document not found');
    }
  }

  async findAll(
    currentUser: AuthenticatedUser,
    planId: string,
    companyId?: string,
  ) {
    const scopedCompanyId = this.resolveCompanyId(currentUser, companyId);
    await this.assertPlanInScope(planId, scopedCompanyId);
    const activities = await this.activitiesRepository.findAllByPlan(
      scopedCompanyId,
      planId,
    );
    return {
      data: activities,
      // % de avance global del plan: promedio de actividades no canceladas.
      planProgress: await this.activitiesRepository.computePlanProgress(
        scopedCompanyId,
        planId,
      ),
    };
  }

  async findOne(currentUser: AuthenticatedUser, planId: string, id: string) {
    const companyId = this.resolveCompanyId(currentUser);
    await this.assertPlanInScope(planId, companyId);
    // Aislamiento doble: la actividad debe pertenecer ademas al plan indicado.
    const activity = await this.activitiesRepository.findByIdScopedInPlan(
      id,
      companyId,
      planId,
    );
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    return activity;
  }

  async create(
    currentUser: AuthenticatedUser,
    planId: string,
    dto: CreateAnnualPlanActivityDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    await this.assertPlanInScope(planId, companyId);

    if (dto.evidenceId) {
      await this.assertEvidenceInScope(dto.evidenceId, companyId);
    }

    const activity = await this.activitiesRepository.create({
      companyId,
      planId,
      cycle: dto.cycle,
      name: dto.name,
      frequency: dto.frequency,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      progress: dto.progress,
      status: dto.status,
      budget: dto.budget === undefined ? null : dto.budget,
      ownerId: dto.ownerId ?? null,
      evidenceId: dto.evidenceId ?? null,
    });

    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'AnnualPlanActivity',
      entityId: activity.id,
      after: activity,
    });

    return activity;
  }

  async update(
    currentUser: AuthenticatedUser,
    planId: string,
    id: string,
    dto: UpdateAnnualPlanActivityDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.findOne(currentUser, planId, id);

    if (dto.evidenceId) {
      await this.assertEvidenceInScope(dto.evidenceId, companyId);
    }

    // Consistencia de estado: DONE exige 100% de avance; 100% implica DONE.
    const effectiveProgress = dto.progress ?? before.progress;
    if (dto.status === 'DONE' && effectiveProgress < 100) {
      throw new ConflictException(
        'Una actividad no puede marcarse DONE sin alcanzar 100% de avance',
      );
    }
    if (
      dto.progress === 100 &&
      dto.status === undefined &&
      before.status !== 'DONE'
    ) {
      dto = { ...dto, status: 'DONE' };
    }

    const updated = await this.activitiesRepository.updateScoped(
      id,
      companyId,
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Activity not found');
    }

    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'AnnualPlanActivity',
      entityId: id,
      before,
      after: updated,
    });

    return updated;
  }

  async remove(currentUser: AuthenticatedUser, planId: string, id: string) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.findOne(currentUser, planId, id);

    // Hard delete con traza de auditoria (ADR de borrado).
    await this.activitiesRepository.removeScoped(id, companyId);

    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'AnnualPlanActivity',
      entityId: id,
      before,
    });

    return { id, deleted: true };
  }
}
