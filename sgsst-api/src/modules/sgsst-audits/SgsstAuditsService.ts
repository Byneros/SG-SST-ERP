import { Injectable, NotFoundException } from '@nestjs/common';
import { CompanyScopeService } from '../../common/company/company-scope.service';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import { CreateCorrectiveActionDto } from './dto/create-corrective-action.dto';
import { CreateFindingDto } from './dto/create-finding.dto';
import { CreateSgsstAuditDto } from './dto/create-sgsst-audit.dto';
import { CreateAuditProgramDto } from './dto/create-audit-program.dto';
import { ReplaceAuditChecklistDto } from './dto/replace-audit-checklist.dto';
import { UpdateAuditProgramDto } from './dto/update-audit-program.dto';
import { UpdateAuditChecklistItemDto } from './dto/update-audit-checklist-item.dto';
import { UpdateCorrectiveActionDto } from './dto/update-corrective-action.dto';
import { UpdateFindingDto } from './dto/update-finding.dto';
import { UpdateSgsstAuditDto } from './dto/update-sgsst-audit.dto';
import { SgsstAuditsRepository } from './sgsst-audits.repository';

@Injectable()
export class SgsstAuditsService {
  constructor(
    private readonly repository: SgsstAuditsRepository,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
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
    // Borrado fisico con traza de auditoria (ADR de borrado, fase 1):
    // la cascada elimina findings/acciones/checklist; la traza preserva quien/que/cuando.
    const audit = await this.findOne(user, id);

    await this.repository.remove(id);
    await this.auditService.log({
      user,
      action: 'DELETE',
      entity: 'Audit',
      entityId: id,
      before: audit,
    });

    return { id, deleted: true };
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

  // ----- FASE 7.1: programas de auditoría -----------------------------------

  async findPrograms(
    user: AuthenticatedUser,
    query: ListQueryDto,
    companyId?: string,
  ) {
    const scope = this.companyScope.resolveCompanyId(user, companyId);

    if (!scope) {
      return [];
    }

    return this.repository.findPrograms(scope, query);
  }

  async findProgramById(user: AuthenticatedUser, id: string) {
    const program = await this.repository.findProgramByIdScoped(
      id,
      this.companyScope.resolveCompanyId(user),
    );

    if (!program) {
      throw new NotFoundException('Audit program not found');
    }

    this.companyScope.validate(user, program.companyId);

    return program;
  }

  async createProgram(user: AuthenticatedUser, dto: CreateAuditProgramDto) {
    const companyId = this.companyScope.resolveCompanyId(user, dto.companyId);

    if (!companyId) {
      throw new NotFoundException('Company ID is required');
    }

    return this.repository.createProgram({ ...dto, companyId });
  }

  async updateProgram(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateAuditProgramDto,
  ) {
    await this.findProgramById(user, id);

    return this.repository.updateProgram(id, dto);
  }

  async removeProgram(user: AuthenticatedUser, id: string) {
    // Borrado fisico con traza de auditoria (ADR de borrado, fase 1).
    const program = await this.findProgramById(user, id);

    await this.repository.removeProgram(id);
    await this.auditService.log({
      user,
      action: 'DELETE',
      entity: 'AuditProgram',
      entityId: id,
      before: program,
    });

    return { id, deleted: true };
  }

  // ----- FASE 7.1: checklist de auditoría -----------------------------------

  async findChecklist(user: AuthenticatedUser, auditId: string) {
    await this.findOne(user, auditId);

    return this.repository.findChecklist(auditId);
  }

  async replaceChecklist(
    user: AuthenticatedUser,
    auditId: string,
    dto: ReplaceAuditChecklistDto,
  ) {
    await this.findOne(user, auditId);

    return this.repository.replaceChecklist(auditId, dto);
  }

  async updateChecklistItem(
    user: AuthenticatedUser,
    itemId: string,
    dto: UpdateAuditChecklistItemDto,
  ) {
    const item = await this.repository.findChecklistItemById(itemId);

    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }

    // Aislamiento: el item de otra empresa no existe para el actor (404).
    if (item.audit.companyId !== this.companyScope.resolveCompanyId(user)) {
      throw new NotFoundException('Checklist item not found');
    }

    this.companyScope.validate(user, item.audit.companyId);

    return this.repository.updateChecklistItem(itemId, dto);
  }
}
