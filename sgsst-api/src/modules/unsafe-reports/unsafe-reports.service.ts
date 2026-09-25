import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { SitesRepository } from '../sites/sites.repository';
import { UnsafeReportsRepository } from './unsafe-reports.repository';
import type {
  CreateCorrectiveActionDto,
  CreateUnsafeFindingDto,
  CreateUnsafeReportDto,
  UpdateUnsafeReportDto,
} from './dto/unsafe-report.dto';

@Injectable()
export class UnsafeReportsService {
  constructor(
    private readonly repository: UnsafeReportsRepository,
    private readonly sitesRepository: SitesRepository,
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

  async findAll(
    currentUser: AuthenticatedUser,
    kind?: string,
    status?: string,
  ) {
    return this.repository.findAll(
      this.resolveCompanyId(currentUser),
      kind,
      status,
    );
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    // Aislamiento: un reporte de otra empresa no existe para el actor (404).
    const report = await this.repository.findByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!report) {
      throw new NotFoundException('Unsafe report not found');
    }
    // Anonimato: el reportante anonimo solo se expone a ADMIN/SST/AUDITOR.
    if (report.isAnonymous && currentUser.role === Role.EMPLOYEE) {
      return { ...report, reporter: null, reporterName: null };
    }
    return report;
  }

  async create(currentUser: AuthenticatedUser, dto: CreateUnsafeReportDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    if (dto.siteId) {
      await this.assertSiteInScope(dto.siteId, companyId);
    }

    // Cualquier usuario (incluido EMPLOYEE) reporta; el reporter queda asociado
    // salvo que el reporte sea anonimo.
    const report = await this.repository.create(
      dto,
      companyId,
      currentUser.sub,
    );

    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'UnsafeReport',
      entityId: report.id,
      after: report,
    });

    return report;
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateUnsafeReportDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Unsafe report not found');
    }

    const updated = await this.repository.updateScoped(id, companyId, dto);
    if (!updated) {
      throw new NotFoundException('Unsafe report not found');
    }

    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'UnsafeReport',
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
      throw new NotFoundException('Unsafe report not found');
    }

    await this.repository.removeScoped(id, companyId);

    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'UnsafeReport',
      entityId: id,
      before,
    });

    return { id, deleted: true };
  }

  /** Hallazgo adicional dentro del reporte (seguimiento detallado). */
  async addFinding(
    currentUser: AuthenticatedUser,
    reportId: string,
    dto: CreateUnsafeFindingDto,
  ) {
    await this.findOne(currentUser, reportId);
    const finding = await this.repository.createFinding(reportId, dto);

    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'InspectionFinding',
      entityId: finding.id,
      after: finding,
    });

    return finding;
  }

  /** Accion correctiva/educativa desde el reporte (idempotente por hallazgo). */
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
      throw new NotFoundException('Finding not found');
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
