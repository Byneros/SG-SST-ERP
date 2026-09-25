import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { AnnualWorkPlansRepository } from './annual-work-plans.repository';
import { CreateAnnualWorkPlanDto } from './dto/create-annual-work-plan.dto';
import { UpdateAnnualWorkPlanDto } from './dto/update-annual-work-plan.dto';

@Injectable()
export class AnnualWorkPlansService {
  constructor(
    private readonly repository: AnnualWorkPlansRepository,
    private readonly auditService: AuditService,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  async findAll(currentUser: AuthenticatedUser, companyId?: string) {
    return this.repository.findAll(
      this.resolveCompanyId(currentUser, companyId),
    );
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    // Aislamiento: un plan de otra empresa no existe para el actor (404).
    const plan = await this.repository.findByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!plan) {
      throw new NotFoundException('Annual work plan not found');
    }
    return plan;
  }

  async create(currentUser: AuthenticatedUser, dto: CreateAnnualWorkPlanDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);

    // Un plan por anio y empresa (unique compuesto del schema).
    const existing = await this.repository.findByYear(companyId, dto.year);
    if (existing) {
      throw new ConflictException(
        `Ya existe un plan anual para el anio ${dto.year} en esta empresa`,
      );
    }

    const plan = await this.repository.create(dto, companyId);

    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'AnnualWorkPlan',
      entityId: plan.id,
      after: plan,
    });

    return plan;
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateAnnualWorkPlanDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Annual work plan not found');
    }

    if (dto.year !== undefined && dto.year !== before.year) {
      const existing = await this.repository.findByYear(companyId, dto.year);
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Ya existe un plan anual para el anio ${dto.year} en esta empresa`,
        );
      }
    }

    const updated = await this.repository.updateScoped(id, companyId, dto);
    if (!updated) {
      throw new NotFoundException('Annual work plan not found');
    }

    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'AnnualWorkPlan',
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
      throw new NotFoundException('Annual work plan not found');
    }

    // Hard delete con traza de auditoria (ADR de borrado): la trazabilidad
    // normativa queda en AuditLog con snapshot `before`, no en la tabla.
    await this.repository.removeScoped(id, companyId);

    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'AnnualWorkPlan',
      entityId: id,
      before,
    });

    return { id, deleted: true };
  }
}
