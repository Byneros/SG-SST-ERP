import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActionPlansRepository } from './action-plans.repository';
import type {
  ActionsListQueryDto,
  AdvanceActionPlanDto,
  CreateActionPlanDto,
  UpdateActionPlanDto,
  VerifyActionPlanDto,
} from './dto/action-plan.dto';

/** Etapas del workflow (#41): solo avanza hacia adelante. */
const WORKFLOW_ORDER = ['OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED'] as const;

type Stage = (typeof WORKFLOW_ORDER)[number];

/**
 * Plan de accion unificado (S15.2, #41). Reglas del dominio:
 * - La CORRECTIVE nace de un hallazgo (sourceType FINDING + sourceId del
 *   tenant) y exige causa raiz para verificarse.
 * - Pasar a DONE exige evidencia de ejecucion (Document del tenant).
 * - Verificar sella eficacia, verificador y fecha; en hallazgos CRITICAL el
 *   verificador no puede ser el responsable de la accion.
 * - PREVENTIVE/IMPROVEMENT no exigen no conformidad previa pero si beneficio
 *   esperado al verificarse.
 * - CANCELLED solo desde OPEN/IN_PROGRESS.
 * - Auditoria: ACTION_FLOW_ADVANCE por transicion y ACTION_VERIFIED al sellar.
 */
@Injectable()
export class ActionPlansService {
  constructor(
    private readonly repository: ActionPlansRepository,
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

  findMany(currentUser: AuthenticatedUser, query: ActionsListQueryDto) {
    return this.repository.findMany(this.resolveCompanyId(currentUser), query);
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    const action = await this.repository.findByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!action) {
      throw new NotFoundException('Action plan not found');
    }
    return action;
  }

  // --- Mutaciones --------------------------------------------------------------

  async create(currentUser: AuthenticatedUser, dto: CreateActionPlanDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);

    // CORRECTIVE: la no conformidad previa es obligatoria (hallazgo del tenant).
    if (dto.kind === 'CORRECTIVE') {
      if (dto.sourceType !== 'FINDING' || !dto.sourceId) {
        throw new BadRequestException(
          'La accion correctiva exige un hallazgo de origen (sourceType FINDING + sourceId)',
        );
      }
      await this.assertFindingInScope(dto.sourceId, companyId);
    } else if (dto.sourceType === 'FINDING' && dto.sourceId) {
      // Origen opcional para PREVENTIVE/IMPROVEMENT, pero validado si se cita.
      await this.assertFindingInScope(dto.sourceId, companyId);
    }
    if (dto.ownerId) {
      await this.assertOwnerInScope(dto.ownerId, companyId);
    }

