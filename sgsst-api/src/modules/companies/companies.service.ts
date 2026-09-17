import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import {
  assertCompanyScope,
  resolveCompanyScope,
} from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { CompaniesRepository } from './companies.repository';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly companiesRepository: CompaniesRepository,
    private readonly auditService: AuditService,
  ) {}

  findAll(user: AuthenticatedUser, query: ListQueryDto) {
    const companyId =
      user.role === 'SUPER_ADMIN' ? undefined : resolveCompanyScope(user);
    return this.companiesRepository.findAll(query, companyId);
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    // Aislamiento: para actores con empresa activa, una empresa ajena no existe (404).
    // SUPER_ADMIN sin empresa activa conserva la búsqueda global.
    if (user?.activeCompanyId) {
      const scoped = await this.companiesRepository.findById(id);
      if (!scoped || scoped.id !== user.activeCompanyId) {
        throw new NotFoundException('Company not found');
      }
      return scoped;
    }
    const company = await this.companiesRepository.findById(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    if (user) {
      assertCompanyScope(user, company.id);
    }
    return company;
  }

  async create(dto: CreateCompanyDto, user?: AuthenticatedUser) {
    const existing = await this.companiesRepository.findByNit(dto.nit);
    if (existing) {
      throw new ConflictException('NIT is already registered');
    }
    const created = await this.companiesRepository.create(dto);
    await this.auditService.log({
      user,
      action: 'CREATE',
      entity: 'Company',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async update(id: string, dto: UpdateCompanyDto, user?: AuthenticatedUser) {
    const before = await this.findOne(id, user);
    const updated = await this.companiesRepository.update(id, dto);
    await this.auditService.log({
      user,
      action: this.resolveStateAction(before.isActive, dto.isActive),
      entity: 'Company',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async remove(id: string, user?: AuthenticatedUser) {
    const before = await this.findOne(id, user);
    const updated = await this.companiesRepository.remove(id);
    await this.auditService.log({
      user,
      action: 'DEACTIVATE',
      entity: 'Company',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async hardRemove(id: string, user?: AuthenticatedUser) {
    const before = await this.findOne(id, user);
    const deleted = await this.companiesRepository.deleteById(id);
    await this.auditService.log({
      user,
      action: 'DELETE',
      entity: 'Company',
      entityId: id,
      before,
      after: deleted,
    });
    return deleted;
  }

  private resolveStateAction(beforeActive: boolean, nextActive?: boolean) {
    if (nextActive === true && !beforeActive) {
      return 'REACTIVATE';
    }
    if (nextActive === false && beforeActive) {
      return 'DEACTIVATE';
    }
    return 'UPDATE';
  }
}
