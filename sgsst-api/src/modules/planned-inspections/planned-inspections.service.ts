import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { SitesRepository } from '../sites/sites.repository';
import { UsersRepository } from '../users/users.repository';
import { PrismaService } from '../../database/prisma.service';
import { PlannedInspectionsRepository } from './planned-inspections.repository';
import type {
  CreateCorrectiveActionDto,
  CreateInspectionFindingDto,
  CreatePlannedInspectionDto,
  UpdateInspectionFindingDto,
  UpdateInspectionItemDto,
  UpdatePlannedInspectionDto,
} from './dto/planned-inspection.dto';

@Injectable()
export class PlannedInspectionsService {
  constructor(
    private readonly repository: PlannedInspectionsRepository,
    private readonly sitesRepository: SitesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  /** La sede debe existir y pertenecer a la empresa del scope. */
  private async assertSiteInScope(siteId: string, companyId: string) {
    const site = await this.sitesRepository.findByIdScoped(siteId, companyId);
    if (!site) {
      throw new NotFoundException('Site not found');
    }
  }

  private async assertInspectorInScope(inspectorId: string, companyId: string) {
    // Un usuario de otra empresa no existe para el actor (404 cross-tenant).
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
    dto: CreatePlannedInspectionDto,
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
      entity: 'PlannedInspection',
      entityId: inspection.id,
      after: inspection,
    });

    return inspection;
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdatePlannedInspectionDto,
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
      entity: 'PlannedInspection',
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

    // Hard delete con traza (ADR): la cascada elimina items y hallazgos.
    await this.repository.removeScoped(id, companyId);

    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'PlannedInspection',
      entityId: id,
      before,
    });

    return { id, deleted: true };
  }

  async updateItem(
    currentUser: AuthenticatedUser,
    inspectionId: string,
    itemId: string,
    dto: UpdateInspectionItemDto,
  ) {
    await this.findOne(currentUser, inspectionId);
    // El item debe pertenecer a la inspeccion indicada y a la empresa del actor.
    const item = await this.repository.findItemByIdScoped(
      itemId,
      this.resolveCompanyId(currentUser),
    );
    if (!item || item.inspection.id !== inspectionId) {
      throw new NotFoundException('Inspection item not found');
    }

    const updated = await this.repository.updateItemScoped(
      itemId,
      this.resolveCompanyId(currentUser),
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Inspection item not found');
    }
    return updated;
  }

  /** Agrega preguntas al checklist de una inspeccion existente (scope verificado). */
  async addItems(
    currentUser: AuthenticatedUser,
    inspectionId: string,
    questions: string[],
  ) {
    await this.findOne(currentUser, inspectionId);
    await this.repository.addItems(inspectionId, questions);
    return this.findOne(currentUser, inspectionId);
  }

  async addFinding(
    currentUser: AuthenticatedUser,
    inspectionId: string,
    dto: CreateInspectionFindingDto,
  ) {
    await this.findOne(currentUser, inspectionId);

    const finding = await this.repository.createFinding(inspectionId, dto);

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
    dto: UpdateInspectionFindingDto,
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

  /**
   * Accion correctiva desde un hallazgo: crea la CorrectiveAction compartiendo
   * el modelo con auditorias y la vincula al hallazgo (trazabilidad completa:
   * hallazgo -> accion -> responsable -> cierre).
   */
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
    if (finding.actionId) {
      return finding.action;
    }

    const action = await this.repository.createCorrectiveAction(findingId, dto);
    await this.prisma.inspectionFinding.update({
      where: { id: findingId },
      data: { actionId: action.id },
    });

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
