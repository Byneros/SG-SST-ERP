import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TasksService } from '../tasks/tasks.service';
import { FindingsRepository } from './findings.repository';
import type {
  CreateFindingCauseDto,
  CreateFindingDto,
  FindingsListQueryDto,
  UpdateFindingDto,
} from './dto/finding.dto';

/**
 * Hallazgos unificados (S15.1, #40). Decision S15: coexisten con los hallazgos
 * por modulo; el origen (sourceType/sourceId) es trazable y se valida
 * same-tenant (404 si es ajeno, sin revelar su existencia).
 */
@Injectable()
export class FindingsService {
  constructor(
    private readonly repository: FindingsRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly tasksService: TasksService,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  // --- Consultas ---------------------------------------------------------------

  findMany(currentUser: AuthenticatedUser, query: FindingsListQueryDto) {
    return this.repository.findMany(this.resolveCompanyId(currentUser), query);
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    const finding = await this.repository.findByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!finding) {
      throw new NotFoundException('Finding not found');
    }
    return finding;
  }

  // --- Mutaciones --------------------------------------------------------------

  async create(currentUser: AuthenticatedUser, dto: CreateFindingDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);

    // MANUAL no exige origen; los demas exigen sourceId del tenant existente.
    if (dto.sourceType !== 'MANUAL') {
      if (!dto.sourceId) {
        throw new BadRequestException(
          `El origen ${dto.sourceType.toLowerCase()} exige sourceId`,
        );
      }
      await this.assertSourceInScope(dto.sourceType, dto.sourceId, companyId);
    }
    if (dto.ownerId) {
      await this.assertOwnerInScope(dto.ownerId, companyId);
    }

    const finding = await this.repository.create(dto, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'Finding',
      entityId: finding.id,
      after: finding,
    });
    // S15.3: los hallazgos MAJOR/CRITICAL generan una tarea automatica para
    // su gestion (idempotente; falla de tarea no revierte el hallazgo).
    await this.tasksService.createForFinding(finding).catch(() => undefined);
    return finding;
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateFindingDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Finding not found');
    }
    if (dto.ownerId) {
      await this.assertOwnerInScope(dto.ownerId, companyId);
    }

    const updated = await this.repository.updateScoped(id, companyId, dto);
    if (!updated) {
      throw new NotFoundException('Finding not found');
    }
    // S15.3: escalar a MAJOR/CRITICAL tambien genera la tarea automatica.
    await this.tasksService.createForFinding(updated).catch(() => undefined);
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'Finding',
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
      throw new NotFoundException('Finding not found');
    }
    await this.repository.removeScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'Finding',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Causas ------------------------------------------------------------------

  async addCause(
    currentUser: AuthenticatedUser,
    findingId: string,
    dto: CreateFindingCauseDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const finding = await this.repository.findByIdScoped(findingId, companyId);
    if (!finding) {
      throw new NotFoundException('Finding not found');
    }
    if (finding.status === 'CLOSED') {
      throw new BadRequestException(
        'El hallazgo esta cerrado: reabre el hallazgo para registrar causas',
      );
    }

    const cause = await this.repository.createCause(findingId, dto);
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'FindingCause',
      entityId: cause.id,
      after: { ...cause, findingId },
    });
    return cause;
  }

  async removeCause(
    currentUser: AuthenticatedUser,
    findingId: string,
    causeId: string,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const finding = await this.repository.findByIdScoped(findingId, companyId);
    if (!finding) {
      throw new NotFoundException('Finding not found');
    }
    const cause = await this.repository.findCauseByIdScoped(
      causeId,
      findingId,
      companyId,
    );
    if (!cause) {
      throw new NotFoundException('Finding cause not found');
    }

    await this.repository.removeCause(causeId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'FindingCause',
      entityId: causeId,
      before: cause,
    });
    return { id: causeId, deleted: true };
  }

  // --- Validaciones de alcance -------------------------------------------------

  /** Origen trazable: el recurso citado debe existir y ser del tenant (404). */
  private async assertSourceInScope(
    sourceType: string,
    sourceId: string,
    companyId: string,
  ) {
    const source = await this.findSource(sourceType, sourceId, companyId);
    if (!source) {
      throw new NotFoundException('Source not found');
    }
  }

  private findSource(sourceType: string, sourceId: string, companyId: string) {
    switch (sourceType) {
      case 'INSPECTION_PLANNED':
        return this.prisma.plannedInspection.findFirst({
          where: { id: sourceId, companyId },
          select: { id: true },
        });
      case 'INSPECTION_UNPLANNED':
        return this.prisma.unplannedInspection.findFirst({
          where: { id: sourceId, companyId },
          select: { id: true },
        });
      case 'AUDIT':
        return this.prisma.audit.findFirst({
          where: { id: sourceId, companyId },
          select: { id: true },
        });
      case 'UNSAFE_REPORT':
        return this.prisma.unsafeReport.findFirst({
          where: { id: sourceId, companyId },
          select: { id: true },
        });
      default:
        return Promise.resolve(null);
    }
  }

  private async assertOwnerInScope(ownerId: string, companyId: string) {
    const owner = await this.prisma.user.findFirst({
      where: { id: ownerId, companyId },
      select: { id: true },
    });
    if (!owner) {
      throw new NotFoundException('Owner not found');
    }
  }
}
