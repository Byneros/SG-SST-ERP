import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HazardControlSource,
  HazardType,
  RiskGtcLevel,
  RiskLevel,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { CreateHazardControlDto } from './dto/risk-matrix.dto';
import {
  CreateLinkedRiskDto,
  CreateRiskActivityDto,
  CreateRiskHazardDto,
  CreateRiskProcessDto,
  UpdateHazardControlDto,
  UpdateRiskActivityDto,
  UpdateRiskHazardDto,
  UpdateRiskProcessDto,
  UpsertValoracionDto,
} from './dto/risk-matrix.dto';
import { SitesRepository } from '../sites/sites.repository';
import { RiskMatrixRepository } from './risk-matrix.repository';

type ProcessRow = NonNullable<
  Awaited<ReturnType<RiskMatrixRepository['findProcessById']>>
>;

/** Umbral clásico de la GTC-45 (قط ija 5x5): score = probabilidad × severidad.
 *  Nivel I (trivial) ≤ 4 · II (moderado) ≤ 9 · III (grave) ≤ 19 · IV (crítico) ≥ 20. */
const GTC_THRESHOLDS: Array<{ max: number; level: RiskGtcLevel }> = [
  { max: 4, level: 'I' },
  { max: 9, level: 'II' },
  { max: 19, level: 'III' },
  { max: 25, level: 'IV' },
];

/**_interfaces */
const GTC_TO_RISK_LEVEL: Record<RiskGtcLevel, RiskLevel> = {
  I: 'LOW',
  II: 'MEDIUM',
  III: 'HIGH',
  IV: 'CRITICAL',
};

export function deriveGtcLevel(
  probability: number,
  severity: number,
): RiskGtcLevel {
  const score = probability * severity;
  return GTC_THRESHOLDS.find((t) => score <= t.max)!.level;
}

