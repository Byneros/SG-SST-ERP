import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { EmergencyRepository } from './emergency.repository';
import type {
  CreateEmergencyBrigadeDto,
  CreateEmergencyBrigadeMemberDto,
  CreateEmergencyDrillDto,
  CreateEmergencyDrillFindingDto,
  CreateEmergencyPlanDto,
  CreateEmergencyResourceDto,
  CreateEmergencyThreatDto,
  EmergencyBrigadeListQueryDto,
  EmergencyDrillListQueryDto,
  EmergencyPlanListQueryDto,
  UpdateEmergencyBrigadeDto,
  UpdateEmergencyBrigadeMemberDto,
  UpdateEmergencyDrillDto,
  UpdateEmergencyDrillFindingDto,
  UpdateEmergencyPlanDto,
  UpdateEmergencyResourceDto,
  UpdateEmergencyThreatDto,
} from './dto/emergency.dto';

@Injectable()
export class EmergencyService {
  constructor(
    private readonly repository: EmergencyRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  /** Valida que la sede pertenezca a la empresa (404 cross-tenant). */
  private async assertSiteInCompany(siteId: string, companyId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, companyId },
      select: { id: true },
    });
    if (!site) {
      throw new NotFoundException('Site not found');
    }
  }

  /** Valida que el empleado pertenezca a la empresa (404 cross-tenant). */
  private async assertEmployeeInCompany(employeeId: string, companyId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
  }

  // --- Brigadas (#31) -----------------------------------------------------------

  findBrigades(
    currentUser: AuthenticatedUser,
    query: EmergencyBrigadeListQueryDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    return this.repository.findBrigades(companyId, query);
  }

  async findOneBrigade(currentUser: AuthenticatedUser, id: string) {
    const brigade = await this.repository.findBrigadeByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!brigade) {
      throw new NotFoundException('Emergency brigade not found');
    }
    return brigade;
  }

  async createBrigade(
    currentUser: AuthenticatedUser,
    dto: CreateEmergencyBrigadeDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    await this.assertSiteInCompany(dto.siteId, companyId);

    const brigade = await this.repository.createBrigade(dto, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'EmergencyBrigade',
      entityId: brigade.id,
      after: brigade,
    });
    return brigade;
  }

  async updateBrigade(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateEmergencyBrigadeDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findBrigadeByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Emergency brigade not found');
    }
    if (dto.siteId && dto.siteId !== before.siteId) {
      await this.assertSiteInCompany(dto.siteId, companyId);
    }

    const updated = await this.repository.updateBrigadeScoped(
      id,
      companyId,
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Emergency brigade not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'EmergencyBrigade',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async removeBrigade(currentUser: AuthenticatedUser, id: string) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findBrigadeByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Emergency brigade not found');
    }
    await this.repository.removeBrigadeScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'EmergencyBrigade',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  async findBrigadeMembers(currentUser: AuthenticatedUser, brigadeId: string) {
    await this.findOneBrigade(currentUser, brigadeId);
    return this.repository.findBrigadeMembers(
      brigadeId,
      this.resolveCompanyId(currentUser),
    );
  }

  async createBrigadeMember(
    currentUser: AuthenticatedUser,
    brigadeId: string,
    dto: CreateEmergencyBrigadeMemberDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    await this.findOneBrigade(currentUser, brigadeId);
    await this.assertEmployeeInCompany(dto.employeeId, companyId);

    const duplicated = await this.prisma.emergencyBrigadeMember.findFirst({
      where: { brigadeId, employeeId: dto.employeeId },
      select: { id: true },
    });
    if (duplicated) {
      throw new BadRequestException(
        'Ese empleado ya es integrante de esta brigada',
      );
    }

    const member = await this.repository.createBrigadeMember(
      dto,
      brigadeId,
      companyId,
    );
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'EmergencyBrigadeMember',
      entityId: member.id,
      after: member,
    });
    return member;
  }

  async updateBrigadeMember(
    currentUser: AuthenticatedUser,
    brigadeId: string,
    id: string,
    dto: UpdateEmergencyBrigadeMemberDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findBrigadeMemberByIdScoped(
      id,
      companyId,
    );
    if (!before || before.brigadeId !== brigadeId) {
      throw new NotFoundException('Brigade member not found');
    }
    if (dto.employeeId && dto.employeeId !== before.employeeId) {
      await this.assertEmployeeInCompany(dto.employeeId, companyId);
      const duplicated = await this.prisma.emergencyBrigadeMember.findFirst({
        where: { brigadeId, employeeId: dto.employeeId },
        select: { id: true },
      });
      if (duplicated) {
        throw new BadRequestException(
          'Ese empleado ya es integrante de esta brigada',
        );
      }
    }

    const updated = await this.repository.updateBrigadeMemberScoped(
      id,
      companyId,
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Brigade member not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'EmergencyBrigadeMember',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async removeBrigadeMember(
    currentUser: AuthenticatedUser,
    brigadeId: string,
    id: string,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findBrigadeMemberByIdScoped(
      id,
      companyId,
    );
    if (!before || before.brigadeId !== brigadeId) {
      throw new NotFoundException('Brigade member not found');
    }
    await this.repository.removeBrigadeMemberScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'EmergencyBrigadeMember',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Planes (#32) --------------------------------------------------------------

  findPlans(currentUser: AuthenticatedUser, query: EmergencyPlanListQueryDto) {
    const companyId = this.resolveCompanyId(currentUser);
    return this.repository.findPlans(companyId, query);
  }

  async findOnePlan(currentUser: AuthenticatedUser, id: string) {
    const plan = await this.repository.findPlanByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!plan) {
      throw new NotFoundException('Emergency plan not found');
    }
    return plan;
  }

  async createPlan(
    currentUser: AuthenticatedUser,
    dto: CreateEmergencyPlanDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    await this.assertSiteInCompany(dto.siteId, companyId);
    if (dto.responsibleEmployeeId) {
      await this.assertEmployeeInCompany(dto.responsibleEmployeeId, companyId);
    }
    // Plan independiente por sede: una sede, un plan (criterio #32).
    const duplicated = await this.prisma.emergencyPlan.findFirst({
      where: { siteId: dto.siteId },
      select: { id: true },
    });
    if (duplicated) {
      throw new BadRequestException('La sede ya tiene un plan de emergencias');
    }

    const plan = await this.repository.createPlan(dto, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'EmergencyPlan',
      entityId: plan.id,
      after: plan,
    });
    return plan;
  }

  async updatePlan(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateEmergencyPlanDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findPlanByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Emergency plan not found');
    }
    if (dto.siteId && dto.siteId !== before.siteId) {
      await this.assertSiteInCompany(dto.siteId, companyId);
      const duplicated = await this.prisma.emergencyPlan.findFirst({
        where: { siteId: dto.siteId },
        select: { id: true },
      });
      if (duplicated) {
        throw new BadRequestException(
          'La sede ya tiene un plan de emergencias',
        );
      }
    }
    if (dto.responsibleEmployeeId) {
      await this.assertEmployeeInCompany(dto.responsibleEmployeeId, companyId);
    }

    const updated = await this.repository.updatePlanScoped(id, companyId, dto);
    if (!updated) {
      throw new NotFoundException('Emergency plan not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'EmergencyPlan',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async removePlan(currentUser: AuthenticatedUser, id: string) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findPlanByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Emergency plan not found');
    }
    await this.repository.removePlanScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'EmergencyPlan',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Amenazas ------------------------------------------------------------------

  async createThreat(
    currentUser: AuthenticatedUser,
    planId: string,
    dto: CreateEmergencyThreatDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    await this.findOnePlan(currentUser, planId);

    const threat = await this.repository.createThreat(dto, planId, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'EmergencyThreat',
      entityId: threat.id,
      after: threat,
    });
    return threat;
  }

  async updateThreat(
    currentUser: AuthenticatedUser,
    planId: string,
    id: string,
    dto: UpdateEmergencyThreatDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findThreatByIdScoped(id, companyId);
    if (!before || before.planId !== planId) {
      throw new NotFoundException('Emergency threat not found');
    }

    const updated = await this.repository.updateThreatScoped(
      id,
      companyId,
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Emergency threat not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'EmergencyThreat',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async removeThreat(
    currentUser: AuthenticatedUser,
    planId: string,
    id: string,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findThreatByIdScoped(id, companyId);
    if (!before || before.planId !== planId) {
      throw new NotFoundException('Emergency threat not found');
    }
    await this.repository.removeThreatScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'EmergencyThreat',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Recursos ------------------------------------------------------------------

  async createResource(
    currentUser: AuthenticatedUser,
    planId: string,
    dto: CreateEmergencyResourceDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    await this.findOnePlan(currentUser, planId);

    const resource = await this.repository.createResource(
      dto,
      planId,
      companyId,
    );
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'EmergencyResource',
      entityId: resource.id,
      after: resource,
    });
    return resource;
  }

  async updateResource(
    currentUser: AuthenticatedUser,
    planId: string,
    id: string,
    dto: UpdateEmergencyResourceDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findResourceByIdScoped(id, companyId);
    if (!before || before.planId !== planId) {
      throw new NotFoundException('Emergency resource not found');
    }

    const updated = await this.repository.updateResourceScoped(
      id,
      companyId,
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Emergency resource not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'EmergencyResource',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async removeResource(
    currentUser: AuthenticatedUser,
    planId: string,
    id: string,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findResourceByIdScoped(id, companyId);
    if (!before || before.planId !== planId) {
      throw new NotFoundException('Emergency resource not found');
    }
    await this.repository.removeResourceScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'EmergencyResource',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Simulacros (#33) ------------------------------------------------------------

  findDrills(
    currentUser: AuthenticatedUser,
    query: EmergencyDrillListQueryDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    return this.repository.findDrills(companyId, query);
  }

  async findOneDrill(currentUser: AuthenticatedUser, id: string) {
    const drill = await this.repository.findDrillByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!drill) {
      throw new NotFoundException('Emergency drill not found');
    }
    return drill;
  }

  async createDrill(
    currentUser: AuthenticatedUser,
    dto: CreateEmergencyDrillDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    // El simulacro queda vinculado a plan y sede via el plan (criterio #33).
    await this.findOnePlan(currentUser, dto.planId);

    const drill = await this.repository.createDrill(dto, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'EmergencyDrill',
      entityId: drill.id,
      after: drill,
    });
    return drill;
  }

  async updateDrill(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateEmergencyDrillDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findDrillByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Emergency drill not found');
    }

    // Transiciones: PLANNED -> EXECUTED (ejecutado) -> CLOSED (cerrado).
    const data: Record<string, unknown> = {
      name: dto.name,
      scenario: dto.scenario,
      plannedAt: dto.plannedAt ? new Date(dto.plannedAt) : undefined,
      executedAt:
        dto.executedAt === undefined
          ? undefined
          : dto.executedAt === null
            ? null
            : new Date(dto.executedAt),
      durationMinutes: dto.durationMinutes,
      participants: dto.participants,
      resultNotes: dto.resultNotes,
      status: dto.status,
    };
    const effectiveExecutedAt =
      (dto.executedAt ? new Date(dto.executedAt) : null) ?? before.executedAt;
    const effectiveStatus = dto.status ?? before.status;
    if (effectiveStatus === 'EXECUTED' && !effectiveExecutedAt) {
      // Ejecutar sin fecha: se sella con el momento del cambio (auditoria deja el resto).
      data.executedAt = new Date();
    }
    if (
      (effectiveStatus === 'CLOSED' || before.status === 'CLOSED') &&
      !effectiveExecutedAt
    ) {
      throw new BadRequestException(
        'No se puede cerrar un simulacro que no fue ejecutado',
      );
    }

    const updated = await this.repository.updateDrillScoped(
      id,
      companyId,
      data,
    );
    if (!updated) {
      throw new NotFoundException('Emergency drill not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'EmergencyDrill',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async removeDrill(currentUser: AuthenticatedUser, id: string) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findDrillByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Emergency drill not found');
    }
    await this.repository.removeDrillScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'EmergencyDrill',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Hallazgos de simulacro --------------------------------------------------------

  async createFinding(
    currentUser: AuthenticatedUser,
    drillId: string,
    dto: CreateEmergencyDrillFindingDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    await this.findOneDrill(currentUser, drillId);

    const finding = await this.repository.createFinding(
      dto,
      drillId,
      companyId,
    );
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'EmergencyDrillFinding',
      entityId: finding.id,
      after: finding,
    });
    return finding;
  }

  async updateFinding(
    currentUser: AuthenticatedUser,
    drillId: string,
    id: string,
    dto: UpdateEmergencyDrillFindingDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findFindingByIdScoped(id, companyId);
    if (!before || before.drillId !== drillId) {
      throw new NotFoundException('Drill finding not found');
    }

    const updated = await this.repository.updateFindingScoped(id, companyId, {
      description: dto.description,
      severity: dto.severity,
      actionDescription: dto.actionDescription,
      actionResponsible: dto.actionResponsible,
      actionDueDate:
        dto.actionDueDate === undefined
          ? undefined
          : dto.actionDueDate === null
            ? null
            : new Date(dto.actionDueDate),
      closedAt:
        dto.closedAt === undefined
          ? undefined
          : dto.closedAt === null
            ? null
            : new Date(dto.closedAt),
    });
    if (!updated) {
      throw new NotFoundException('Drill finding not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'EmergencyDrillFinding',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async removeFinding(
    currentUser: AuthenticatedUser,
    drillId: string,
    id: string,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findFindingByIdScoped(id, companyId);
    if (!before || before.drillId !== drillId) {
      throw new NotFoundException('Drill finding not found');
    }
    await this.repository.removeFindingScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'EmergencyDrillFinding',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }
}
