import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { SitesRepository } from '../sites/sites.repository';
import { UsersRepository } from '../users/users.repository';
import { UnplannedInspectionsRepository } from './unplanned-inspections.repository';
import type {
  CreateCorrectiveActionDto,
  CreateUnplannedFindingDto,
  CreateUnplannedInspectionDto,
  UpdateUnplannedFindingDto,
  UpdateUnplannedInspectionDto,
} from './dto/unplanned-inspection.dto';

@Injectable()
export class UnplannedInspectionsService {
  constructor(
    private readonly repository: UnplannedInspectionsRepository,
    private readonly sitesRepository: SitesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  private async assertSiteInScope(siteId: string, companyId: string) {
    const site = await this.sitesRepository.findByIdScoped(siteId, companyId);
    if (!site) {
      throw new NotFoundException('Site not found');
    }
  }

  private async assertInspectorInScope(inspectorId: string, companyId: string) {
    const inspector = await this.usersRepository.findByIdScoped(
      inspectorId,
      companyId,
    );
    if (!inspector) {
      throw new NotFoundException('Inspector not found');
    }
  }

  async findAll(currentUser: AuthenticatedUser, siteId?: string) {
    return this.repository.findAll(this.resolveCompanyId(currentUser), siteId);
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    // Aislamiento: una inspeccion de otra empresa no existe para el actor (404).
    const inspection = await this.repository.findByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }
    return inspection;
  }

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateUnplannedInspectionDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    if (dto.siteId) {
      await this.assertSiteInScope(dto.siteId, companyId);
    }
    if (dto.inspectorId) {
      await this.assertInspectorInScope(dto.inspectorId, companyId);
    }

    const inspection = await this.repository.create(dto, companyId);

    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'UnplannedInspection',
      entityId: inspection.id,
      after: inspection,
    });

    return inspection;
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateUnplannedInspectionDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Inspection not found');
    }
    if (dto.siteId) {
      await this.assertSiteInScope(dto.siteId, companyId);
    }
    if (dto.inspectorId) {
      await this.assertInspectorInScope(dto.inspectorId, companyId);
    }

    const updated = await this.repository.updateScoped(id, companyId, dto);
    if (!updated) {
      throw new NotFoundException('Inspection not found');
    }

    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'UnplannedInspection',
      entityId: id,
      before,
      after: updated,
    });

    return updated;
  }

  async remove(currentUser: AuthenticatedUser, id: string) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Inspection not found');
    }

    await this.repository.removeScoped(id, companyId);

    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'UnplannedInspection',
      entityId: id,
      before,
    });

    return { id, deleted: true };
  }

  /**
   * Hallazgo de inspeccion no planeada. Si viene riskLevel, crea ademas un
   * Risk en la matriz GTC-45 (titulo derivado del hallazgo, sede de la
   * inspeccion) y lo vincula: hallazgo -> riesgo + accion correctiva.
   */
  async addFinding(
    currentUser: AuthenticatedUser,
    inspectionId: string,
    dto: CreateUnplannedFindingDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const inspection = await this.repository.findByIdScoped(
      inspectionId,
      companyId,
    );
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }

    let riskId: string | undefined;
    if (dto.riskLevel) {
      const risk = await this.repository.createRisk({
        title: `Riesgo por hallazgo: ${dto.description.slice(0, 80)}`,
        description: `Generado desde inspeccion no planeada "${inspection.title}" (${inspection.reason})`,
        level: dto.riskLevel,
        companyId,
        siteId: inspection.siteId,
      });
      riskId = risk.id;
      await this.auditService.log({
        user: currentUser,
        action: 'CREATE',
        entity: 'Risk',
        entityId: risk.id,
        after: risk,
      });
    }

    const finding = await this.repository.createFinding(
      inspectionId,
      dto,
      riskId,
    );

    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'InspectionFinding',
      entityId: finding.id,
      after: finding,
    });

    return finding;
  }

  async updateFinding(
    currentUser: AuthenticatedUser,
    findingId: string,
    dto: UpdateUnplannedFindingDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const finding = await this.repository.findFindingByIdScoped(
      findingId,
      companyId,
    );
    if (!finding) {
      throw new NotFoundException('Inspection finding not found');
    }
    return this.repository.updateFinding(findingId, dto);
  }

  /** Accion correctiva desde hallazgo (reutiliza CorrectiveAction, idempotente). */
  async addCorrectiveAction(
    currentUser: AuthenticatedUser,
    findingId: string,
    dto: CreateCorrectiveActionDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const finding = await this.repository.findFindingByIdScoped(
      findingId,
      companyId,
    );
    if (!finding) {
      throw new NotFoundException('Inspection finding not found');
    }
    if (finding.actionId && finding.action) {
      return finding.action;
    }

    const action = await this.repository.createCorrectiveAction(findingId, dto);

    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'CorrectiveAction',
      entityId: action.id,
      after: action,
    });

    return action;
  }
}