@Injectable()
export class RiskMatrixService {
  constructor(
    private readonly repository: RiskMatrixRepository,
    private readonly auditService: AuditService,
    private readonly sitesRepository: SitesRepository,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  /** Árbol completo del tenant (proceso → actividad → peligro → ... → riesgo). */
  async tree(currentUser: AuthenticatedUser, companyId?: string) {
    const scoped = this.resolveCompanyId(currentUser, companyId);
    return this.repository.findCompanyTree(scoped);
  }

  //----- procesos ------------------------------------------------------------
  async createProcess(currentUser: AuthenticatedUser, dto: CreateRiskProcessDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    const process = await this.repository.createProcess({
      name: dto.name,
      description: dto.description ?? null,
      companyId,
    });
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'RiskProcess',
      entityId: process.id,
      after: process,
    });
    return process;
  }

  private async assertProcess(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<ProcessRow> {
    const process = await this.repository.findProcessById(id);
    // Aislamiento: el proceso de otra empresa no existe para el actor (404).
    if (!process || process.company.id !== this.resolveCompanyId(currentUser)) {
      throw new NotFoundException('Risk process not found');
    }
    return process;
  }

  async updateProcess(currentUser: AuthenticatedUser, id: string, dto: UpdateRiskProcessDto) {
    const process = await this.assertProcess(currentUser, id);
    const updated = await this.repository.updateProcess(id, dto);
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'RiskProcess',
      entityId: id,
      before: process,
      after: updated,
    });
    return updated;
  }

  async deleteProcess(currentUser: AuthenticatedUser, id: string) {
    const process = await this.assertProcess(currentUser, id);
    await this.repository.deleteProcess(id);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'RiskProcess',
      entityId: id,
      before: process,
    });
    return { id, deleted: true };
  }

  //----- actividades -----------------------------------------------------------
  private async assertActivityProcess(
    currentUser: AuthenticatedUser,
    processId: string,
  ) {
    const process = await this.repository.findProcessById(processId);
    if (!process || process.company.id !== this.resolveCompanyId(currentUser)) {
      throw new NotFoundException('Risk process not found');
    }
    return process;
  }

  async createActivity(
    currentUser: AuthenticatedUser,
    processId: string,
    dto: CreateRiskActivityDto,
  ) {
    const process = await this.assertActivityProcess(currentUser, processId);
    const activity = await this.repository.createActivity({
      name: dto.name,
      description: dto.description ?? null,
      processId,
    });
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'RiskActivity',
      entityId: activity.id,
      after: activity,
      before: { processId, riskProcess: process.name },
    });
    return activity;
  }

  private async assertActivity(currentUser: AuthenticatedUser, id: string) {
    const activity = await this.repository.findActivityById(id);
    if (!activity || activity.process.companyId !== this.resolveCompanyId(currentUser)) {
      throw new NotFoundException('Risk activity not found');
    }
    return activity;
  }

  async updateActivity(currentUser: AuthenticatedUser, id: string, dto: UpdateRiskActivityDto) {
    const before = await this.assertActivity(currentUser, id);
    const updated = await this.repository.updateActivity(id, dto);
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'RiskActivity',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async deleteActivity(currentUser: AuthenticatedUser, id: string) {
    const before = await this.assertActivity(currentUser, id);
    await this.repository.deleteActivity(id);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'RiskActivity',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  //----- peligros --------------------------------------------------------------
  async createHazard(
    currentUser: AuthenticatedUser,
    activityId: string,
    dto: CreateRiskHazardDto,
  ) {
    const activity = await this.assertActivity(currentUser, activityId);
    const hazard = await this.repository.createHazard({
      name: dto.name,
      hazardType: dto.hazardType as HazardType,
      activityId,
    });
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'RiskHazard',
      entityId: hazard.id,
      after: hazard,
      before: { activityId, riskActivity: activity.name },
    });
    return hazard;
  }

  private async assertHazard(currentUser: AuthenticatedUser, id: string) {
    const hazard = await this.repository.findHazardById(id);
    if (
      !hazard ||
      hazard.activity.process.companyId !== this.resolveCompanyId(currentUser)
    ) {
      throw new NotFoundException('Risk hazard not found');
    }
    return hazard;
  }

  async updateHazard(currentUser: AuthenticatedUser, id: string, dto: UpdateRiskHazardDto) {
    const before = await this.assertHazard(currentUser, id);
    const updated = await this.repository.updateHazard(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.hazardType !== undefined
        ? { hazardType: dto.hazardType as HazardType }
        : {}),
    });
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'RiskHazard',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async deleteHazard(currentUser: AuthenticatedUser, id: string) {
    const before = await this.assertHazard(currentUser, id);
    await this.repository.deleteHazard(id);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'RiskHazard',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  //----- valoración (1:1 por peligro) -----------------------------------------
  async upsertValoracion(
    currentUser: AuthenticatedUser,
    hazardId: string,
    dto: UpsertValoracionDto,
  ) {
    const hazard = await this.assertHazard(currentUser, hazardId);
    const before = hazard.valorations[0] ?? null;
    const riskLevel = deriveGtcLevel(dto.probability, dto.severity);
    const valoracion = await this.repository.upsertValoracion(hazardId, {
      probability: dto.probability,
      severity: dto.severity,
      riskLevel,
    });
    await this.auditService.log({
      user: currentUser,
      action: before ? 'UPDATE' : 'CREATE',
      entity: 'RiskValoracion',
      entityId: valoracion.id,
      before,
      after: valoracion,
    });
    // El riesgo vinculado (si existe) sigue la valoración vigente.
    const linked = await this.repository.findRiskByHazardId(hazardId);
    if (linked) {
      const level = GTC_TO_RISK_LEVEL[riskLevel];
      await this.repository.updateLinkedRisk(linked.id, { level });
      await this.auditService.log({
        user: currentUser,
        action: 'UPDATE',
        entity: 'Risk',
        entityId: linked.id,
        before: { level: linked.level },
        after: { level },
      });
    }
    return { valoracion, riskLevel, mappedRiskLevel: GTC_TO_RISK_LEVEL[riskLevel] };
  }

  //----- controles --------------------------------------------------------------
  async createControl(
    currentUser: AuthenticatedUser,
    hazardId: string,
    dto: CreateHazardControlDto,
  ) {
    await this.assertHazard(currentUser, hazardId);
    const control = await this.repository.createControl({
      source: dto.source as HazardControlSource,
      type: dto.type ?? null,
      effectiveness: dto.effectiveness ?? null,
      hazardId,
    });
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'HazardControl',
      entityId: control.id,
      after: control,
      before: { hazardId },
    });
    return control;
  }

  private async assertControl(currentUser: AuthenticatedUser, id: string) {
    const control = await this.repository.findControlById(id);
    if (
      !control ||
      control.hazard.activity.process.companyId !==
        this.resolveCompanyId(currentUser)
    ) {
      throw new NotFoundException('Hazard control not found');
    }
    return control;
  }

  async updateControl(currentUser: AuthenticatedUser, id: string, dto: UpdateHazardControlDto) {
    const before = await this.assertControl(currentUser, id);
    const updated = await this.repository.updateControl(id, {
      ...(dto.source !== undefined ? { source: dto.source as HazardControlSource } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.effectiveness !== undefined ? { effectiveness: dto.effectiveness } : {}),
    });
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'HazardControl',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async deleteControl(currentUser: AuthenticatedUser, id: string) {
    const before = await this.assertControl(currentUser, id);
    await this.repository.deleteControl(id);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'HazardControl',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  //----- riesgo vinculado (resultado final) ------------------------------------
  async createLinkedRisk(
    currentUser: AuthenticatedUser,
    hazardId: string,
    dto: CreateLinkedRiskDto,
  ) {
    const hazard = await this.assertHazard(currentUser, hazardId);
    if (await this.repository.findRiskByHazardId(hazardId)) {
      throw new BadRequestException(
        'El peligro ya tiene un riesgo; usa PATCH /risks para actualizarlo',
      );
    }
    // Valoración obligatoria: el nivel del riesgo replica el resultado GTC-45.
    if (hazard.valorations.length === 0) {
      throw new BadRequestException(
        'Registra la valoración (probabilidad × severidad) antes de crear el riesgo',
      );
    }
    const valoracion = hazard.valorations[0];
    const companyId = hazard.activity.process.companyId;
    if (dto.siteId) {
      const site = await this.sitesRepository.findByIdScoped(dto.siteId, companyId);
      if (!site) {
        throw new NotFoundException('Site not found');
      }
    }
    const risk = await this.repository.createLinkedRisk({
      title: dto.title ?? hazard.name,
      description: dto.description ?? null,
      level: GTC_TO_RISK_LEVEL[valoracion.riskLevel as RiskGtcLevel],
      hazardId,
      companyId,
      siteId: dto.siteId ?? null,
    });
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'Risk',
      entityId: risk.id,
      after: { ...risk, hazardId },
      before: { hazardId, riskLevel: valoracion.riskLevel },
    });
    return risk;
  }
}
