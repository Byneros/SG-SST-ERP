import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ChangeRequestsRepository } from './change-requests.repository';
import type {
  AdvanceChangeRequestDto,
  ChangeRequestListQueryDto,
  CreateChangeRequestDto,
  UpdateChangeRequestDto,
} from './dto/change-request.dto';

/** Etapas del workflow (#39): solo avanza hacia adelante. */
const WORKFLOW_ORDER = [
  'REQUESTED',
  'EVALUATION',
  'CONTROLS',
  'APPROVAL',
  'IMPLEMENTATION',
  'VERIFICATION',
  'CLOSED',
] as const;

type Stage = (typeof WORKFLOW_ORDER)[number];

/**
 * Gestion del cambio (S14). Criterios (#38/#39):
 * - Solicitud con evaluacion obligatoria de riesgos (riskId de la matriz).
 * - No se cierra un cambio sin evaluacion de riesgos y evidencia de
 *   implementacion.
 * - Auditoria completa del workflow (CHANGE_FLOW_ADVANCE por transicion).
 */
@Injectable()
export class ChangeRequestsService {
  constructor(
    private readonly repository: ChangeRequestsRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  // --- Consultas ---------------------------------------------------------------

  findMany(currentUser: AuthenticatedUser, query: ChangeRequestListQueryDto) {
    return this.repository.findMany(this.resolveCompanyId(currentUser), query);
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    const change = await this.repository.findByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!change) {
      throw new NotFoundException('Change request not found');
    }
    return change;
  }

  // --- Mutaciones --------------------------------------------------------------

  async create(currentUser: AuthenticatedUser, dto: CreateChangeRequestDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);

    // Evaluacion obligatoria de riesgos (#38): el riesgo debe existir y ser
    // del tenant (404 si es ajeno: no se filtra su existencia).
    const risk = await this.prisma.risk.findFirst({
      where: { id: dto.riskId, companyId },
      select: { id: true },
    });
    if (!risk) {
      throw new NotFoundException('Risk not found');
    }

    const change = await this.repository.create(dto, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'ChangeRequest',
      entityId: change.id,
      after: change,
    });
    return change;
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateChangeRequestDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Change request not found');
    }

    // El riesgo debe ser del tenant si se cambia (404 ajeno).
    if (dto.riskId) {
      const risk = await this.prisma.risk.findFirst({
        where: { id: dto.riskId, companyId },
        select: { id: true },
      });
      if (!risk) {
        throw new NotFoundException('Risk not found');
      }
    }
    // Evidencia same-tenant (404 cross-tenant), mismo patron de contractors.
    if (dto.implementationEvidenceId) {
      const evidence = await this.prisma.document.findFirst({
        where: { id: dto.implementationEvidenceId, companyId },
        select: { id: true },
      });
      if (!evidence) {
        throw new NotFoundException('Evidence document not found');
      }
    }
    if (dto.riskId === null && before.status !== 'CLOSED') {
      throw new BadRequestException(
        'La evaluacion de riesgos es obligatoria: no se puede desasignar el riesgo de un cambio abierto',
      );
    }

    const updated = await this.repository.updateScoped(id, companyId, dto);
    if (!updated) {
      throw new NotFoundException('Change request not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'ChangeRequest',
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
      throw new NotFoundException('Change request not found');
    }
    await this.repository.removeScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'ChangeRequest',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Workflow (#39) ----------------------------------------------------------

  /**
   * Guardas por etapa: la evaluacion debe existir para pasar de EVALUATION,
   * los controles para pasar de APPROVAL, la evidencia de implementacion
   * para pasar de VERIFICATION y la verificacion para cerrar.
   */
  private assertCanAdvance(
    current: Stage,
    target: Stage,
    change: {
      riskId: string | null;
      hazards: string | null;
      impacts: string | null;
      controls: string | null;
      implementationEvidenceId: string | null;
      verificationNotes: string | null;
    },
  ) {
    const missing: string[] = [];
    if (current === 'REQUESTED' && !change.riskId) {
      missing.push('evaluacion de riesgos (riesgo de la matriz GTC-45)');
    }
    if (current === 'EVALUATION' && (!change.hazards || !change.impacts)) {
      missing.push('peligros e impactos de la evaluacion');
    }
    if (current === 'CONTROLS' && !change.controls) {
      missing.push('controles propuestos');
    }
    if (current === 'IMPLEMENTATION' && !change.implementationEvidenceId) {
      missing.push('evidencia de implementacion');
    }
    if (current === 'VERIFICATION' && !change.verificationNotes) {
      missing.push('notas de verificacion');
    }
    if (missing.length > 0) {
      throw new BadRequestException(
        `No se puede avanzar a ${target.toLowerCase()}: falta ${missing.join('; ')}`,
      );
    }
  }

  /** Avanza el workflow una etapa con guardas y auditoria (#39). */
  async advance(
    currentUser: AuthenticatedUser,
    id: string,
    dto: AdvanceChangeRequestDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Change request not found');
    }

    const current = before.status;
    if (current === 'CLOSED') {
      throw new BadRequestException('El workflow ya esta cerrado');
    }
    const currentIndex = WORKFLOW_ORDER.indexOf(current);
    const nextStage =
      WORKFLOW_ORDER[Math.min(currentIndex + 1, WORKFLOW_ORDER.length - 1)];
    if (dto.target !== nextStage) {
      throw new BadRequestException(
        `Transicion invalida: desde ${current} solo se puede avanzar a ${nextStage}`,
      );
    }

    this.assertCanAdvance(current, dto.target, before);

    // Aprobacion: sella aprobador y fecha (criterio #39: auditoria por paso).
    const isApproval = dto.target === 'IMPLEMENTATION';
    const updated = await this.repository.updateStatus(id, companyId, {
      status: dto.target,
      ...(isApproval
        ? { approvedById: currentUser.sub, approvedAt: new Date() }
        : {}),
    });
    if (!updated) {
      throw new NotFoundException('Change request not found');
    }

    await this.auditService.log({
      user: currentUser,
      action: 'CHANGE_FLOW_ADVANCE',
      entity: 'ChangeRequest',
      entityId: id,
      before: { status: current },
      after: { status: dto.target },
    });

    return updated;
  }
}