    const action = await this.repository.create(dto, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'ActionPlan',
      entityId: action.id,
      after: action,
    });
    return action;
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateActionPlanDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Action plan not found');
    }

    // Cancelacion: solo desde estados no terminales.
    if (dto.status === 'CANCELLED') {
      if (before.status === 'DONE' || before.status === 'VERIFIED') {
        throw new BadRequestException(
          'Solo se puede cancelar una accion en OPEN o IN_PROGRESS',
        );
      }
    }
    if (dto.ownerId) {
      await this.assertOwnerInScope(dto.ownerId, companyId);
    }
    if (dto.evidenceId) {
      await this.assertEvidenceInScope(dto.evidenceId, companyId);
    }
    // La eficacia y el verificador se sellan por el endpoint de verificacion.
    if (
      before.status === 'VERIFIED' &&
      (dto.title !== undefined ||
        dto.description !== undefined ||
        dto.ownerId !== undefined)
    ) {
      throw new BadRequestException(
        'La accion verificada es de solo lectura: no se puede editar',
      );
    }

    const updated = await this.repository.updateScoped(id, companyId, dto);
    if (!updated) {
      throw new NotFoundException('Action plan not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'ActionPlan',
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
      throw new NotFoundException('Action plan not found');
    }
    await this.repository.removeScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'ActionPlan',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Workflow (#41) ----------------------------------------------------------

  /** Guardas por etapa para avanzar. */
  private assertCanAdvance(current: Stage, target: Stage, action: {
    evidenceId: string | null;
  }) {
    const missing: string[] = [];
    if (current === 'IN_PROGRESS' && !action.evidenceId) {
      missing.push('evidencia de ejecucion');
    }
    if (missing.length > 0) {
      throw new BadRequestException(
        `No se puede avanzar a ${target.toLowerCase()}: falta ${missing.join('; ')}`,
      );
    }
  }

  /** Avanza el workflow una etapa (OPEN -> IN_PROGRESS -> DONE). */
  async advance(
    currentUser: AuthenticatedUser,
    id: string,
    dto: AdvanceActionPlanDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Action plan not found');
    }

    // CANCELLED es un estado posible en runtime aunque no pertenezca al flujo.
    const current = before.status as Stage | 'CANCELLED';
    if (current === 'VERIFIED') {
      throw new BadRequestException('La accion ya esta verificada');
    }
    if (current === 'CANCELLED') {
      throw new BadRequestException('La accion esta cancelada');
    }
    const currentIndex = WORKFLOW_ORDER.indexOf(current);
    const nextStage =
      WORKFLOW_ORDER[Math.min(currentIndex + 1, WORKFLOW_ORDER.length - 2)];
    if (dto.target !== nextStage) {
      throw new BadRequestException(
        `Transicion invalida: desde ${current} solo se puede avanzar a ${nextStage}`,
      );
    }

    this.assertCanAdvance(current, dto.target, before);

    const updated = await this.repository.updateStatus(id, companyId, {
      status: dto.target,
    });
    if (!updated) {
      throw new NotFoundException('Action plan not found');
    }

    await this.auditService.log({
      user: currentUser,
      action: 'ACTION_FLOW_ADVANCE',
      entity: 'ActionPlan',
      entityId: id,
      before: { status: current },
      after: { status: dto.target },
    });
    return updated;
  }

  /**
   * Verificacion de eficacia (#41): DONE -> VERIFIED sellando eficacia,
   * verificador y fecha. Guardas por tipo de accion y regla CRITICAL.
   */
  async verify(
    currentUser: AuthenticatedUser,
    id: string,
    dto: VerifyActionPlanDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Action plan not found');
    }
    if (before.status !== 'DONE') {
      throw new BadRequestException(
        'Solo se puede verificar una accion en DONE (con evidencia de ejecucion)',
      );
    }

    const missing: string[] = [];
    if (before.kind === 'CORRECTIVE' && !before.rootCause) {
      missing.push('causa raiz de la accion correctiva');
    }
    if (
      (before.kind === 'PREVENTIVE' || before.kind === 'IMPROVEMENT') &&
      !before.expectedBenefit
    ) {
      missing.push('beneficio o resultado esperado');
    }
    if (before.sourceType === 'FINDING') {
      const sourceFinding = await this.prisma.finding.findFirst({
        where: { id: before.sourceId ?? '', companyId },
        select: { severity: true },
      });
      if (sourceFinding?.severity === 'CRITICAL' && !before.ownerId) {
        missing.push('responsable de la accion (exigido por hallazgo CRITICAL)');
      }
      if (
        sourceFinding?.severity === 'CRITICAL' &&
        before.ownerId === currentUser.sub
      ) {
        throw new BadRequestException(
          'En hallazgos CRITICAL el verificador debe ser distinto del responsable de la accion',
        );
      }
    }
    if (missing.length > 0) {
      throw new BadRequestException(
        `No se puede verificar: falta ${missing.join('; ')}`,
      );
    }

    const updated = await this.repository.updateStatus(id, companyId, {
      status: 'VERIFIED',
      effectiveness: dto.effectiveness,
      result: dto.result,
      verifiedById: currentUser.sub,
      verifiedAt: new Date(),
      closedAt: new Date(),
    });
    if (!updated) {
      throw new NotFoundException('Action plan not found');
    }

    await this.auditService.log({
      user: currentUser,
      action: 'ACTION_VERIFIED',
      entity: 'ActionPlan',
      entityId: id,
      before: { status: 'DONE', effectiveness: before.effectiveness },
      after: {
        status: 'VERIFIED',
        effectiveness: dto.effectiveness,
        verifiedById: currentUser.sub,
      },
    });
    return updated;
  }

  // --- Validaciones de alcance -------------------------------------------------

  private async assertFindingInScope(findingId: string, companyId: string) {
    const finding = await this.prisma.finding.findFirst({
      where: { id: findingId, companyId },
      select: { id: true },
    });
    if (!finding) {
      throw new NotFoundException('Finding not found');
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

  private async assertEvidenceInScope(evidenceId: string, companyId: string) {
    const evidence = await this.prisma.document.findFirst({
      where: { id: evidenceId, companyId },
      select: { id: true },
    });
    if (!evidence) {
      throw new NotFoundException('Evidence document not found');
    }
  }
}
