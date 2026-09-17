import { Injectable, NotFoundException } from '@nestjs/common';
import { CompanyScopeService } from '../../common/company/company-scope.service';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateCorrectiveActionDto } from './dto/create-corrective-action.dto';
import { CreateFindingDto } from './dto/create-finding.dto';
import { CreateSgsstAuditDto } from './dto/create-sgsst-audit.dto';
import { UpdateCorrectiveActionDto } from './dto/update-corrective-action.dto';
import { UpdateFindingDto } from './dto/update-finding.dto';
import { UpdateSgsstAuditDto } from './dto/update-sgsst-audit.dto';
import { SgsstAuditsRepository } from './sgsst-audits.repository';

@Injectable()
export class SgsstAuditsService {
  constructor(
    private readonly repository: SgsstAuditsRepository,
    private readonly companyScope: CompanyScopeService,
  ) {}

  findAll(user: AuthenticatedUser, query: ListQueryDto, companyId?: string) {
    const scope = this.companyScope.resolveCompanyId(user, companyId);

    return this.repository.findAll(scope, query);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const audit = await this.repository.findById(id);

    if (!audit) {
      throw new NotFoundException('Audit not found');
    }

    // Aislamiento por empresa: una auditoria de otra empresa no existe para el actor (404).
    if (audit.companyId !== this.companyScope.resolveCompanyId(user)) {
      throw new NotFoundException('Audit not found');
    }

    this.companyScope.validate(user, audit.companyId);

    return audit;
  }

  async create(user: AuthenticatedUser, dto: CreateSgsstAuditDto) {
    const companyId = this.companyScope.resolveCompanyId(user, dto.companyId);

    if (!companyId) {
      throw new NotFoundException('Company ID is required');
    }

    return this.repository.create({
      ...dto,
      companyId,
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateSgsstAuditDto) {
    await this.findOne(user, id);

    return this.repository.update(id, dto);
  }

  async remove(user: AuthenticatedUser, id: string) {
    await this.findOne(user, id);

    return this.repository.remove(id);
  }

  async createFinding(
    user: AuthenticatedUser,
    auditId: string,
    dto: CreateFindingDto,
  ) {
    const audit = await this.repository.findById(auditId);

    if (!audit) {
      throw new NotFoundException('Audit not found');
    }

    // Aislamiento: la auditoria de otra empresa no existe para el actor (404).
    if (audit.companyId !== this.companyScope.resolveCompanyId(user)) {
      throw new NotFoundException('Audit not found');
    }

    this.companyScope.validate(user, audit.companyId);

    return this.repository.createFinding(auditId, dto);
  }

  async updateFinding(
    user: AuthenticatedUser,
    findingId: string,
    dto: UpdateFindingDto,
  ) {
    const finding = await this.repository.findFindingByIdScoped(
      findingId,
      this.companyScope.resolveCompanyId(user),
    );

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    this.companyScope.validate(user, finding.audit.companyId);

    return this.repository.updateFinding(findingId, dto);
  }

  async createAction(
    user: AuthenticatedUser,
    findingId: string,
    dto: CreateCorrectiveActionDto,
  ) {
    const finding = await this.repository.findFindingByIdScoped(
      findingId,
      this.companyScope.resolveCompanyId(user),
    );

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    this.companyScope.validate(user, finding.audit.companyId);

    return this.repository.createAction(findingId, dto);
  }

  async updateAction(
    user: AuthenticatedUser,
    actionId: string,
    dto: UpdateCorrectiveActionDto,
  ) {
    const action = await this.repository.findActionByIdScoped(
      actionId,
      this.companyScope.resolveCompanyId(user),
    );

    if (!action) {
      throw new NotFoundException('Action not found');
    }

    this.companyScope.validate(user, action.finding.audit.companyId);

    return this.repository.updateAction(actionId, dto);
  }
}
